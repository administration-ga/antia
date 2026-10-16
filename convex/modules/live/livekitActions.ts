"use node"
// Dupliqué de socle/convex/actions/livekitDirect.ts @ ad2e7fdc2 — adaptations : module du direct (`modules/live`), références internes du moteur (`access`, `replay`, `speakers`, `sessions`, `lib/livekitEgress*`), `liveSessions`/`liveSpeakers` au lieu de `direct_*` ; `requestDirectToken` BORNÉE par le réseau (`networkAction`, sur le modèle de `calls/livekitActions.requestToken`) — l'autorisation (`access.authorizeToken`) reçoit le réseau et lit l'identité de l'action (plus de `authSubject` en argument), le jeton porte la PERSONNE en attributs (et en métadonnées de repli) et le nom du profil publié s'il y en a un ; `importReplayCaptions` bornée par le réseau, sa porte (`sessions.replayCaptionsIntake`) reçoit le réseau, la pièce part à la garde des fichiers avec son déposant (`attachCaptions.uploadedByPersonId`), refus de piste validés (`DIRECT_REPLAY_CAPTIONS_REFUSALS`) ; erreur à code (`unauthenticated`) au lieu de `new Error("NOT_AUTHENTICATED")` ; MOTIFS de rediffusion → CODES (`replayComposition`) — le détail technique d'un échec (abandon, fin pendant la boucle, rapatriement raté) part au journal du serveur ; configuration Egress FACTORISÉE : les clés et l'adresse viennent de `getLiveKitConfig` seul (fini la relecture de l'environnement de `hasEgressEnv`), le client de salle et le client Egress sont construits par deux aides (`roomServiceFor`, `egressClientFor`, `LIVEKIT_EGRESS_URL` lue en une place, rognée comme les autres variables).
/**
 * LiveKit pour le DIRECT (module `live`) — jetons, SFU, Egress.
 *
 * Seul le TRANSPORT LiveKit est partagé avec les appels (mêmes variables,
 * même réveil) : ce fichier ne lit JAMAIS `calls`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUN JETON AVANT VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `requestDirectToken` délègue TOUTES les vérifications à la mutation interne
 * `access.authorizeToken` — fail-closed, dans l'ordre : adhésion, session live
 * du réseau, audience, blocage, exclusion, débit, rôle, capacité. Le réveil
 * LiveKit vient APRÈS (un visiteur refusé ne rallume pas le serveur), la
 * construction du jeton en dernier.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `RoomServiceClient`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `livekit-server-sdk` exporte `RoomServiceClient` avec `listParticipants`,
 * `removeParticipant`, `mutePublishedTrack`, `deleteRoom` et `listRooms`. Ses
 * échecs sont JOURNALISÉS, jamais levés : la base durable a déjà décidé, le
 * TTL du jeton (1 h) est le filet.
 */
import { randomUUID } from "node:crypto"

import { v } from "convex/values"
import { AccessToken, EgressClient, RoomServiceClient, TrackSource } from "livekit-server-sdk"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { networkAction } from "../../lib/functions"
import { getLiveKitConfig } from "../../lib/livekit"
import { transferEgressFileToStorage } from "../../lib/livekitEgressFileTransfer"
import { buildDirectEgressFilepath } from "../../lib/livekitEgressRouting"
import { egressUploadUrl } from "../../lib/livekitEgressUploads"
import { egressDurationNsToMs } from "../../lib/livekitEgressWebhook"
import { ensureLiveKitAwake } from "../../lib/livekitWake"
import { literals } from "../../lib/validators"
import { buildDirectIdentity, DIRECT_TOKEN_TTL_SECONDS, directIdentityPrefix, identityBelongsToSubject, speakerGrant, viewerGrant } from "./grants"
// Module PUR partagé avec la mutation, le DTO et le webhook : la composition
// et la lecture d'un statut LiveKit n'ont qu'UNE définition (lot 10A/10B).
import {
  DIRECT_REPLAY_CAPTIONS_REFUSALS,
  type DirectEgressStartFailure,
  type DirectReplayCaptionsRefusal,
  type DirectReplayFailureReason,
  directEgressComposition,
  directEgressCompositeOptions,
  directEgressEndedBeforeStartReason,
  directEgressOutcomeFromStatus,
  directEgressStartGiveUpReason,
  directEgressStartVerdict,
  directReplayTransferFailureReason,
  nextDirectEgressStartFailure,
  normalizeDirectReplayCaptionsLang,
} from "./replayComposition"
import { directConnectionRoleValidator, directStageFormatValidator } from "./validators"

