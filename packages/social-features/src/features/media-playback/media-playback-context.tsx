"use client"

/**
 * Le CONTEXTE du coordinateur de lecture, seul (lot P04) — séparé du
 * fournisseur et de son pont d'environnement : les médias de publication
 * (`PostMediaPresentation`) le lisent aussi sur la carte publique servie sans
 * compte, qui ne doit charger ni le magasin d'appel ni les requêtes du moteur.
 */
import { createContext, useContext, type ReactNode } from "react"

import type { MediaPlaybackCoordinator } from "./media-playback-coordinator"

export const MediaPlaybackContext = createContext<MediaPlaybackCoordinator | null>(null)

/** Le coordinateur de la session, ou `null` quand l'application n'en monte aucun. */
export function useOptionalMediaPlayback(): MediaPlaybackCoordinator | null {
  return useContext(MediaPlaybackContext)
}

/**
 * Le contexte sans pont d'environnement : pour un coordinateur fourni de
 * l'extérieur (tests, surfaces embarquées qui gèrent leur environnement).
 */
export function MediaPlaybackScope({ coordinator, children }: { coordinator: MediaPlaybackCoordinator; children: ReactNode }) {
  return <MediaPlaybackContext.Provider value={coordinator}>{children}</MediaPlaybackContext.Provider>
}
