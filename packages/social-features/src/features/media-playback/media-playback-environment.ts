/**
 * media-playback-environment — ce que le navigateur dit de l'environnement de
 * lecture (lot P04), lu sans jamais lever : une API absente vaut « rien de
 * signalé », jamais une erreur à l'écran.
 *
 *  · économie de données : `navigator.connection.saveData` (Network
 *    Information API, absente de Safari et Firefox) et la requête média
 *    `prefers-reduced-data` (expérimentale) ;
 *  · politique de lecture automatique : `navigator.getAutoplayPolicy`
 *    (Firefox seulement aujourd'hui) — un indice ; le refus réel de `play()`
 *    reste la preuve qui fait foi (`media-playback-coordinator.ts`) ;
 *  · onglet masqué : `document.visibilityState`.
 *
 * Les types de ces API ne sont pas tous dans la bibliothèque DOM de
 * TypeScript : ils sont décrits ici, structurellement, sans `any`.
 */
import { autoplayCapabilityFromPolicy, type AutoplayCapability } from "./media-playback-policy"

interface NetworkInformationLike {
  readonly saveData?: boolean
  addEventListener?: (type: "change", listener: () => void) => void
  removeEventListener?: (type: "change", listener: () => void) => void
}

type NavigatorWithPlaybackHints = Navigator & {
  readonly connection?: NetworkInformationLike
  getAutoplayPolicy?: (type: "mediaelement") => unknown
}

const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)"

function playbackNavigator(): NavigatorWithPlaybackHints | null {
  if (typeof navigator === "undefined") return null
  return navigator as NavigatorWithPlaybackHints
}

function reducedDataQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  try {
    return window.matchMedia(REDUCED_DATA_QUERY)
  } catch {
    return null
  }
}

/** L'économie de données est-elle demandée ? */
export function readDataSaver(): boolean {
  let saveData = false
  try {
    saveData = playbackNavigator()?.connection?.saveData === true
  } catch {
    saveData = false
  }
  return saveData || reducedDataQuery()?.matches === true
}

/** Abonnement aux changements de l'économie de données (connexion, requête média). */
export function subscribeDataSaver(listener: () => void): () => void {
  const connection = playbackNavigator()?.connection
  const query = reducedDataQuery()
  try {
    connection?.addEventListener?.("change", listener)
  } catch {
    // Une connexion sans évènement : la valeur lue au montage reste.
  }
  try {
    query?.addEventListener("change", listener)
  } catch {
    // Requête média sans évènement : idem.
  }
  return () => {
    try {
      connection?.removeEventListener?.("change", listener)
    } catch {
      // Rien à retirer.
    }
    try {
      query?.removeEventListener("change", listener)
    } catch {
      // Rien à retirer.
    }
  }
}

/** L'indice du navigateur sur la lecture automatique des éléments médias. */
export function readAutoplayCapability(): AutoplayCapability {
  const hints = playbackNavigator()
  if (hints === null || typeof hints.getAutoplayPolicy !== "function") return "unknown"
  try {
    return autoplayCapabilityFromPolicy(hints.getAutoplayPolicy("mediaelement"))
  } catch {
    return "unknown"
  }
}

/** L'onglet est-il masqué ? */
export function readDocumentHidden(): boolean {
  if (typeof document === "undefined") return false
  return document.visibilityState === "hidden"
}

export function subscribeDocumentVisibility(listener: () => void): () => void {
  if (typeof document === "undefined") return () => {}
  document.addEventListener("visibilitychange", listener)
  return () => document.removeEventListener("visibilitychange", listener)
}