type LiveKitConfig = ReturnType<typeof getLiveKitConfig>

/**
 * La configuration LiveKit du déploiement, ou `null` s'il n'en a pas — UNE
 * lecture de l'environnement, celle de `getLiveKitConfig` (le socle relisait
 * les trois variables à part pour savoir si l'Egress était possible).
 */
function liveKitConfigOrNull(): LiveKitConfig | null {
  try {
    return getLiveKitConfig()
  } catch {
    return null
  }
}

/**
 * L'API Room parle au SERVEUR LiveKit lui-même (ws→http) — jamais à
 * l'override Egress, qui peut viser un autre hôte.
 */
function roomServiceFor(config: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(config.wsUrl.replace(/^ws/, "http"), config.apiKey, config.apiSecret)
}

/**
 * Le client du service d'enregistrement : `LIVEKIT_EGRESS_URL` s'il est posé
 * (facultatif : un service d'enregistrement hébergé ailleurs), sinon le
 * serveur lui-même (ws→http). Jamais d'adresse écrite ici.
 */
function egressClientFor(config: LiveKitConfig): EgressClient {
  const egressUrl = process.env.LIVEKIT_EGRESS_URL?.trim() || config.wsUrl.replace(/^ws/, "http")
  return new EgressClient(egressUrl, config.apiKey, config.apiSecret)
}

/**
 * Jeton d'entrée dans un direct — spectateur ou intervenant, la BASE décide.
 *
 * Le grant vient de `grants.ts` (module pur) : spectateur `hidden`, sans
 * publication, sans données, sources VIDES ; intervenant ouvert. TTL une heure
 * pour tous — filet de la rétrogradation. La PERSONNE voyage dans les
 * attributs du participant : l'écran pose chaque vidéo sur sa vignette.
 */
export const requestDirectToken = networkAction({
  args: { sessionId: v.id("liveSessions") },
  returns: v.object({ token: v.string(), roomName: v.string(), wsUrl: v.string(), role: directConnectionRoleValidator }),
  handler: async (ctx, args): Promise<{ token: string; roomName: string; wsUrl: string; role: "viewer" | "speaker" }> => {
    // TOUTE la validation, transactionnelle (l'admission s'y écrit) — la
    // connaissance d'un sessionId n'ouvre rien.
    const authorized = await ctx.runMutation(internal.modules.live.access.authorizeToken, {
      networkId: ctx.networkId,
      sessionId: args.sessionId,
    })

    const { apiKey, apiSecret, wsUrl } = getLiveKitConfig()
    // Réveil APRÈS l'autorisation, jamais avant (règle de `livekitWake.ts`).
    await ensureLiveKitAwake(wsUrl)

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return fail("unauthenticated")
    const participantIdentity = buildDirectIdentity({
      role: authorized.role,
      subject: identity.subject,
      nonce: randomUUID().slice(0, 8),
    })

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      ttl: DIRECT_TOKEN_TTL_SECONDS,
      ...(authorized.displayName !== null ? { name: authorized.displayName } : {}),
      attributes: { personId: authorized.personId },
      // Repli pour un serveur antérieur aux attributs de participant.
      metadata: JSON.stringify({ personId: authorized.personId }),
    })
    token.addGrant(authorized.role === "viewer" ? viewerGrant(authorized.roomName) : speakerGrant(authorized.roomName))

    return {
      token: await token.toJwt(),
      roomName: authorized.roomName,
      wsUrl,
      role: authorized.role,
    }
  },
})

/**
 * Applique au SFU l'état que la base a DÉJÀ décidé — exclusion ou reconnexion
 * obligatoire. Planifiée par les mutations (`runAfter(0, …)`), jamais appelée
 * avant leur commit. Aucune permission n'est élargie à chaud.
 *
 * Les connexions de la personne sont retrouvées par PRÉFIXE d'identité
 * (`direct-v_{subject}::` / `direct-s_{subject}::`) — c'est la raison d'être
 * du sujet en préfixe. Échec ⇒ journal + rien : le TTL est le filet.
 */
