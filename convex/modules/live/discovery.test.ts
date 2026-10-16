// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/discovery.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, `enter`, `networkId` en argument : la découverte est celle d'UN réseau) ; relations et blocages posés par l'outillage du moteur (`connect`, `block`), exclusion par `moderation.ban` du moteur ; jeton `authorizeToken({ networkId, sessionId })` sous l'identité de la personne ; D28 — le compteur d'admis d'une vignette se lit dans `liveSessionCounters`, recomposé par la récolte (`reap.reapStaleDirects`) ; rapatriement de l'enregistrement par `replay.{attachEgress, completeEgress}` du moteur (motif d'échec en CODE, `egress_aborted`, au lieu d'une phrase), fichier rendu servable par la garde des fichiers (ligne d'analyse `generated` posée par le test quand le rapatriement n'en pose pas) ; débit `live.create` : les amorçages espacent leurs créations de 6 min ; état civil absent du moteur (le DTO n'a que le profil publié). Cas AJOUTÉS : la découverte d'un réseau ne montre jamais un direct d'un autre (V37) ; une conférence réservée aux abonnés d'une page n'apparaît qu'à son cercle. Aucun cas retiré.
/**
 * LA DÉCOUVERTE DES DIRECTS — `sessions.listLive` / `sessions.listReplays`.
 *
 * Ce que ce fichier tient, dans l'ordre :
 *
 *  1. **L'audience se juge PAR LECTEUR, jamais par l'index.** Les index de
 *     découverte ne portent que le réseau, `status` (et `replayStatus`) : un
 *     même direct `connections` est DANS la fenêtre de tout le réseau et n'en
 *     sort que pour ceux qui n'y ont pas droit.
 *  2. **Tout refus est SILENCIEUX.** Une liste qui lèverait apprendrait à un
 *     curieux qu'un direct réservé existe.
 *  3. **La fenêtre ne montre que ce qui SE JOUE dans CE réseau** : ni
 *     `scheduled`, ni `ended`, ni un direct d'ailleurs ; pour les replays,
 *     `ready` seul.
 *  4. **Le curseur suit la dernière ligne EXAMINÉE.** Une page dont la
 *     sélection écarte beaucoup ne doit ni perdre ni répéter de direct — y
 *     compris quand plusieurs directs partagent la même milliseconde.
 *  5. **Le DTO est une VIGNETTE** : ni `roomName`, ni `storageId`, ni URL de
 *     replay. Une liste ne distribue pas d'octets.
 */
import { GENERATED_BLOB_SKIP_REASON } from "@antia/social-domain/filePolicy"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { block, connect, enter, followPage, insertPage, joinAlso, type Person, seed, type T, T0, tick } from "./fixtures.setup"

const S = api.modules.live.sessions

/** Le seau `live.create` rend une création toutes les 6 min (10 par heure, 3 d'avance) : un amorçage espace les siennes. */
const CREATE_SPACING_MS = 6 * 60_000 + 1_000

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const etranger = await enter(t, root, "etranger")
  return { t, root, testClosed, alice, bob, etranger }
}

type Audience = "public" | "connections" | "followers"

async function creerDirect(
  networkId: Id<"networks">,
  host: Person,
  args: Partial<{ title: string; audience: Audience; pageId: Id<"pages">; stageFormat: "television" | "computer" | "mobile"; replay: boolean }> = {},
): Promise<Id<"liveSessions">> {
  tick(CREATE_SPACING_MS)
  const { title, audience, ...rest } = args
  const res = await host.as.mutation(S.create, { networkId, title: title ?? "Point hebdomadaire", audience: audience ?? "public", chatMode: "open", ...rest })
  return res.sessionId
}

async function demarrer(networkId: Id<"networks">, host: Person, sessionId: Id<"liveSessions">): Promise<void> {
  await host.as.mutation(S.goLive, { networkId, sessionId })
}

/**
 * Un direct EN COURS, dont l'heure de démarrage est CALÉE.
 *
 * `goLive` pose `Date.now()` : caler la clé sépare ce qui est vérifié — l'ordre
 * — de ce qui ne l'est pas — la vitesse du harnais.
 */
