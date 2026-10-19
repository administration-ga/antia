// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/replayReconcile.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, `enter`, fonctions `sessions.*` bornées par `networkId`) au lieu des comptes du socle (`users`, `publishMyProfile`) ; tables et actions du moteur (`liveSessions`, `modules/live/{replay,livekitActions}`) ; MOTIFS attendus en CODES (`egress_aborted`, `egress_failed`, `never_started`, `never_delivered`) au lieu des phrases ; refus à code au lieu des phrases (`liveRoleRequired`, règles `LIVE_REPLAY_NOTHING_TO_RETRY`, `LIVE_REPLAY_UNAVAILABLE`) ; horloge simulée — les jobs ne partent que joués (`drainDueJobs`), d'où le retrait du drainage d'avant le dépôt du fichier (ADR-0152 du socle) et l'analyse de la piste de sous-titres JOUÉE avant de lire son adresse (la garde des fichiers du moteur ne sert qu'une pièce jugée) ; lignes posées en base COMPLÈTES (schéma validé) ; « rejouée à l'identique » avance l'horloge entre les deux appels (sinon l'empreinte ne prouverait rien) ; les vingt-huit cas portés.
/**
 * L'ÉTAT RÉEL d'une rediffusion, et le filet qui la rattrape (D-12, lot 10B/10C).
 *
 * Chaque `describe` garde un défaut CONSTATÉ par l'audit du 2026-09-06 :
 *
 *  · l'unique source d'état était `egress_ended` — « LiveKit enregistre »
 *    n'existait dans aucun modèle, et l'hôte découvrait un échec en rouvrant
 *    la page une fois la conférence finie ;
 *  · `EGRESS_ABORTED` et `EGRESS_LIMIT_REACHED` tombaient dans « fichier
 *    absent » ;
 *  · une terminaison reçue AVANT `attachEgress` était absorbée (résolution par
 *    `by_egressId`) et la ligne restait `pending` POUR TOUJOURS ;
 *  · rien ne permettait de RETIRER une rediffusion ni d'en connaître
 *    l'échéance ;
 *  · `attachCaptions` n'avait aucun appelant hors test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { codeOf, enter, type Person, ruleOf, seed, type T, T0, tick } from "./fixtures.setup"
import { DIRECT_REPLAY_CAPTIONS_MAX_BYTES, DIRECT_REPLAY_PENDING_GIVE_UP_MS, DIRECT_REPLAY_RECONCILE_AFTER_MS } from "./replayComposition"

const S = api.modules.live.sessions
const R = internal.modules.live.replay
const importReplayCaptions = api.modules.live.livekitActions.importReplayCaptions

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function must<X>(value: X | null | undefined): X {
  if (value === null || value === undefined) throw new Error("valeur absente")
  return value
}

async function cast() {
  const t = testConvex()
  const { root } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  return { t, root, alice, bob }
}

/** Une conférence à rediffusion, DÉMARRÉE — la corrélation est optionnelle. */
async function directEnregistre(
  t: T,
  root: Id<"networks">,
  host: Person,
  options: { egressId?: string; stageFormat?: "television" | "computer" | "mobile" } = {},
): Promise<Id<"liveSessions">> {
  const created = await host.as.mutation(S.create, {
    networkId: root,
    title: "Conférence enregistrée",
    audience: "public",
    chatMode: "open",
    replay: true,
    ...(options.stageFormat !== undefined ? { stageFormat: options.stageFormat } : {}),
  })
  await host.as.mutation(S.goLive, { networkId: root, sessionId: created.sessionId })
  if (options.egressId !== undefined) {
    await t.mutation(R.attachEgress, { sessionId: created.sessionId, egressId: options.egressId })
  }
  return created.sessionId
}

const jobs = (t: T) => t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(500))

/** Les jobs planifiés PENDANT `action`, et rien d'autre. */
async function jobsPlanifiesPendant(t: T, action: () => Promise<unknown>): Promise<{ name: string; args: unknown[] }[]> {
  const avant = await jobs(t)
  await action()
  const apres = await jobs(t)
  return apres.slice(avant.length) as { name: string; args: unknown[] }[]
}

