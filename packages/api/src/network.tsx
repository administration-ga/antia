"use client"

/**
 * Le RÉSEAU courant et les ADRESSES de l'application — ce que l'espace agent
 * du socle lisait dans `OrgProvider` et dans des chemins `/espace/…` écrits en
 * dur (17 endroits, annexe A6 §7.5).
 *
 * Une application du moteur monte `NetworkProvider` une fois, sous la porte
 * d'authentification : les surfaces y lisent le réseau de toutes leurs
 * fonctions (`useNetwork().networkId`), la charte que leurs portails
 * redéclarent, le préfixe de leurs clés de stockage local, et les adresses de
 * l'application (`useRoutes()`), qui seule sait ses URL (cliquet
 * `no-hardcoded-urls` : les routes vivent dans `apps/<app>/src/lib/routes.ts`).
 *
 * Le contrat minimal d'`OrgProvider` que lisaient les surfaces (annexe A6
 * §7.5) est porté tel quel, en constantes : `personalMode = true`,
 * `personalSpaceIsElsewhere = false`, `activeOrgId = null`.
 */
import { createContext, useContext, type ReactNode } from "react"

import type { Id } from "./engine"

/** Les adresses de l'application, injectées : aucune surface n'écrit une URL. */
export interface EngineRoutes {
  /** Accueil du réseau (le fil). */
  home: () => string
  /** Base de la messagerie en pages (iCom au téléphone, anciens liens). */
  messages: () => string
  /** Base des statuts (stories) en plein écran. */
  stories: () => string
  /** Profil d'une personne, par son identifiant public. */
  profile: (handle: string) => string
  /** Fiche d'une page (identité propre), par son identifiant public — un espace de noms distinct des personnes. */
  page: (handle: string) => string
  /** Réglages de la personne ; absent tant que l'application ne les sert pas (l'entrée de menu disparaît). */
  settings?: () => string
  /** Conférence en direct (lot `live`). */
  conference: (sessionId: string) => string
}

export interface NetworkContextValue {
  networkId: Id<"networks">
  /** Identifiant lisible du réseau (`antia`, `diaspora`…). */
  slug: string
  /** La personne de la session : chaque surface sait de quel côté elle se tient. */
  personId: Id<"persons">
  /** La charte de l'application (`data-charte`), redéclarée par les portails. */
  charte: string
  /** Préfixe des clés de stockage local et de session : un état par réseau. */
  storagePrefix: string
  /** L'application sert réellement sa route de conférence (activation explicite F3a). */
  liveAvailable: boolean
  /** Contrat d'`OrgProvider` lu par les surfaces du socle : toujours l'espace personnel. */
  personalMode: true
  personalSpaceIsElsewhere: false
  activeOrgId: null
}

const NetworkContext = createContext<NetworkContextValue | null>(null)
const RoutesContext = createContext<EngineRoutes | null>(null)

export function NetworkProvider(props: {
  networkId: Id<"networks">
  slug: string
  personId: Id<"persons">
  charte: string
  routes: EngineRoutes
  liveAvailable?: boolean
  children: ReactNode
}) {
  const value: NetworkContextValue = {
    networkId: props.networkId,
    slug: props.slug,
    personId: props.personId,
    charte: props.charte,
    storagePrefix: `antia:${props.slug}:`,
    liveAvailable: props.liveAvailable === true,
    personalMode: true,
    personalSpaceIsElsewhere: false,
    activeOrgId: null,
  }
  return (
    <NetworkContext.Provider value={value}>
      <RoutesContext.Provider value={props.routes}>{props.children}</RoutesContext.Provider>
    </NetworkContext.Provider>
  )
}

/** Le réseau courant ; lève hors d'un `NetworkProvider` (une surface sociale n'existe que dans un réseau). */
export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext)
  if (!value) throw new Error("@antia/api/network : aucun NetworkProvider au-dessus de cette surface.")
  return value
}

/** Le réseau courant, ou `null` hors d'un `NetworkProvider` (surfaces montées avant l'adhésion). */
export function useOptionalNetwork(): NetworkContextValue | null {
  return useContext(NetworkContext)
}

/** Les adresses de l'application ; lève hors d'un `NetworkProvider`. */
export function useRoutes(): EngineRoutes {
  const value = useContext(RoutesContext)
  if (!value) throw new Error("@antia/api/network : aucune table de routes injectée (NetworkProvider).")
  return value
}