export const applyDirectSfuState = internalAction({
  args: {
    roomName: v.string(),
    /** Le sujet d'auth de la personne (préfixe de ses identités LiveKit). */
    subject: v.string(),
    mode: v.union(v.literal("kick"), v.literal("rejoin")),
    /** `rejoin` ne coupe QUE l'ancien rôle, jamais le nouveau jeton en course. */
    disconnectRole: v.optional(directConnectionRoleValidator),
    /** Ligne + époque à valider/acquitter — requises pour un rejoin. */
    speakerId: v.optional(v.id("liveSpeakers")),
    epoch: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.mode === "rejoin" && (args.disconnectRole === undefined || args.speakerId === undefined || args.epoch === undefined)) {
      // Fail-closed : sans transition complète, cibler un préfixe pourrait
      // expulser une connexion qui appartient déjà à l'époque suivante.
      console.error("[direct] applyDirectSfuState(rejoin) incomplet")
      return null
    }
    let applied = false
    try {
      const rooms = roomServiceFor(getLiveKitConfig())

      const participants = await rooms.listParticipants(args.roomName)
      const mine = participants.filter((participant) =>
        args.mode === "rejoin" && args.disconnectRole
          ? participant.identity.startsWith(directIdentityPrefix({ role: args.disconnectRole, subject: args.subject }))
          : identityBelongsToSubject(participant.identity, args.subject),
      )

      if (args.mode === "rejoin" && args.disconnectRole !== undefined && args.speakerId !== undefined && args.epoch !== undefined) {
        // La capture précède la relecture : si l'époque change juste APRÈS,
        // une nouvelle connexion possède un autre nonce et n'est pas dans
        // `mine`. Si elle a changé AVANT, la garde refuse toute expulsion.
        const current: boolean = await ctx.runQuery(internal.modules.live.speakers.isSfuRejoinCurrent, {
          speakerId: args.speakerId,
          epoch: args.epoch,
          roomName: args.roomName,
          subject: args.subject,
          disconnectRole: args.disconnectRole,
        })
        if (!current) return null
      }

      if (mine.length === 0) {
        // Personne dans la salle : la base fera foi au prochain jeton. Un
        // kick sans présence est un succès (il n'y a personne à sortir).
        applied = args.mode === "kick" || args.mode === "rejoin"
      } else {
        for (const participant of mine) {
          await rooms.removeParticipant(args.roomName, participant.identity)
        }
        applied = true
      }
    } catch (err) {
      // JAMAIS de throw : la base durable a décidé, le TTL (1 h) fera le
      // reste si le SFU reste injoignable.
      console.error(`[direct] applyDirectSfuState(${args.mode}) en échec sur ${args.roomName} :`, err)
    }

    // L'acquittement compare l'ÉPOQUE — un écho en retard est ignoré.
    if (applied && args.speakerId !== undefined && args.epoch !== undefined) {
      await ctx.runMutation(internal.modules.live.speakers.markSfuApplied, {
        speakerId: args.speakerId,
        epoch: args.epoch,
      })
    }
    return null
  },
})

/**
 * COUPER le micro d'un intervenant, à distance — jamais l'ouvrir.
 *
 * ⚠️ La dissymétrie est la doctrine, pas une limite du SDK :
 * `mutePublishedTrack(..., false)` existe et rouvrirait un micro sans que son
 * porteur l'ait demandé. Un modérateur FERME, la personne rouvre elle-même —
 * et son client adopte l'état RÉEL de sa piste, que LiveKit lui notifie.
 *
 * Les connexions de la personne sont retrouvées par PRÉFIXE d'identité
 * `speaker` (`direct-s_{subject}::`) : un spectateur n'a aucune piste publiée,
 * et cibler les deux rôles ne ferait qu'élargir la recherche pour rien.
 * Seules les pistes de source MICROPHONE sont coupées — la caméra et le
 * partage d'écran ne sont pas visés par ce geste.
 *
 * Échec ⇒ journal + `null`, comme les actions voisines : la base durable n'a
 * RIEN écrit ici (couper un micro est un acte de transport, pas un état
 * durable), et l'hôte peut redemander le geste.
 */