async function directEnCours(
  t: T,
  networkId: Id<"networks">,
  host: Person,
  opts: { startedAt: number; audience?: Audience; pageId?: Id<"pages">; title?: string; stageFormat?: "television" | "computer" | "mobile" },
): Promise<Id<"liveSessions">> {
  const { startedAt, ...rest } = opts
  const sessionId = await creerDirect(networkId, host, rest)
  await demarrer(networkId, host, sessionId)
  await t.run(async (ctx) => ctx.db.patch(sessionId, { startedAt }))
  return sessionId
}

/** Le fichier rapatrié est SERVABLE : la garde des fichiers le connaît (ligne `generated`), sinon elle le retient. */
async function rendreServable(t: T, networkId: Id<"networks">, storageId: Id<"_storage">): Promise<void> {
  await t.run(async (ctx) => {
    const scan = await ctx.db
      .query("fileScans")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first()
    if (scan) return
    const now = Date.now()
    await ctx.db.insert("fileScans", { storageId, status: "skipped", source: "generated", skipReason: GENERATED_BLOB_SKIP_REASON, networkId, attempts: 0, createdAt: now, updatedAt: now })
  })
}

/** Un replay MENÉ À TERME : Egress rattaché, fichier rapatrié, session close, copie PUBLIÉE par l'hôte. */
async function replayPret(
  t: T,
  networkId: Id<"networks">,
  host: Person,
  opts: { egressId: string; audience?: Audience; durationMs?: number; endedAt?: number; echec?: boolean },
): Promise<Id<"liveSessions">> {
  const sessionId = await creerDirect(networkId, host, { audience: opts.audience ?? "public", replay: true })
  await demarrer(networkId, host, sessionId)
  await t.mutation(internal.modules.live.replay.attachEgress, { sessionId, egressId: opts.egressId })
  const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["fausse video"])))
  await host.as.mutation(S.end, { networkId, sessionId })
  await t.mutation(internal.modules.live.replay.completeEgress, {
    egressId: opts.egressId,
    // Le motif est un CODE du vocabulaire fermé (lot des médias), plus une phrase.
    ...(opts.echec === true ? { failureReason: "egress_aborted" as const } : { storageId }),
    ...(opts.durationMs !== undefined ? { durationMs: opts.durationMs } : {}),
  })
  if (opts.echec !== true) await rendreServable(t, networkId, storageId)
  // ADR-0158 — la copie naît NON DÉCIDÉE : c'est l'hôte qui l'ouvre à
  // l'audience. Sans ce geste, la découverte ne la servirait à personne.
  await host.as.mutation(S.decideReplayPublication, { networkId, sessionId, decision: "published" })
  if (opts.endedAt !== undefined) {
    const endedAt = opts.endedAt
    await t.run(async (ctx) => ctx.db.patch(sessionId, { endedAt }))
  }
  return sessionId
}

const listLive = (reader: Person, networkId: Id<"networks">, args: { limit?: number; cursor?: { startedAt: number; sessionId: Id<"liveSessions"> } } = {}) =>
  reader.as.query(S.listLive, { networkId, ...args })

const listReplays = (reader: Person, networkId: Id<"networks">, args: { limit?: number; cursor?: { endedAt: number; sessionId: Id<"liveSessions"> } } = {}) =>
  reader.as.query(S.listReplays, { networkId, ...args })

const idsOf = (page: { items: { sessionId: Id<"liveSessions"> }[] }) => page.items.map((item) => item.sessionId)

// ═══════════════════════════════════════════════════════════════════════════