/** Joue les jobs DÉJÀ dus (analyse, arrêt de l'Egress, diffusion), jamais l'échéance des 90 jours. */
async function drainDueJobs(t: T): Promise<void> {
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1))
}

async function video(t: T): Promise<Id<"_storage">> {
  return await t.run((ctx) => ctx.storage.store(new Blob(["video"])))
}

// ═══════════════════════════════════════════════════════════════════════════

describe("10A — le format de scène VOYAGE jusqu'à l'Egress", () => {
  it("goLive planifie startDirectEgress AVEC le stageFormat de la session", async () => {
    const { t, root, alice } = await cast()
    const created = await alice.as.mutation(S.create, { networkId: root, title: "Verticale", audience: "public", chatMode: "open", replay: true, stageFormat: "mobile" })
    const nouvelles = await jobsPlanifiesPendant(t, () => alice.as.mutation(S.goLive, { networkId: root, sessionId: created.sessionId }))
    const egress = must(nouvelles.find((row) => row.name.includes("startDirectEgress")))
    // LE défaut : l'action ne recevait que `{ sessionId, roomName }`, donc
    // LiveKit composait sa grille 16:9 par défaut pour une scène verticale.
    expect(egress.args[0]).toMatchObject({ stageFormat: "mobile" })
  })

  it("une session sans format retombe sur `computer`, jamais sur rien", async () => {
    const { t, root, alice } = await cast()
    const created = await alice.as.mutation(S.create, { networkId: root, title: "Sans format", audience: "public", chatMode: "open", replay: true })
    const nouvelles = await jobsPlanifiesPendant(t, () => alice.as.mutation(S.goLive, { networkId: root, sessionId: created.sessionId }))
    expect(must(nouvelles.find((row) => row.name.includes("startDirectEgress"))).args[0]).toMatchObject({ stageFormat: "computer" })
  })

  it("attachEgress PHOTOGRAPHIE la composition demandée", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice)
    await t.mutation(R.attachEgress, { sessionId, egressId: "EG_COMPO", composition: { layout: "grid", width: 1080, height: 1920 } })
    await t.run(async (ctx) => {
      expect(must(await ctx.db.get(sessionId)).replayComposition).toEqual({ layout: "grid", width: 1080, height: 1920 })
    })
  })
})