export const muteDirectMicrophone = internalAction({
  args: {
    roomName: v.string(),
    /** Le sujet d'auth de la personne (préfixe de ses identités LiveKit). */
    subject: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    try {
      const rooms = roomServiceFor(getLiveKitConfig())
      const participants = await rooms.listParticipants(args.roomName)
      const prefix = directIdentityPrefix({ role: "speaker", subject: args.subject })
      for (const participant of participants) {
        if (!participant.identity.startsWith(prefix)) continue
        for (const track of participant.tracks) {
          if (track.source !== TrackSource.MICROPHONE) continue
          await rooms.mutePublishedTrack(args.roomName, participant.identity, track.sid, true)
        }
      }
    } catch (err) {
      // JAMAIS de throw : rien n'a été écrit en base, et un SFU injoignable
      // ne doit pas faire échouer la mutation qui a planifié ce geste.
      console.error(`[direct] muteDirectMicrophone en échec sur ${args.roomName} :`, err)
    }
    return null
  },
})

/** Ferme une salle entière après révocation de la page qui la porte. */
export const closeDirectRoom = internalAction({
  args: { roomName: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    try {
      await roomServiceFor(getLiveKitConfig()).deleteRoom(args.roomName)
    } catch (err) {
      // La base a déjà terminé la session ; le SFU est un effet secondaire.
      console.error(`[direct] fermeture de ${args.roomName} en échec :`, err)
    }
    return null
  },
})

const startOutcomeValidator = v.object({
  status: v.union(
    v.literal("stub"),
    v.literal("already_started"),
    v.literal("not_wanted"),
    v.literal("ended_before_start"),
    v.literal("started"),
    v.literal("retry_scheduled"),
    v.literal("failed"),
  ),
})

/**
 * Démarre l'enregistrement du direct (RoomCompositeEgress, vidéo). Le
 * filepath `directs/{sessionId}.mp4` est LE contrat du webhook
 * (`lib/livekitEgressRouting.ts`) : c'est lui qui ramène le fichier au replay.
 * Rapporte l'egressId (ou l'échec) à `replay.attachEgress`.
 *
 * ⚠️ D-12 / lot 10A — LA COMPOSITION EST DITE. Le troisième argument était
 * vide : aucun `layout`, aucun `encodingOptions`, donc le gabarit par défaut
 * de LiveKit (grille 16:9) quel que soit le `stageFormat` choisi à la
 * création. Les options viennent de `replayComposition.ts` (module PUR, testé)
 * et sont PHOTOGRAPHIÉES en base par `attachEgress`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ADR-0158 — ELLE ATTEND LA SALLE ET RÉVEILLE LE SERVEUR, AU LIEU D'ÉCHOUER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Planifiée par `goLive`, cette action part AVANT que l'hôte n'ait ouvert sa
 * salle (le jeton se demande après le passage en direct), et un
 * `RoomCompositeEgress` exige une salle EXISTANTE, que LiveKit ne crée qu'à la
 * première connexion. D'où : réveil, puis attente de la salle (`listRooms`),
 * puis démarrage — et tout échec TRANSITOIRE se REPLANIFIE
 * (`directEgressStartVerdict`, douze tentatives au plus). Entre deux
 * tentatives, l'action relit la session : une conférence déjà terminée, ou
 * déjà corrélée, arrête la boucle. Au bout de la borne, on renonce et on le
 * dit à l'hôte (`attachEgress({ failed })`, un CODE).
 *
 * `stageFormat` est OPTIONNEL : absent, il retombe sur `computer`, exactement
 * comme le DTO. `attempt` aussi — absent = première.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CORRECTIF DU 2026-09-17 — LA CAUSE RÉELLE SURVIT À LA TENTATIVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `lastFailure` voyage avec la replanification, classée par étage (`server` :
 * réveil, `listRooms` ; `egress` : démarrage de la capture), et le motif final
 * la NOMME (`directEgressEndedBeforeStartReason`) ; son détail technique part
 * au journal. Absente = aucun échec côté LiveKit.
 *
 * Le rattachement (`attachEgress`) est HORS du bloc d'essai : une écriture en
 * échec APRÈS un démarrage réussi n'est pas prise pour un refus de LiveKit —
 * elle aurait relancé une SECONDE capture sur le même fichier.
 */
