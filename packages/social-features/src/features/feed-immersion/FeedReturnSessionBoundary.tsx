"use client"

/**
 * FeedReturnSessionBoundary — la frontière de la mémoire de retour du fil
 * (lot P04), montée UNE fois dans la coque persistante de l'application
 * (`network-shell.tsx`, à côté d'`IcomListSessionBoundary`).
 *
 * Elle ouvre la session de la personne courante et la purge à sa sortie
 * (démontage de la coque, changement de personne ou de réseau). Sans elle,
 * la mémoire refuse toute lecture et toute écriture : une application qui ne
 * déclare pas le fil immersif ne garde aucune position.
 */
import { useNetwork } from "@antsia/api/network"
import { useEffect } from "react"

import { activateFeedReturnSession, clearFeedReturnSession, feedReturnOwner } from "./feed-return-memory"

export function FeedReturnSessionBoundary() {
  const { networkId, personId, feedPresentation } = useNetwork()
  const owner = feedReturnOwner(networkId, personId)
  useEffect(() => {
    if (feedPresentation !== "immersive") return
    activateFeedReturnSession(owner)
    return () => clearFeedReturnSession(owner)
  }, [owner, feedPresentation])
  return null
}