describe("10B — l'état de la CAPTURE, pendant le direct", () => {
  it("markEgressState fait passer `requested` à `active`, et l'hôte le voit EN DIRECT", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_LIVE" })

    // Avant : la demande, et rien de plus.
    const avant = await alice.as.query(S.get, { networkId: root, sessionId })
    expect(avant.status).toBe("live")
    // LE défaut : `replay` n'était calculé que sur `status === "ended"`.
    expect(must(avant.replay).egressState).toBe("requested")

    expect(await t.mutation(R.markEgressState, { egressId: "EG_LIVE", state: "active" })).toEqual({ updated: true })
    const apres = await alice.as.query(S.get, { networkId: root, sessionId })
    expect(must(apres.replay).egressState).toBe("active")
    expect(must(apres.replay).url).toBeNull()
  })

  it("rejouée à l'identique, elle N'ÉCRIT PAS — la query est réactive pour toute la salle", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_IDEM" })
    await t.mutation(R.markEgressState, { egressId: "EG_IDEM", state: "active" })
    const empreinte = await t.run(async (ctx) => must(await ctx.db.get(sessionId)).updatedAt)
    // L'horloge avance : une écriture se verrait à l'empreinte.
    tick()
    expect(await t.mutation(R.markEgressState, { egressId: "EG_IDEM", state: "active" })).toEqual({ updated: false })
    await t.run(async (ctx) => {
      expect(must(await ctx.db.get(sessionId)).updatedAt).toBe(empreinte)
    })
  })

  it("TOUTE la salle sait qu'on enregistre — la restriction de replay ne cache pas la capture", async () => {
    /**
     * ⚠️ Deux gardes, deux questions. Après la fin, « ai-je le droit de LIRE
     * cette copie ? » (`directReplayAccessDecision`, inchangée). Pendant le
     * direct, il n'existe aucun fichier : la seule chose qu'on dise est « la
     * salle est enregistrée », et cela se dit à TOUT LE MONDE. Restreindre la
     * visibilité du replay ne doit pas servir à capter des gens sans le leur
     * dire.
     */
    const { t, root, alice } = await cast()
    const etranger = await enter(t, root, "etranger")
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_SALLE" })
    await alice.as.mutation(S.setReplayVisibility, { networkId: root, sessionId, visibility: "connections" })
    await t.mutation(R.markEgressState, { egressId: "EG_SALLE", state: "active" })

    const vue = must((await etranger.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.egressState).toBe("active")
    expect(vue.url).toBeNull()
    expect(vue.failureReason).toBeNull()
    expect(vue.canManage).toBe(false)

    // Une fois TERMINÉE, la restriction reprend ses droits : l'étranger ne
    // voit plus rien de la copie durable.
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await t.mutation(R.completeEgress, { egressId: "EG_SALLE", storageId: await video(t) })
    expect((await etranger.as.query(S.get, { networkId: root, sessionId })).replay).toBeNull()
  })

  it("un egressId INCONNU est absorbé — le webhook peut venir d'un autre déploiement", async () => {
    const t = testConvex()
    expect(await t.mutation(R.markEgressState, { egressId: "EG_D_UN_AUTRE_DEPLOIEMENT", state: "active" })).toEqual({ updated: false })
  })

  it("un replay ABOUTI n'est jamais dégradé par un événement en retard", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_PRET" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await t.mutation(R.completeEgress, { egressId: "EG_PRET", storageId: await video(t) })
    expect(await t.mutation(R.markEgressState, { egressId: "EG_PRET", state: "active" })).toEqual({ updated: false })
    expect(must((await alice.as.query(S.get, { networkId: root, sessionId })).replay).status).toBe("ready")
  })
})

describe("10B — trois motifs d'échec, et à qui on les dit", () => {
  it("ABORTED et LIMIT_REACHED deviennent des motifs NOMMÉS (des codes), servis à l'hôte seul", async () => {
    const { t, root, alice, bob } = await cast()
    vi.spyOn(console, "error").mockImplementation(() => {})
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_ABORT" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await t.mutation(R.completeEgress, { egressId: "EG_ABORT", failureReason: "egress_aborted" })

    const vueHote = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vueHote.status).toBe("failed")
    expect(vueHote.egressState).toBe("failed")
    expect(vueHote.failureReason).toBe("egress_aborted")
    expect(vueHote.canManage).toBe(true)

    // ADR-0158 — tant que l'hôte n'a rien décidé, la salle ne voit RIEN de
    // la rediffusion, pas même l'échec.
    expect((await bob.as.query(S.get, { networkId: root, sessionId })).replay).toBeNull()
    await alice.as.mutation(S.decideReplayPublication, { networkId: root, sessionId, decision: "published" })
    // Publiée, la salle apprend qu'il n'y aura pas de rediffusion — pas
    // POURQUOI : un motif de panne de service ne la regarde pas.
    const vueSalle = must((await bob.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vueSalle.status).toBe("failed")
    expect(vueSalle.failureReason).toBeNull()
    expect(vueSalle.canManage).toBe(false)
  })

  it("un succès EFFACE le motif d'un échec précédent", async () => {
    const { t, root, alice } = await cast()
    vi.spyOn(console, "error").mockImplementation(() => {})
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_RATTRAPE" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await t.mutation(R.completeEgress, { egressId: "EG_RATTRAPE", failureReason: "egress_failed" })
    await t.mutation(R.completeEgress, { egressId: "EG_RATTRAPE", storageId: await video(t) })
    const vue = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.status).toBe("ready")
    expect(vue.failureReason).toBeNull()
    expect(vue.retentionUntil).not.toBeNull()
  })
})

