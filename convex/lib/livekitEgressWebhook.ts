// Dupliqué de socle/convex/lib/egressWebhook.ts (avec `timingSafeEqual`, socle/convex/lib/httpSecurity.ts l. 19-31) @ ad2e7fdc2 — adaptations : propriétaires et routes RÉDUITS AU DIRECT (`EGRESS_ROUTES = ["direct"]` : enregistrements d'appel, messagerie vocale et pistes iRéunion n'existent pas dans le moteur) — `isEgressKnownBy` et `completeEgressForOwners` n'ont plus qu'une branche (`modules/live/replay`), le plan ne garde qu'UN motif (celui du direct : `EGRESS_FAILED`, `ABORTED`, `LIMIT_REACHED`), ni début de capture ni taille (fusion iRéunion) ; motifs à CODE (`directEgressFailureReason`, et le motif d'un rapatriement raté, déjà un code) ; statut lu dans le module pur du domaine (`@antsia/social-domain/live/replayComposition`) ; comparaison à temps constant recopiée ici pour le secret historique du webhook (le moteur n'a pas de `lib/httpSecurity`).
/**
 * Le webhook Egress LiveKit — ce qu'un événement veut dire, et à QUI il
 * parle. Sans enregistrement de fonction : importé par le webhook
 * (`convex/http.ts`, runtime Convex) ET par l'action Node qui rapatrie le
 * fichier (`modules/live/egressActions.ingestEgressFile`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE VM LIVEKIT, PLUSIEURS DÉPLOIEMENTS (correctif du 2026-09-17)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une même VM LiveKit peut servir plusieurs déploiements Convex (développement,
 * production), avec les mêmes clés, et son webhook est configuré vers chacun.
 * Chaque déploiement reçoit donc les événements des salles des autres. Au socle :
 *
 *  · le webhook TÉLÉCHARGEAIT le fichier avant de savoir à qui il était —
 *    un enregistrement de la prod aurait été copié dans le stockage du dev ;
 *  · aucune complétion ne supprimait ce blob quand l'egressId lui était
 *    inconnu (orphelin).
 *
 * La PROPRIÉTÉ se vérifie AVANT tout effet (`findEgressOwners`) : un egress
 * inconnu rend 200 et rien d'autre — ni téléchargement, ni écriture, ni
 * journal. Le traitement garde la connaissance de SA table (une requête
 * interne, `replay.isEgressKnown`).
 */
import { type DirectReplayFailureReason, directEgressFailureReason } from "@antsia/social-domain/live/replayComposition"

import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import type { ActionCtx } from "../_generated/server"
import { type EgressFileKind, routeEgressFilepath } from "./livekitEgressRouting"
import type { EgressUploadDeclaration } from "./livekitEgressUploads"

/** Une branche CONNUE du contrat de filepath. */
export type EgressRoute = Exclude<EgressFileKind, "unknown">

export const EGRESS_ROUTES: readonly EgressRoute[] = ["direct"]

/**
 * Les événements que ce webhook TRAITE. Tout autre événement du flux LiveKit
 * (salles, participants, pistes…) est absorbé SANS authentification ni effet :
 * les vérifier coûterait un aller-retour Node par arrivée de participant, pour
 * chaque déploiement, sans rien protéger — rien n'en découle.
 */
export const HANDLED_EGRESS_EVENTS = ["egress_started", "egress_updated", "egress_ended"] as const

export type HandledEgressEvent = (typeof HANDLED_EGRESS_EVENTS)[number]

export function isHandledEgressEvent(name: unknown): name is HandledEgressEvent {
  return typeof name === "string" && (HANDLED_EGRESS_EVENTS as readonly string[]).includes(name)
}

/**
 * `EgressInfo` tel que le webhook le reçoit : JSON protobuf, int64 en chaînes.
 *
 * ⚠️ Dans `FileInfo` (`@livekit/protocol`), le chemin s'appelle `filename`,
 * pas `filepath` — `filepath` n'existe qu'à la DEMANDE (`EncodedFileOutput`).
 * Et `duration`, comme `startedAt`/`endedAt`, est un int64 en NANOSECONDES.
 * Lire `filepath` rendait le chemin vide, donc la route `unknown`, et aucune
 * rediffusion n'était jamais rapatriée (recette R1 du 17/09 : MP4 de 55 Mo
 * dans le bucket, « aucun fichier livré » à l'écran).
 */
export type LiveKitEgressInfoJson = {
  egressId?: string
  status?: string
  startedAt?: number | string
  endedAt?: number | string
  fileResults?: Array<{
    filename?: string
    /** Ancien nom supposé, jamais émis par LiveKit : lu en repli seulement. */
    filepath?: string
    location?: string
    size?: number | string
    /** Nanosecondes. */
    duration?: number | string
  }>
}