export const startDirectEgress = internalAction({
  args: {
    sessionId: v.id("liveSessions"),
    roomName: v.string(),
    stageFormat: v.optional(directStageFormatValidator),
    /** Rang de CETTE tentative (0 = la première) — posé par la replanification. */
    attempt: v.optional(v.number()),
    /** La salle a-t-elle déjà été VUE chez LiveKit lors d'une tentative passée ? */
    roomSeen: v.optional(v.boolean()),
    /**
     * La dernière cause RÉELLE d'échec d'une tentative passée — absente tant
     * que LiveKit n'a rien refusé (une salle pas encore ouverte n'en est pas une).
     */
    lastFailure: v.optional(
      v.object({
        stage: v.union(v.literal("server"), v.literal("egress")),
        detail: v.string(),
      }),
    ),
  },
  returns: startOutcomeValidator,
  handler: async (ctx, args) => {
    const composition = directEgressComposition(args.stageFormat)
    const attempt = args.attempt ?? 0
    const config = liveKitConfigOrNull()
    if (config === null) {
      console.warn("[direct] startDirectEgress : env LiveKit absente — replay abandonné.")
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        failed: true,
        failureReason: "recording_unavailable",
      })
      return { status: "stub" as const }
    }

    // Entre deux tentatives, la conférence a pu se terminer (ou une autre
    // exécution a pu corréler la capture) : on ne lance rien sur une salle
    // que plus personne n'occupe, et jamais deux Egress pour une session.
    const state = await ctx.runQuery(internal.modules.live.replay.egressStartState, { sessionId: args.sessionId })
    if (state.egressId !== null) return { status: "already_started" as const }
    if (!state.recording) return { status: "not_wanted" as const }
    if (!state.live) {
      if (args.lastFailure !== undefined) {
        console.error(`[direct] startDirectEgress : conférence terminée avant la capture, dernier échec (${args.lastFailure.stage}) : ${args.lastFailure.detail}`)
      }
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        failed: true,
        failureReason: directEgressEndedBeforeStartReason(args.lastFailure),
      })
      return { status: "ended_before_start" as const }
    }

    let roomSeen = args.roomSeen === true
    let serverAnswered = false
    let attemptFailure: DirectEgressStartFailure | undefined
    let startedEgressId: string | undefined
    try {
      // Le réveil d'abord : la première tentative parlait à une machine
      // suspendue, et « fetch failed » passait pour un refus définitif.
      await ensureLiveKitAwake(config.wsUrl)

      // La salle EXISTE-t-elle ? LiveKit ne la crée qu'à la première
      // connexion ; un composite demandé avant est refusé.
      const existing = await roomServiceFor(config).listRooms([args.roomName])
      serverAnswered = true
      if (existing.length > 0) {
        roomSeen = true
        try {
          const filepath = buildDirectEgressFilepath(String(args.sessionId))
          // Le shape est validé à l'exécution par EgressClient, les types TS
          // du SDK sont plus stricts : patron `as never`, aucun `as any`.
          const info = await egressClientFor(config).startRoomCompositeEgress(
            args.roomName,
            { file: { filepath } } as never,
            directEgressCompositeOptions(args.stageFormat) as never,
          )
          startedEgressId = info.egressId
        } catch (err) {
          attemptFailure = { stage: "egress", detail: describeError(err) }
          console.error(`[direct] startDirectEgress tentative ${attempt + 1} : le service d'enregistrement a échoué :`, err)
        }
      }
      // Sinon : salle PAS ENCORE ouverte — ni échec, ni cause à transporter.
    } catch (err) {
      attemptFailure = { stage: "server", detail: describeError(err) }
      console.error(`[direct] startDirectEgress tentative ${attempt + 1} : le serveur vidéo a échoué :`, err)
    }

    if (startedEgressId !== undefined) {
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        egressId: startedEgressId,
        composition,
      })
      return { status: "started" as const }
    }

    const lastFailure = nextDirectEgressStartFailure({
      previous: args.lastFailure,
      attempt: attemptFailure,
      serverAnswered,
    })

    // Échec TRANSITOIRE (salle pas encore ouverte, serveur qui se réveille,
    // réseau) : on réessaie, borné. Le VERDICT est pur et testé.
    const verdict = directEgressStartVerdict(attempt)
    if (verdict.kind === "retry") {
      await ctx.scheduler.runAfter(verdict.delayMs, internal.modules.live.livekitActions.startDirectEgress, {
        sessionId: args.sessionId,
        roomName: args.roomName,
        ...(args.stageFormat !== undefined ? { stageFormat: args.stageFormat } : {}),
        attempt: verdict.attempt,
        roomSeen,
        ...(lastFailure !== undefined ? { lastFailure } : {}),
      })
      return { status: "retry_scheduled" as const }
    }
    if (lastFailure !== undefined) {
      console.error(`[direct] startDirectEgress : abandon après ${attempt + 1} tentatives, dernier échec (${lastFailure.stage}) : ${lastFailure.detail}`)
    }
    await ctx.runMutation(internal.modules.live.replay.attachEgress, {
      sessionId: args.sessionId,
      failed: true,
      failureReason: directEgressStartGiveUpReason({
        roomSeen,
        ...(lastFailure !== undefined ? { lastFailureStage: lastFailure.stage } : {}),
      }),
    })
    return { status: "failed" as const }
  },
})