describe("10B — le filet : retard, doublon, INVERSION", () => {
  async function reculer(t: T, sessionId: Id<"liveSessions">, ageMs: number) {
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, { endedAt: Date.now() - ageMs })
    })
  }

  it("INVERSION — completeEgress AVANT attachEgress est absorbé, la ligne reste `pending`", async () => {
    const { t, root, alice } = await cast()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const sessionId = await directEnregistre(t, root, alice)
    // Le webhook arrive le premier : aucune corrélation en base.
    expect(await t.mutation(R.completeEgress, { egressId: "EG_INVERSE", durationMs: 1_000 })).toEqual({ found: false })
    await t.mutation(R.attachEgress, { sessionId, egressId: "EG_INVERSE" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await t.run(async (ctx) => {
      // Sans filet, cette ligne restait ici POUR TOUJOURS.
      expect(must(await ctx.db.get(sessionId)).replayStatus).toBe("pending")
    })

    await reculer(t, sessionId, DIRECT_REPLAY_RECONCILE_AFTER_MS + 60_000)
    const nouvelles = await jobsPlanifiesPendant(t, () => t.mutation(R.reconcileStalePending, {}))
    const relance = must(nouvelles.find((row) => row.name.includes("reconcileDirectEgress")))
    expect(relance.args[0]).toMatchObject({ egressId: "EG_INVERSE" })
  })

  it("un doublon de terminaison ne prolonge ni ne ressuscite rien", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_DOUBLE" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    const premier = await video(t)
    await t.mutation(R.completeEgress, { egressId: "EG_DOUBLE", storageId: premier, durationMs: 90_000 })
    const echeance = await t.run(async (ctx) => must(await ctx.db.get(sessionId)).replayRetentionUntil)

    // Rejeu : un SECOND blob arrive, il ne doit ni remplacer le premier ni
    // rester orphelin dans le stockage.
    tick()
    const second = await t.run((ctx) => ctx.storage.store(new Blob(["video-bis"])))
    expect(await t.mutation(R.completeEgress, { egressId: "EG_DOUBLE", storageId: second, durationMs: 90_000 })).toEqual({ found: true })
    const etat = await t.run(async (ctx) => ({
      session: must(await ctx.db.get(sessionId)),
      premier: await ctx.db.system.get("_storage", premier),
      second: await ctx.db.system.get("_storage", second),
    }))
    expect(etat.session.replayStorageId).toBe(premier)
    expect(etat.session.replayRetentionUntil).toBe(echeance)
    expect(etat.premier).not.toBeNull()
    expect(etat.second).toBeNull()
  })

  it("une ligne RÉCENTE n'est pas touchée — l'Egress finit d'écrire son fichier", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_FRAIS" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await reculer(t, sessionId, DIRECT_REPLAY_RECONCILE_AFTER_MS - 60_000)

    const nouvelles = await jobsPlanifiesPendant(t, () => t.mutation(R.reconcileStalePending, {}))
    expect(nouvelles.filter((row) => row.name.includes("reconcileDirectEgress"))).toEqual([])
    await t.run(async (ctx) => {
      expect(must(await ctx.db.get(sessionId)).replayStatus).toBe("pending")
    })
  })

  it("sans corrélation, on ABANDONNE en le DISANT — plus rien ne peut rattacher", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice)
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await reculer(t, sessionId, DIRECT_REPLAY_RECONCILE_AFTER_MS + 60_000)

    const bilan = await t.mutation(R.reconcileStalePending, {})
    expect(bilan.failed).toBe(1)
    const vue = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.status).toBe("failed")
    expect(vue.failureReason).toBe("never_started")
  })

  it("au bout de 24 h, on abandonne même AVEC une corrélation", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_VIEUX" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    await reculer(t, sessionId, DIRECT_REPLAY_PENDING_GIVE_UP_MS + 60_000)

    await t.mutation(R.reconcileStalePending, {})
    const vue = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.status).toBe("failed")
    expect(vue.failureReason).toBe("never_delivered")
  })

  it("le balayage pagine par lots de 50 et se re-planifie", async () => {
    const { t, root, alice } = await cast()
    const vieux = Date.now() - (DIRECT_REPLAY_RECONCILE_AFTER_MS + 60_000)
    await t.run(async (ctx) => {
      for (let i = 0; i < 55; i++) {
        await ctx.db.insert("liveSessions", {
          networkId: root,
          hostPersonId: alice.personId,
          title: `Conférence ${i}`,
          roomName: `direct-lot-${i}`,
          status: "ended",
          audience: "public",
          chatMode: "open",
          maxViewers: 100,
          replayRequested: true,
          replayStatus: "pending",
          createdAt: vieux,
          startedAt: vieux,
          endedAt: vieux + i,
          updatedAt: vieux,
        })
      }
    })

    const nouvelles = await jobsPlanifiesPendant(t, async () => {
      const bilan = await t.mutation(R.reconcileStalePending, {})
      expect(bilan.processed).toBe(50)
      expect(bilan.done).toBe(false)
    })
    expect(nouvelles.some((row) => row.name.includes("reconcileStalePending"))).toBe(true)
  })
})

