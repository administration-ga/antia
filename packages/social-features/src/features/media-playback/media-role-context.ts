"use client"

/**
 * Le RÔLE des médias d'un sous-arbre, donné par le lecteur immersif (créneau
 * actif, voisin suivant, lointain) — lot P04.
 *
 * Hors de tout créneau, la valeur est `unmanaged` : le média garde ses
 * commandes natives et sa présentation P03, sans lecture automatique ; seules
 * la vidéo unique et les suspensions (appel, onglet masqué, hors écran)
 * s'appliquent quand un coordinateur est monté.
 *
 * Ce contexte est le contrat d'entrée du coordinateur : le lecteur le POSE,
 * les médias le LISENT. Aucune dépendance du coordinateur vers le lecteur.
 */
import { createContext, useContext } from "react"

import type { MediaRole } from "./media-playback-policy"

const MediaRoleContext = createContext<MediaRole>("unmanaged")

/** Pose le rôle des médias du sous-arbre (un créneau du lecteur immersif). */
export const MediaRoleProvider = MediaRoleContext.Provider

/** Le rôle donné au sous-arbre, `unmanaged` hors du lecteur. */
export function useMediaRole(): MediaRole {
  return useContext(MediaRoleContext)
}