/** Le message d'une erreur quelconque, sans jamais lever. */
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Arrête l'Egress d'un direct (fin de session, ou récolte d'un fantôme). */
export const stopDirectEgress = internalAction({
  args: { egressId: v.string() },
  returns: v.object({ status: v.union(v.literal("stub"), v.literal("stopped"), v.literal("failed")) }),
  handler: async (_ctx, args) => {
    const config = liveKitConfigOrNull()
    if (config === null) {
      console.warn("[direct] stopDirectEgress : env LiveKit absente.")
      return { status: "stub" as const }
    }
    try {
      await egressClientFor(config).stopEgress(args.egressId)
      return { status: "stopped" as const }
    } catch (err) {
      // L'egress peut être DÉJÀ terminé (room fermée avec le départ du
      // dernier participant) : l'échec est journalisé, le webhook fera foi.
      //
      // ⚠️ Un arrêt en échec ne LAISSE pas la ligne en plan : 15 min après la
      // fin de session, `reconcileStalePending` la reprend et
      // `reconcileDirectEgress` demande son sort à LiveKit.
      console.error("[direct] stopDirectEgress en échec :", err)
      return { status: "failed" as const }
    }
  },
})

/**
 * RÉCONCILIER une rediffusion restée `pending` — le filet du webhook.
 *
 * Planifiée par `replay.reconcileStalePending` (cron 15 min) et par la relance
 * manuelle de l'hôte (`sessions.retryReplay`). Elle demande à LiveKit ce qu'il
 * est advenu de l'Egress, et CONCLUT :
 *
 *  · `EGRESS_COMPLETE`   → rapatrie le fichier et appelle `completeEgress` —
 *    exactement ce que le webhook aurait fait, s'il était arrivé ;
 *  · échec nommé          → `completeEgress` avec son motif ;
 *  · `EGRESS_ACTIVE`      → la salle est close mais la capture tourne : on
 *    l'arrête, et le webhook (ou le passage suivant) conclura ;
 *  · introuvable          → `attachEgress({ failed })` : plus personne ne
 *    produira ce fichier, mieux vaut le dire à l'hôte que le faire attendre ;
 *  · intermédiaire        → on N'ÉCRIT RIEN. Le prochain passage tranchera, et
 *    la borne d'abandon (24 h) empêche l'attente d'être infinie.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CORRECTIFS DU 2026-09-17
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · RÉVEIL avant `listEgress`. La VM LiveKit se suspend quinze minutes après
 *    la dernière session — exactement quand ce filet passe. Le réveil est
 *    BORNÉ : un seul par exécution, avec les délais propres de
 *    `ensureLiveKitAwake`, sans boucle. Un réveil en échec n'est pas une
 *    preuve d'échec de l'Egress : rien n'est écrit.
 *  · RAPATRIEMENT EN FLUX. Le média n'est jamais chargé en mémoire
 *    (`lib/livekitEgressFileTransfer.ts`) ; un échec de transfert est DIT à
 *    l'hôte par son code (taille, délai, refus HTTP), sa phrase au journal.
 */
export const reconcileDirectEgress = internalAction({
  args: {
    sessionId: v.id("liveSessions"),
    egressId: v.optional(v.string()),
  },
  returns: v.object({
    status: v.union(
      v.literal("no_egress"),
      v.literal("stub"),
      v.literal("unreachable"),
      v.literal("not_found"),
      v.literal("pending"),
      v.literal("stopping"),
      v.literal("failed"),
      v.literal("ready"),
    ),
  }),
  handler: async (ctx, args) => {
    if (args.egressId === undefined) {
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        failed: true,
        failureReason: "never_started",
      })
      return { status: "no_egress" as const }
    }
    const config = liveKitConfigOrNull()
    if (config === null) {
      console.warn("[direct] reconcileDirectEgress : env LiveKit absente.")
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        failed: true,
        failureReason: "recording_unavailable",
      })
      return { status: "stub" as const }
    }

    const egressId = args.egressId
    let info: { status?: string | number; fileResults?: unknown[] } | undefined
    try {
      // Réveil D'ABORD (borné, voir l'en-tête) : la VM dort quand ce filet passe.
      await ensureLiveKitAwake(config.wsUrl)
      const found = await egressClientFor(config).listEgress({ egressId })
      info = found[0] as typeof info
    } catch (err) {
      // Une panne de l'API — ou un réveil refusé — n'est PAS une preuve
      // d'échec : on laisse la ligne `pending` et le passage suivant réessaiera.
      console.error("[direct] reconcileDirectEgress : réveil ou listEgress en échec :", err)
      return { status: "unreachable" as const }
    }

    if (info === undefined) {
      await ctx.runMutation(internal.modules.live.replay.attachEgress, {
        sessionId: args.sessionId,
        failed: true,
        failureReason: "egress_not_found",
      })
      return { status: "not_found" as const }
    }

    const outcome = directEgressOutcomeFromStatus(info.status)
    if (outcome.kind === "wait") return { status: "pending" as const }

    if (outcome.kind === "active") {
      try {
        await egressClientFor(config).stopEgress(egressId)
      } catch (err) {
        console.error("[direct] reconcileDirectEgress : stopEgress en échec :", err)
      }
      await ctx.runMutation(internal.modules.live.replay.markEgressState, {
        egressId,
        state: "stopping",
      })
      return { status: "stopping" as const }
    }

    if (outcome.kind === "failed") {
      await ctx.runMutation(internal.modules.live.replay.completeEgress, {
        egressId,
        failureReason: outcome.reason,
      })
      return { status: "failed" as const }
    }

    // COMPLETE : le fichier existe chez LiveKit, il n'a jamais été rapatrié.
    const file = (info.fileResults?.[0] ?? undefined) as { location?: string; duration?: number | string | bigint } | undefined
    // `FileInfo.duration` est un int64 en NANOSECONDES (bigint dans le SDK).
    const durationMs = egressDurationNsToMs(file?.duration)
    let storageId: Id<"_storage"> | undefined
    let upload: { mimeType: string; sizeBytes: number } | undefined
    let failureReason: DirectReplayFailureReason = "file_not_retrieved"
    if (file?.location) {
      // EN FLUX : jamais le média entier en mémoire (512 MiB en runtime Node).
      const transfer = await transferEgressFileToStorage({
        location: file.location,
        filepath: buildDirectEgressFilepath(String(args.sessionId)),
        // Politique de dépôt, temps 1 : l'URL est délivrée pour un usage nommé.
        generateUploadUrl: () => egressUploadUrl(ctx),
      })
      if (transfer.ok) {
        storageId = transfer.storageId as Id<"_storage">
        // Temps 2 : `completeEgress` confronte le fichier stocké à la déclaration.
        upload = { mimeType: transfer.contentType, sizeBytes: transfer.bytes }
      } else {
        failureReason = directReplayTransferFailureReason(transfer.code)
        console.error(`[direct] reconcileDirectEgress : rapatriement en échec (${transfer.code}) : ${transfer.reason}`)
      }
    }
    await ctx.runMutation(internal.modules.live.replay.completeEgress, {
      egressId,
      ...(storageId !== undefined ? { storageId } : {}),
      ...(upload !== undefined ? { upload } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(storageId === undefined ? { failureReason } : {}),
    })
    return {
      status: storageId === undefined ? ("failed" as const) : ("ready" as const),
    }
  },
})