describe("10C — gérer sa rediffusion : échéance, retrait, relance", () => {
  async function replayPret(t: T, root: Id<"networks">, host: Person) {
    const sessionId = await directEnregistre(t, root, host, { egressId: "EG_GEST" })
    await host.as.mutation(S.end, { networkId: root, sessionId })
    const videoId = await video(t)
    await t.mutation(R.completeEgress, { egressId: "EG_GEST", storageId: videoId, durationMs: 90_000 })
    // ADR-0158 — publiée par l'hôte, sinon la salle ne voit rien.
    await host.as.mutation(S.decideReplayPublication, { networkId: root, sessionId, decision: "published" })
    return { sessionId, videoId }
  }

  it("le DTO porte l'échéance, la visibilité effective et le droit de gérer", async () => {
    const { t, root, alice, bob } = await cast()
    const { sessionId } = await replayPret(t, root, alice)

    const hote = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(hote.retentionUntil).toBeGreaterThan(Date.now())
    expect(hote.visibility).toBe("public")
    expect(hote.canManage).toBe(true)
    expect(hote.url).toBeTruthy()

    const spectateur = must((await bob.as.query(S.get, { networkId: root, sessionId })).replay)
    // L'échéance n'est pas un secret : elle dit à la salle jusqu'à quand
    // revoir. Le DROIT de gérer, lui, ne se partage pas.
    expect(spectateur.retentionUntil).toBe(hote.retentionUntil)
    expect(spectateur.canManage).toBe(false)
  })

  it("withdrawReplay supprime les blobs, ferme la lecture ET la découverte", async () => {
    const { t, root, alice, bob } = await cast()
    const { sessionId, videoId } = await replayPret(t, root, alice)
    const captionsId = await t.run((ctx) => ctx.storage.store(new Blob(["WEBVTT"], { type: "text/vtt" })))
    await t.mutation(R.attachCaptions, { sessionId, storageId: captionsId, lang: "fr" })

    expect(await alice.as.mutation(S.withdrawReplay, { networkId: root, sessionId })).toEqual({ withdrawn: true })

    const etat = await t.run(async (ctx) => ({
      session: must(await ctx.db.get(sessionId)),
      video: await ctx.db.system.get("_storage", videoId),
      captions: await ctx.db.system.get("_storage", captionsId),
    }))
    expect(etat.session.replayStatus).toBe("expired")
    expect(etat.session.replayStorageId).toBeUndefined()
    expect(etat.session.replayCaptionsLang).toBeUndefined()
    expect(etat.session.replayPurgedAt).toBeDefined()
    expect(etat.video).toBeNull()
    expect(etat.captions).toBeNull()

    const vue = must((await bob.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.status).toBe("expired")
    expect(vue.url).toBeNull()
    expect((await bob.as.query(S.listReplays, { networkId: root })).items).toEqual([])
  })

  it("rejouée, elle ne fait rien ; refusée à qui ne gère pas", async () => {
    const { t, root, alice, bob } = await cast()
    const { sessionId } = await replayPret(t, root, alice)
    await alice.as.mutation(S.withdrawReplay, { networkId: root, sessionId })
    expect(await alice.as.mutation(S.withdrawReplay, { networkId: root, sessionId })).toEqual({ withdrawn: false })
    expect(await codeOf(bob.as.mutation(S.withdrawReplay, { networkId: root, sessionId }))).toBe("liveRoleRequired")
  })

  it("retryReplay planifie la réconciliation ; rien à relancer se DIT", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await directEnregistre(t, root, alice, { egressId: "EG_RETRY" })
    await alice.as.mutation(S.end, { networkId: root, sessionId })

    const nouvelles = await jobsPlanifiesPendant(t, () => alice.as.mutation(S.retryReplay, { networkId: root, sessionId }))
    expect(must(nouvelles.find((row) => row.name.includes("reconcileDirectEgress"))).args[0]).toMatchObject({ egressId: "EG_RETRY" })

    expect(await codeOf(bob.as.mutation(S.retryReplay, { networkId: root, sessionId }))).toBe("liveRoleRequired")

    await t.mutation(R.completeEgress, { egressId: "EG_RETRY", storageId: await video(t) })
    expect(await ruleOf(alice.as.mutation(S.retryReplay, { networkId: root, sessionId }))).toBe("LIVE_REPLAY_NOTHING_TO_RETRY")
  })

  it("« Mes conférences » porte enfin l'état de la rediffusion", async () => {
    // LE défaut : `listMine`/`listMinePage` n'exposaient AUCUN état de replay.
    // Un hôte dont l'Egress avait échoué n'avait aucun endroit où l'apprendre.
    const { t, root, alice } = await cast()
    const { sessionId } = await replayPret(t, root, alice)
    // ADR-0158 — l'enregistrement est le défaut : l'opt-out est EXPLICITE.
    const sansReplay = await alice.as.mutation(S.create, { networkId: root, title: "Sans enregistrement", audience: "public", chatMode: "open", replay: false })

    const mine = await alice.as.query(S.listMine, { networkId: root })
    const avec = must(mine.find((row) => String(row.sessionId) === String(sessionId)))
    expect(avec.replay).toMatchObject({ status: "ready", egressState: "ready" })
    expect(must(avec.replay).retentionUntil).toBeGreaterThan(Date.now())
    expect(must(mine.find((row) => String(row.sessionId) === String(sansReplay.sessionId))).replay).toBeNull()

    // `listMinePage` épuise live → programmé → terminé : la ligne à
    // rediffusion est dans le DERNIER statut, on suit donc le curseur.
    let cursor = undefined as { status: "live" | "scheduled" | "ended"; cursor: string | null } | undefined
    let vuAvecReplay = false
    for (let garde = 0; garde < 6; garde++) {
      const page = await alice.as.query(S.listMinePage, cursor === undefined ? { networkId: root } : { networkId: root, cursor })
      if (page.items.some((row) => row.replay?.egressState === "ready")) {
        vuAvecReplay = true
        break
      }
      if (page.nextCursor === null) break
      cursor = page.nextCursor
    }
    expect(vuAvecReplay).toBe(true)
  })
})