describe("listLive — l'audience se juge PAR LECTEUR", () => {
  it("un direct PUBLIC en cours est vu d'un membre sans lien avec l'hôte", async () => {
    const { t, root, alice, etranger } = await cast()
    const sessionId = await directEnCours(t, root, alice, { startedAt: 1_000 })

    const page = await listLive(etranger, root)
    expect(idsOf(page)).toEqual([sessionId])
    expect(page.items[0]?.host.displayName).toBe("alice")
    expect(page.items[0]?.audience).toBe("public")
  })

  it("un direct RÉSERVÉ AUX RELATIONS est absent chez un membre sans lien — en silence", async () => {
    const { t, root, alice, etranger } = await cast()
    await directEnCours(t, root, alice, { startedAt: 1_000, audience: "connections" })

    // Ni erreur, ni indice : la liste est simplement vide.
    const page = await listLive(etranger, root)
    expect(page.items).toEqual([])
    expect(page.nextCursor).toBeNull()
  })

  it("le MÊME direct réservé est visible d'une relation acceptée", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await directEnCours(t, root, alice, { startedAt: 1_000, audience: "connections" })

    expect(idsOf(await listLive(bob, root))).toEqual([sessionId])
  })

  it("l'hôte voit LE SIEN, public comme réservé", async () => {
    const { t, root, alice } = await cast()
    const publicId = await directEnCours(t, root, alice, { startedAt: 2_000 })
    const priveId = await directEnCours(t, root, alice, { startedAt: 1_000, audience: "connections" })

    expect(idsOf(await listLive(alice, root))).toEqual([publicId, priveId])
  })

  it("un blocage posé par LE LECTEUR écarte le direct", async () => {
    const { t, root, alice, bob } = await cast()
    await directEnCours(t, root, alice, { startedAt: 1_000 })

    expect((await listLive(bob, root)).items).toHaveLength(1)
    await block(t, root, bob, alice)
    expect((await listLive(bob, root)).items).toEqual([])
  })

  it("un blocage posé par L'HÔTE écarte aussi le direct — il ferme dans les deux sens", async () => {
    const { t, root, alice, bob } = await cast()
    await directEnCours(t, root, alice, { startedAt: 1_000 })

    expect((await listLive(bob, root)).items).toHaveLength(1)
    await block(t, root, alice, bob)
    expect((await listLive(bob, root)).items).toEqual([])
  })

  it("une personne EXCLUE ne retrouve plus le direct dans la liste", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await directEnCours(t, root, alice, { startedAt: 1_000 })

    expect(idsOf(await listLive(bob, root))).toEqual([sessionId])
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect((await listLive(bob, root)).items).toEqual([])
    // L'exclusion est PAR SESSION : l'hôte, lui, garde la sienne.
    expect(idsOf(await listLive(alice, root))).toEqual([sessionId])
  })

  it("une conférence réservée aux ABONNÉS d'une page n'apparaît qu'à son cercle", async () => {
    const { t, root, alice, bob, etranger } = await cast()
    const pageId = await insertPage(t, root, alice)
    await followPage(t, pageId, bob)
    const sessionId = await directEnCours(t, root, alice, { startedAt: 1_000, audience: "followers", pageId })

    // Abonné : préchargé par les pages suivies, une seule lecture pour la page.
    expect(idsOf(await listLive(bob, root))).toEqual([sessionId])
    // Signataire (l'hôte) : relu par candidat.
    expect(idsOf(await listLive(alice, root))).toEqual([sessionId])
    expect((await listLive(etranger, root)).items).toEqual([])
  })
})

describe("listLive — la fenêtre ne montre que ce qui SE JOUE, dans CE réseau", () => {
  it("un direct PROGRAMMÉ n'apparaît jamais", async () => {
    const { root, alice, etranger } = await cast()
    await creerDirect(root, alice) // créé, jamais démarré

    expect((await listLive(etranger, root)).items).toEqual([])
    // Pas même pour son hôte : cet onglet répond « en ce moment », pas « à moi ».
    expect((await listLive(alice, root)).items).toEqual([])
  })

  it("un direct TERMINÉ sort de la liste dès sa clôture", async () => {
    const { t, root, alice, etranger } = await cast()
    const sessionId = await directEnCours(t, root, alice, { startedAt: 1_000 })

    expect((await listLive(etranger, root)).items).toHaveLength(1)
    await alice.as.mutation(S.end, { networkId: root, sessionId })
    expect((await listLive(etranger, root)).items).toEqual([])
  })

  it("l'ordre est le plus récemment commencé D'ABORD", async () => {
    const { t, root, alice, etranger } = await cast()
    const vieux = await directEnCours(t, root, alice, { startedAt: 1_000 })
    const recent = await directEnCours(t, root, alice, { startedAt: 3_000 })
    const median = await directEnCours(t, root, alice, { startedAt: 2_000 })

    expect(idsOf(await listLive(etranger, root))).toEqual([recent, median, vieux])
  })

  it("un direct d'un AUTRE réseau n'apparaît jamais — ni en direct, ni en rediffusion (V37)", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const ailleurs = await directEnCours(t, testClosed, alice, { startedAt: 1_000 })
    const ici = await directEnCours(t, root, alice, { startedAt: 2_000 })

    expect(idsOf(await listLive(bob, root))).toEqual([ici])
    expect(idsOf(await listLive(bob, testClosed))).toEqual([ailleurs])
    // L'hôte non plus ne voit pas, d'ici, ce qu'il joue ailleurs.
    expect(idsOf(await listLive(alice, root))).toEqual([ici])

    const replayAilleurs = await replayPret(t, testClosed, alice, { egressId: "EG_AILLEURS", endedAt: 3_000 })
    expect((await listReplays(bob, root)).items).toEqual([])
    expect(idsOf(await listReplays(bob, testClosed))).toEqual([replayAilleurs])
  })
})