/**
 * IMPORTER une piste de sous-titres WebVTT (lot 10D).
 *
 * ⚠️ `replay.attachCaptions` existait depuis la première version SANS AUCUN
 * PRODUCTEUR : son seul appelant était un test. Ce lot lui donne une porte —
 * l'hôte importe un fichier — et rien d'autre. Aucun sous-titrage AUTOMATIQUE
 * n'existe dans ce dépôt, et l'écran n'en promet aucun.
 *
 * ⚠️ POURQUOI DU TEXTE, ET PAS UNE URL DE DÉPÔT. Délivrer une URL de dépôt
 * ouvre un stockage que rien ne borne tant que le fichier n'est pas rattaché ;
 * la politique du dépôt (`lib/uploadPolicy.ts`) l'interdit hors de son registre
 * d'usages, et ce registre n'a pas d'entrée pour une piste WebVTT. Le contenu
 * arrive donc en ARGUMENT, borné et vérifié AVANT d'être écrit : il n'existe à
 * aucun instant de blob non rattaché.
 *
 * Ordre des barrières, et aucune n'est facultative :
 *  1. le RÉSEAU et l'AUTORITÉ — le constructeur (`networkAction`), puis
 *     `sessions.replayCaptionsIntake` : appelée depuis une action, elle voit la
 *     MÊME identité que l'appelant, et elle LÈVE (droit refusé, replay absent ou
 *     périmé) ;
 *  2. la TAILLE et le CONTENU (`WEBVTT` en tête), ici, avant tout stockage —
 *     un `.vtt` qui n'en est pas produirait une piste muette qu'aucun message
 *     n'expliquerait ;
 *  3. l'ÉTAT, une seconde fois, dans `replay.attachCaptions` : entre la
 *     vérification et l'écriture, la rediffusion a pu être retirée ou expirer.
 *     La mutation supprime alors la pièce dans sa propre transaction ; sinon
 *     elle l'inscrit à l'analyse de la garde des fichiers.
 */