describe("10D — les sous-titres s'IMPORTENT, ils ne se fabriquent pas", () => {
  async function replayPret(t: T, root: Id<"networks">, host: Person) {
    const sessionId = await directEnregistre(t, root, host, { egressId: "EG_VTT" })
    await host.as.mutation(S.end, { networkId: root, sessionId })
    await t.mutation(R.completeEgress, { egressId: "EG_VTT", storageId: await video(t) })
    return sessionId
  }

  it("la PORTE laisse passer l'hôte et refuse la salle", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await replayPret(t, root, alice)
    expect(await alice.as.query(S.replayCaptionsIntake, { networkId: root, sessionId })).toEqual({ maxBytes: DIRECT_REPLAY_CAPTIONS_MAX_BYTES })
    expect(await codeOf(bob.as.query(S.replayCaptionsIntake, { networkId: root, sessionId }))).toBe("liveRoleRequired")
  })

  it("une rediffusion RETIRÉE ferme la porte", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice)
    await alice.as.mutation(S.withdrawReplay, { networkId: root, sessionId })
    expect(await ruleOf(alice.as.query(S.replayCaptionsIntake, { networkId: root, sessionId }))).toBe("LIVE_REPLAY_UNAVAILABLE")
  })

  it("un contenu qui n'est pas du WebVTT est refusé SANS rien stocker", async () => {
    /**
     * ⚠️ AUCUNE URL DE DÉPÔT n'est délivrée : le contenu voyage en texte et
     * n'est écrit qu'APRÈS vérification. Il n'existe donc à aucun instant de
     * blob non rattaché — ce que la politique de dépôt (`lib/uploadPolicy.ts`,
     * cliquet `upload-policy`) interdit précisément.
     */
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice)
    const avant = await t.run(async (ctx) => ctx.db.system.query("_storage").take(100))
    expect(await alice.as.action(importReplayCaptions, { networkId: root, sessionId, content: "Bonjour, ceci n'est pas une piste." })).toEqual({
      accepted: false,
      reason: "wrong_type",
    })
    const apres = await t.run(async (ctx) => ctx.db.system.query("_storage").take(100))
    expect(apres.length).toBe(avant.length)
  })

  it("un contenu VIDE ou TROP GROS est refusé, avec sa raison", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice)
    expect(await alice.as.action(importReplayCaptions, { networkId: root, sessionId, content: "" })).toEqual({ accepted: false, reason: "missing" })
    expect(await alice.as.action(importReplayCaptions, { networkId: root, sessionId, content: `WEBVTT\n${"x".repeat(DIRECT_REPLAY_CAPTIONS_MAX_BYTES)}` })).toEqual({
      accepted: false,
      reason: "too_large",
    })
  })

  it("une piste valide s'attache, et sa LANGUE est servie au lecteur", async () => {
    // ⚠️ `<track srcLang>` était codé en dur à « fr » : une piste anglaise
    // s'annonçait française à tout lecteur d'écran.
    const { t, root, alice } = await cast()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const sessionId = await replayPret(t, root, alice)
    expect(
      await alice.as.action(importReplayCaptions, {
        networkId: root,
        sessionId,
        content: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nBonjour.",
        lang: "en",
      }),
    ).toEqual({ accepted: true, reason: "ok" })
    // La piste vient d'un client : la garde des fichiers la juge avant de la servir.
    await drainDueJobs(t)
    const vue = must((await alice.as.query(S.get, { networkId: root, sessionId })).replay)
    expect(vue.captionsUrl).toBeTruthy()
    expect(vue.captionsLang).toBe("en")
  })

  it("une langue inconnue retombe sur le français, jamais dans `srcLang`", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice)
    await alice.as.action(importReplayCaptions, { networkId: root, sessionId, content: "WEBVTT", lang: "klingon" })
    expect(must((await alice.as.query(S.get, { networkId: root, sessionId })).replay).captionsLang).toBe("fr")
  })

  it("la piste est PURGÉE avec la vidéo, jamais après", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice)
    await alice.as.action(importReplayCaptions, { networkId: root, sessionId, content: "WEBVTT", lang: "fr" })
    const pisteId = await t.run(async (ctx) => must(await ctx.db.get(sessionId)).replayCaptionsStorageId)
    await alice.as.mutation(S.withdrawReplay, { networkId: root, sessionId })
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get("_storage", must(pisteId))).toBeNull()
    })
  })
})
