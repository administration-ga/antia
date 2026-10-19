/**
 * media-playback-policy — les DÉCISIONS du coordinateur de lecture, sans
 * navigateur ni React (lot P04 de l'étude social-commerce du 18/10/2026,
 * `docs/etudes/2026-10-18-social-commerce/04_PARCOURS_FIL_ET_PUBLICATIONS.md`
 * §3 « Règles de lecture »).
 *
 * Ce module ne connaît que des valeurs : un rôle, une visibilité, un
 * environnement. Le coordinateur (`media-playback-coordinator.ts`) applique ses
 * réponses aux éléments médias ; les écrans ne décident rien.
 *
 * Les six règles de 04 §3, et où elles vivent :
 *  1. au plus UNE vidéo active — le coordinateur (une lecture en suspend une
 *     autre) ; seuil de visibilité de 70 %, réglable : `MEDIA_VISIBILITY_THRESHOLD` ;
 *  2. lecture automatique MUETTE seulement si le navigateur l'admet et hors
 *     économie de données, sinon « Lire » : `autoplayDecision` ;
 *  3. le son demande un geste ; hors écran, onglet masqué ou appel suspendent :
 *     `environmentSuspension`, `suspensionFor` ;
 *  4. préchargement de la seule voisine, aucun en économie de données :
 *     `preloadFor` ;
 *  5. reprise sans saut : la publication et sa position restent (lecteur) ;
 *  6. aucun passage automatique au post suivant : rien ici ne change de
 *     publication — la fin d'une vidéo ne produit aucune décision.
 */

/** Seuil initial de visibilité d'une vidéo active (04 §3, règle 1), réglable après recette. */
export const MEDIA_VISIBILITY_THRESHOLD = 0.7

/**
 * Le RÔLE d'un média, donné par le lecteur immersif (créneau actif, voisin
 * suivant, lointain). `unmanaged` : hors lecteur (mode Liste, autres murs) —
 * le média garde ses commandes natives, sans lecture automatique ; seules la
 * vidéo unique et les suspensions s'y appliquent.
 */
export type MediaRole = "unmanaged" | "active" | "neighbor" | "distant"

export type MediaPreload = "none" | "metadata" | "auto"

/** Ce que l'on sait de la lecture automatique dans ce navigateur. */
export type AutoplayCapability = "unknown" | "allowed" | "blocked"

/** Ce qui a suspendu une lecture (dit à l'écran, jamais deviné). */
export type PlaybackSuspension = "call" | "hidden" | "offscreen"

export interface PlaybackEnvironment {
  /** Onglet masqué (`document.visibilityState === "hidden"`). */
  documentHidden: boolean
  /** Un appel sonne ou est en cours (état existant de la couche d'appel). */
  callInProgress: boolean
  /** Économie de données demandée (`navigator.connection.saveData`, `prefers-reduced-data`). */
  dataSaver: boolean
}

export const DEFAULT_PLAYBACK_ENVIRONMENT: PlaybackEnvironment = Object.freeze({
  documentHidden: false,
  callInProgress: false,
  dataSaver: false,
})

/** Un seuil exploitable : dans ]0, 1], sinon le seuil initial. */
export function normalizedThreshold(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0 || value > 1) return MEDIA_VISIBILITY_THRESHOLD
  return value
}

/**
 * Une visibilité INCONNUE (aucune mesure encore, ou navigateur sans
 * `IntersectionObserver`) ne vaut pas « hors écran » : on ne suspend pas une
 * lecture que la personne vient de lancer sur la foi d'une mesure absente.
 */
export function isSufficientlyVisible(ratio: number | null, threshold: number): boolean {
  if (ratio === null) return true
  return Number.isFinite(ratio) && ratio >= threshold
}

/** Une interruption de l'environnement suspend TOUTE lecture et interdit d'en démarrer. */
export function environmentSuspension(environment: PlaybackEnvironment): "call" | "hidden" | null {
  if (environment.callInProgress) return "call"
  if (environment.documentHidden) return "hidden"
  return null
}

/**
 * Ce qui doit suspendre un média qui JOUE : l'environnement d'abord, puis un
 * rôle qui n'est plus celui de la publication lue, puis la visibilité.
 */
export function suspensionFor(input: {
  role: MediaRole
  environment: PlaybackEnvironment
  visibleRatio: number | null
  threshold: number
}): PlaybackSuspension | null {
  const environment = environmentSuspension(input.environment)
  if (environment !== null) return environment
  // Dans le lecteur, seule la publication ACTIVE joue : la voisine visible à
  // moitié ou une publication quittée se taisent.
  if (input.role === "neighbor" || input.role === "distant") return "offscreen"
  if (!isSufficientlyVisible(input.visibleRatio, input.threshold)) return "offscreen"
  return null
}

/**
 * Le préchargement d'un média selon son rôle : la seule voisine (et la
 * publication active) préparent leurs métadonnées, les lointaines rien ;
 * l'économie de données n'en anticipe aucune. Hors lecteur (`unmanaged`), le
 * comportement P03 est gardé à l'identique : métadonnées.
 *
 * Le contrat média ne porte aucune affiche (`PostMediaDto`) : seules les
 * métadonnées se préparent, aucune image n'est inventée.
 */
export function preloadFor(role: MediaRole, environment: Pick<PlaybackEnvironment, "dataSaver">): MediaPreload {
  if (environment.dataSaver) return "none"
  switch (role) {
    case "unmanaged":
    case "active":
    case "neighbor":
      return "metadata"
    case "distant":
      return "none"
  }
}

export interface AutoplayInput {
  role: MediaRole
  capability: AutoplayCapability
  environment: PlaybackEnvironment
  visibleRatio: number | null
  threshold: number
  /** La personne a mis CE média en pause pendant qu'il était actif. */
  userPaused: boolean
  /** Le média est arrivé à sa fin : aucune relance, aucun passage au suivant. */
  ended: boolean
  /** Une autre lecture l'a remplacé : il ne la reprend pas de lui-même. */
  displaced: boolean
}

/**
 * `play` : lancer (muet, sauf préférence explicite du son) ;
 * `manual` : montrer « Lire » (lecture automatique refusée, économie de données) ;
 * `wait` : rien — pas la publication active, interrompue, hors écran, pausée
 * par la personne, terminée ou remplacée.
 */
export type AutoplayDecision = "play" | "manual" | "wait"

export function autoplayDecision(input: AutoplayInput): AutoplayDecision {
  if (input.role !== "active") return "wait"
  if (input.ended || input.userPaused || input.displaced) return "wait"
  if (environmentSuspension(input.environment) !== null) return "wait"
  if (!isSufficientlyVisible(input.visibleRatio, input.threshold)) return "wait"
  if (input.environment.dataSaver || input.capability === "blocked") return "manual"
  return "play"
}

/** La politique déclarée par le navigateur (`navigator.getAutoplayPolicy`), quand il en a une. */
export function autoplayCapabilityFromPolicy(policy: unknown): AutoplayCapability {
  if (policy === "disallowed") return "blocked"
  if (policy === "allowed" || policy === "allowed-muted") return "allowed"
  return "unknown"
}

function errorName(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("name" in error)) return null
  return typeof error.name === "string" ? error.name : null
}

/** `play()` refusé par la politique de lecture automatique du navigateur. */
export function isAutoplayRejection(error: unknown): boolean {
  return errorName(error) === "NotAllowedError"
}

/** `play()` interrompu par une pause demandée entre-temps : rien à signaler. */
export function isInterruptedPlay(error: unknown): boolean {
  return errorName(error) === "AbortError"
}