export const importReplayCaptions = networkAction({
  args: {
    sessionId: v.id("liveSessions"),
    /** Le contenu WebVTT, en clair. Borné par la politique ci-dessous. */
    content: v.string(),
    lang: v.optional(v.string()),
  },
  returns: v.object({ accepted: v.boolean(), reason: literals(DIRECT_REPLAY_CAPTIONS_REFUSALS) }),
  handler: async (ctx, args): Promise<{ accepted: boolean; reason: DirectReplayCaptionsRefusal }> => {
    // Barrière 1 : LÈVE si le droit manque ou si le replay n'est pas servable.
    const intake: { maxBytes: number } = await ctx.runQuery(api.modules.live.sessions.replayCaptionsIntake, {
      networkId: ctx.networkId,
      sessionId: args.sessionId,
    })

    // Barrière 2 : la taille RÉELLE en octets, pas la longueur en caractères —
    // un accent compte deux octets, et c'est le stockage qui paie.
    const bytes = new TextEncoder().encode(args.content)
    if (bytes.length === 0) return { accepted: false, reason: "missing" }
    if (bytes.length > intake.maxBytes) {
      return { accepted: false, reason: "too_large" }
    }
    // Un BOM UTF-8 en tête est licite et fréquent : on le retire avant de lire
    // la signature, sinon un fichier parfaitement valide serait refusé.
    const head = args.content.replace(/^﻿/, "").trimStart()
    if (!head.startsWith("WEBVTT")) {
      return { accepted: false, reason: "wrong_type" }
    }

    const storageId = await ctx.storage.store(new Blob([args.content], { type: "text/vtt" }))
    // Barrière 3 : `attachCaptions` rejuge l'état et supprime la pièce si la
    // rediffusion n'est plus servable.
    const result = await ctx.runMutation(internal.modules.live.replay.attachCaptions, {
      sessionId: args.sessionId,
      storageId,
      lang: normalizeDirectReplayCaptionsLang(args.lang),
      uploadedByPersonId: ctx.personId,
    })
    return result.attached ? { accepted: true, reason: "ok" } : { accepted: false, reason: "missing" }
  },
})