describe("listLive — le curseur ne perd ni ne répète", () => {
  it("douze directs se lisent en trois pages, sans trou ni doublon", async () => {
    const { t, root, alice, etranger } = await cast()

    const attendus: Id<"liveSessions">[] = []
    // Créés du plus ancien au plus récent, attendus dans l'ordre INVERSE.
    for (let i = 0; i < 12; i++) {
      attendus.unshift(await directEnCours(t, root, alice, { startedAt: 10_000 + i, title: `Direct ${i}` }))
    }

    const vus: Id<"liveSessions">[] = []
    let cursor: { startedAt: number; sessionId: Id<"liveSessions"> } | null = null
    let pages = 0
    do {
      const page: Awaited<ReturnType<typeof listLive>> = await listLive(etranger, root, { limit: 5, ...(cursor !== null ? { cursor } : {}) })
      vus.push(...idsOf(page))
      cursor = page.nextCursor
      pages++
      expect(pages).toBeLessThanOrEqual(5) // filet anti-boucle
    } while (cursor !== null)

    expect(vus).toEqual(attendus)
    expect(new Set(vus).size).toBe(12)
    expect(pages).toBe(3)
  })

  it("le curseur suit la dernière ligne EXAMINÉE, pas la fin de la fenêtre", async () => {
    const { t, root, alice, etranger } = await cast()

    // Alternance public / réservé : chaque page écarte des candidats AVANT
    // d'en servir un. Un curseur ancré sur la fin de la fenêtre sauterait
    // par-dessus les publics restants — un trou muet.
    const p3 = await directEnCours(t, root, alice, { startedAt: 5_000 })
    await directEnCours(t, root, alice, { startedAt: 4_000, audience: "connections" })
    const p2 = await directEnCours(t, root, alice, { startedAt: 3_000 })
    await directEnCours(t, root, alice, { startedAt: 2_000, audience: "connections" })
    const p1 = await directEnCours(t, root, alice, { startedAt: 1_000 })

    const page1 = await listLive(etranger, root, { limit: 1 })
    expect(idsOf(page1)).toEqual([p3])
    if (!page1.nextCursor) throw new Error("curseur attendu")
    const page2 = await listLive(etranger, root, { limit: 1, cursor: page1.nextCursor })
    expect(idsOf(page2)).toEqual([p2])
    if (!page2.nextCursor) throw new Error("curseur attendu")
    const page3 = await listLive(etranger, root, { limit: 1, cursor: page2.nextCursor })
    expect(idsOf(page3)).toEqual([p1])

    /**
     * Une page PLEINE ne prouve jamais qu'il n'y a plus rien : la boucle est
     * sortie à `limit`, donc le curseur est rendu — même si la fenêtre était,
     * de fait, épuisée. C'est la page SUIVANTE qui referme le défilement.
     */
    if (!page3.nextCursor) throw new Error("curseur attendu")
    const page4 = await listLive(etranger, root, { limit: 1, cursor: page3.nextCursor })
    expect(page4.items).toEqual([])
    expect(page4.nextCursor).toBeNull()
  })

  it("des directs commencés dans la MÊME milliseconde ne se perdent pas à la frontière", async () => {
    const { t, root, alice, etranger } = await cast()

    const memeInstant: Id<"liveSessions">[] = []
    for (let i = 0; i < 4; i++) {
      memeInstant.push(await directEnCours(t, root, alice, { startedAt: 7_000, title: `Ex ${i}` }))
    }

    const page1 = await listLive(etranger, root, { limit: 2 })
    expect(page1.items).toHaveLength(2)
    if (!page1.nextCursor) throw new Error("curseur attendu")
    const page2 = await listLive(etranger, root, { limit: 2, cursor: page1.nextCursor })
    const vus = [...idsOf(page1), ...idsOf(page2)]
    expect(new Set(vus).size).toBe(4)
    expect(new Set(vus)).toEqual(new Set(memeInstant))
  })
})

