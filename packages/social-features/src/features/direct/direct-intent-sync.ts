// Dupliqué de socle/packages/agent-features/src/features/direct/direct-preflight.ts @ ad2e7fdc2 — adaptations : seule la convergence média est portée, appliquée par le propriétaire persistant même hors page ; algorithme conservé.
import type { DirectMediaIntent } from "../../stores/direct-session-store"

export interface DirectIntentConvergence {
  mic: boolean
  camera: boolean
  /**
   * L'intention sur laquelle la convergence a été jugée au tour précédent.
   * Si elle a changé depuis, le réel est en RETARD, pas en désaccord : on
   * re-converge au lieu d'adopter (absent = premier tour).
   */
  lastWants?: { mic: boolean; camera: boolean }
}

export const DIRECT_INTENT_UNCONVERGED: DirectIntentConvergence = {
  mic: false,
  camera: false,
}

export interface DirectIntentSyncResult {
  /** Le correctif à écrire dans l'intention — `null` : ne rien écrire. */
  patch: Partial<
    Pick<DirectMediaIntent, "micEnabled" | "cameraEnabled" | "audioOnly">
  > | null
  /** La convergence mise à jour, à repasser au tour suivant. */
  converged: DirectIntentConvergence
}

export function reconcileMediaIntent(args: {
  /** Ce que l'intention DEMANDE de publier (déjà filtré par le rôle du jeton). */
  wants: { mic: boolean; camera: boolean }
  /** Ce que la salle publie RÉELLEMENT à cet instant. */
  actual: { mic: boolean; camera: boolean }
  converged: DirectIntentConvergence
}): DirectIntentSyncResult {
  const { wants, actual, converged } = args
  const next: DirectIntentConvergence = { ...converged, lastWants: wants }
  let patch: DirectIntentSyncResult["patch"] = null

  // ⚠️ L'INTENTION vient de changer (l'appel coupe le micro, la carte
  // flottante le rétablit) : le réel est EN RETARD d'un rendu, pas en
  // désaccord. Adopter ce réel-là réécrirait l'intention à l'instant même où
  // elle est posée — vécu le 14/09 : l'appel disait « micro coupé », le micro
  // restait ouvert. On repart donc de zéro pour ce périphérique, et on
  // n'adopte le réel qu'une fois qu'il a rejoint la NOUVELLE intention.
  const previous = converged.lastWants ?? null
  if (previous !== null && previous.mic !== wants.mic) next.mic = false
  if (previous !== null && previous.camera !== wants.camera) next.camera = false

  if (!next.mic) {
    // Toujours en cours d'application : on regarde, on n'écrit pas.
    if (actual.mic === wants.mic) next.mic = true
  } else if (actual.mic !== wants.mic) {
    patch = { ...(patch ?? {}), micEnabled: actual.mic }
  }

  if (!next.camera) {
    if (actual.camera === wants.camera) next.camera = true
  } else if (actual.camera !== wants.camera) {
    patch = { ...(patch ?? {}), cameraEnabled: actual.camera }
    // ⚠️ Rallumer la caméra depuis la barre de contrôles LÈVE « audio
    // seulement » : sans cela, `directWantsVideo` resterait faux, le
    // contrôleur d'intention la rééteindrait aussitôt, et le bouton
    // clignoterait sans fin.
    if (actual.camera) patch = { ...patch, audioOnly: false }
  }

  return { patch, converged: next }
}