/**
 * Durée LiveKit (int64 en nanosecondes, en nombre, chaîne ou bigint) → ms.
 * `undefined` pour une valeur absente, nulle, négative ou illisible.
 */
export function egressDurationNsToMs(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const ns = typeof value === "bigint" ? Number(value) : typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isFinite(ns) || ns <= 0) return undefined
  return Math.round(ns / 1e6)
}

/** Ce qu'un `egress_ended` décide, calculé UNE fois pour tous les chemins. */
export type EgressEndedPlan = {
  egressId: string
  route: EgressFileKind
  filepath: string
  location?: string
  durationMs?: number
  /** Le motif d'échec déclaré par LiveKit : `EGRESS_FAILED`, `ABORTED`, `LIMIT_REACHED`. */
  failureReason?: DirectReplayFailureReason
}

/**
 * Traduit un `egress_ended` en décision (chemin, durée, motif). Pur. Le chemin
 * se lit dans `filename` (nom réel du champ LiveKit) ; la durée est convertie
 * de nanosecondes en millisecondes.
 */
export function planEgressEnded(info: LiveKitEgressInfoJson & { egressId: string }): EgressEndedPlan {
  const fileResult = info.fileResults?.[0]
  const filepath = fileResult?.filename || fileResult?.filepath || ""
  const durationMs = egressDurationNsToMs(fileResult?.duration)
  const failureReason = directEgressFailureReason(info.status)
  return {
    egressId: info.egressId,
    route: routeEgressFilepath(filepath),
    filepath,
    ...(fileResult?.location ? { location: fileResult.location } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(failureReason !== undefined ? { failureReason } : {}),
  }
}

/**
 * Faut-il RAPATRIER un fichier ? Seulement pour une branche connue, avec un
 * emplacement, et sans échec déclaré par LiveKit : un fichier accompagné d'un
 * échec était téléchargé puis jeté.
 */
export function egressEndedNeedsFile(plan: EgressEndedPlan): plan is EgressEndedPlan & { route: EgressRoute; location: string } {
  if (plan.route === "unknown" || plan.location === undefined) return false
  return plan.failureReason === undefined
}

async function isEgressKnownBy(ctx: Pick<ActionCtx, "runQuery">, route: EgressRoute, egressId: string): Promise<boolean> {
  switch (route) {
    case "direct":
      return await ctx.runQuery(internal.modules.live.replay.isEgressKnown, { egressId })
  }
}

/**
 * Les traitements qui CONNAISSENT cet egress. Une branche connue n'interroge
 * que la sienne ; une branche inconnue (egress sans fichier : échec précoce)
 * interroge chacune. Vide = l'egress n'est pas à ce déploiement.
 */
export async function findEgressOwners(ctx: Pick<ActionCtx, "runQuery">, route: EgressFileKind, egressId: string): Promise<EgressRoute[]> {
  const candidates = route === "unknown" ? EGRESS_ROUTES : [route]
  const owners: EgressRoute[] = []
  for (const candidate of candidates) {
    if (await isEgressKnownBy(ctx, candidate, egressId)) owners.push(candidate)
  }
  return owners
}

/**
 * Conclut l'egress chez chacun de ses propriétaires.
 *
 * `transferFailureReason` — pourquoi le rapatriement a échoué — n'est retenu
 * qu'à défaut d'un échec déclaré par LiveKit (l'hôte le lit).
 *
 * `upload` — ce que le transfert DÉCLARE du fichier déposé — accompagne
 * toujours un `storageId` rapatrié : la rediffusion le confronte au fichier
 * stocké avant de le rattacher (politique de dépôt, `lib/livekitEgressUploads.ts`).
 */
export async function completeEgressForOwners(
  ctx: Pick<ActionCtx, "runMutation">,
  owners: readonly EgressRoute[],
  plan: EgressEndedPlan,
  file: {
    storageId?: Id<"_storage">
    upload?: EgressUploadDeclaration
    transferFailureReason?: DirectReplayFailureReason
  } = {},
): Promise<void> {
  const failureReason = plan.failureReason ?? file.transferFailureReason
  for (const owner of owners) {
    switch (owner) {
      case "direct":
        await ctx.runMutation(internal.modules.live.replay.completeEgress, {
          egressId: plan.egressId,
          ...(file.storageId !== undefined ? { storageId: file.storageId } : {}),
          ...(file.storageId !== undefined && file.upload !== undefined ? { upload: file.upload } : {}),
          ...(plan.durationMs !== undefined ? { durationMs: plan.durationMs } : {}),
          ...(failureReason !== undefined ? { failureReason } : {}),
        })
        break
    }
  }
}

/**
 * Comparaison à temps constant de deux chaînes (anti timing-attack). Rend
 * `false` si les longueurs diffèrent. Pour comparer un secret partagé
 * (le secret historique d'un relais du webhook) plutôt que `===`.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