describe("listLive — le DTO est une VIGNETTE", () => {
  it("ni roomName, ni storageId ne sortent ; la liste exacte des clés est verrouillée", async () => {
    const { t, root, alice, etranger } = await cast()
    await directEnCours(t, root, alice, { startedAt: 1_000 })

    const carte = (await listLive(etranger, root)).items[0]
    if (!carte) throw new Error("vignette attendue")
    expect(Object.keys(carte).sort()).toEqual(["audience", "counters", "host", "isHost", "sessionId", "stageFormat", "startedAt", "title"])
    const serialise = JSON.stringify(carte)
    expect(serialise).not.toContain("roomName")
    expect(serialise).not.toContain("direct-") // le préfixe des salles LiveKit
    expect(serialise).not.toContain("storageId")
  })

  it("isHost est exact pour chacun des deux lecteurs", async () => {
    const { t, root, alice, bob } = await cast()
    await directEnCours(t, root, alice, { startedAt: 2_000, stageFormat: "television" })
    await directEnCours(t, root, bob, { startedAt: 1_000 })

    const vueAlice = await listLive(alice, root)
    expect(vueAlice.items.map((item) => item.isHost)).toEqual([true, false])
    expect(vueAlice.items[0]?.stageFormat).toBe("television")

    const vueBob = await listLive(bob, root)
    expect(vueBob.items.map((item) => item.isHost)).toEqual([false, true])
  })

  it("le compteur de spectateurs est celui des ADMIS, recomposé par la récolte, et il porte ce nom", async () => {
    const { t, root, alice, bob } = await cast()
    // Un démarrage RÉCENT : la récolte fermerait un direct calé en 1970 (limite des 4 h).
    const sessionId = await directEnCours(t, root, alice, { startedAt: Date.now() })

    expect((await listLive(alice, root)).items[0]?.counters).toEqual({ viewerGrantCount: 0, comments: 0, reactions: 0 })

    // Une admission de spectateur — puis une SECONDE demande de jeton du même
    // compte, qui ne doit rien ajouter (c'est un compte d'admis, pas d'entrées).
    await bob.as.mutation(internal.modules.live.access.authorizeToken, { networkId: root, sessionId })
    tick()
    await bob.as.mutation(internal.modules.live.access.authorizeToken, { networkId: root, sessionId })
    // D28 — l'admission n'écrit pas les compteurs servis : la récolte les recompose.
    expect((await listLive(alice, root)).items[0]?.counters.viewerGrantCount).toBe(0)
    await t.mutation(internal.modules.live.reap.reapStaleDirects, {})
    expect((await listLive(alice, root)).items[0]?.counters.viewerGrantCount).toBe(1)
  })
})

describe("listReplays — ce qui est PRÊT, et pour qui", () => {
  it("seuls les replays PRÊTS sont servis — ni pending, ni failed", async () => {
    const { t, root, alice, etranger } = await cast()

    const pret = await replayPret(t, root, alice, { egressId: "EG_OK", durationMs: 90_000, endedAt: 3_000 })
    await replayPret(t, root, alice, { egressId: "EG_KO", echec: true })
    // Un Egress rattaché mais jamais terminé reste `pending`.
    const enAttente = await creerDirect(root, alice, { replay: true })
    await demarrer(root, alice, enAttente)
    await t.mutation(internal.modules.live.replay.attachEgress, { sessionId: enAttente, egressId: "EG_PENDING" })
    await alice.as.mutation(S.end, { networkId: root, sessionId: enAttente })

    expect(idsOf(await listReplays(etranger, root))).toEqual([pret])
  })

  it("une visibilité restreinte aux relations ferme le replay aux autres", async () => {
    const { t, root, alice, bob, etranger } = await cast()
    await connect(t, root, alice, bob)

    const sessionId = await replayPret(t, root, alice, { egressId: "EG_PUB", audience: "public", endedAt: 3_000 })
    // Public tant que rien ne le restreint : le membre sans lien le voit.
    expect(idsOf(await listReplays(etranger, root))).toEqual([sessionId])

    await alice.as.mutation(S.setReplayVisibility, { networkId: root, sessionId, visibility: "connections" })
    // La restriction se juge à la LECTURE : le membre sans lien perd le replay, la relation le garde.
    expect((await listReplays(etranger, root)).items).toEqual([])
    expect(idsOf(await listReplays(bob, root))).toEqual([sessionId])
  })

  it("l'hôte voit son propre replay, même refermé sur ses relations", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await replayPret(t, root, alice, { egressId: "EG_PRIVE", audience: "connections", endedAt: 3_000 })

    const page = await listReplays(alice, root)
    expect(idsOf(page)).toEqual([sessionId])
    expect(page.items[0]?.isHost).toBe(true)
  })

  it("un exclu ne retrouve pas le replay, alors même que le direct était public", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await replayPret(t, root, alice, { egressId: "EG_BAN", endedAt: 3_000 })

    expect(idsOf(await listReplays(bob, root))).toEqual([sessionId])
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect((await listReplays(bob, root)).items).toEqual([])
  })

  it("un blocage ferme le replay dans les deux sens", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await replayPret(t, root, alice, { egressId: "EG_BLOC", endedAt: 3_000 })

    expect(idsOf(await listReplays(bob, root))).toEqual([sessionId])
    await block(t, root, bob, alice)
    expect((await listReplays(bob, root)).items).toEqual([])
  })

  it("AUCUNE URL de replay ne sort de la liste — la vignette porte endedAt et durationMs", async () => {
    const { t, root, alice, etranger } = await cast()
    const sessionId = await replayPret(t, root, alice, { egressId: "EG_URL", durationMs: 90_000, endedAt: 4_242 })

    const carte = (await listReplays(etranger, root)).items[0]
    if (!carte) throw new Error("vignette attendue")
    expect(Object.keys(carte).sort()).toEqual(["audience", "counters", "durationMs", "endedAt", "host", "isHost", "sessionId", "stageFormat", "startedAt", "title"])
    expect(carte.endedAt).toBe(4_242)
    expect(carte.durationMs).toBe(90_000)
    const serialise = JSON.stringify(carte)
    expect(serialise).not.toContain("http")
    expect(serialise).not.toContain("storageId")

    // L'octet, lui, s'obtient sur la PAGE, derrière la garde de `get`.
    const vue = await etranger.as.query(S.get, { networkId: root, sessionId })
    expect(vue.replay?.url).toBeTruthy()
  })

  it("l'ordre est le plus récemment terminé d'abord, et la durée absente vaut null", async () => {
    const { t, root, alice, etranger } = await cast()

    const vieux = await replayPret(t, root, alice, { egressId: "EG_A", endedAt: 1_000, durationMs: 30_000 })
    // Egress terminé SANS durée rapportée : la carte ne l'invente pas.
    const recent = await replayPret(t, root, alice, { egressId: "EG_B", endedAt: 3_000 })

    const page = await listReplays(etranger, root)
    expect(idsOf(page)).toEqual([recent, vieux])
    expect(page.items[0]?.durationMs).toBeNull()
    expect(page.items[1]?.durationMs).toBe(30_000)
  })

  it("les replays se paginent aussi, sans trou ni doublon", async () => {
    const { t, root, alice, etranger } = await cast()

    const attendus: Id<"liveSessions">[] = []
    for (let i = 0; i < 5; i++) {
      attendus.unshift(await replayPret(t, root, alice, { egressId: `EG_P${i}`, endedAt: 20_000 + i }))
    }

    const page1 = await listReplays(etranger, root, { limit: 2 })
    if (!page1.nextCursor) throw new Error("curseur attendu")
    const page2 = await listReplays(etranger, root, { limit: 2, cursor: page1.nextCursor })
    if (!page2.nextCursor) throw new Error("curseur attendu")
    const page3 = await listReplays(etranger, root, { limit: 2, cursor: page2.nextCursor })
    expect([...idsOf(page1), ...idsOf(page2), ...idsOf(page3)]).toEqual(attendus)
    expect(page3.nextCursor).toBeNull()
  })
})
