"use client"

/**
 * La COUCHE DE COMMUNICATION du moteur, montée UNE fois par l'application, à une
 * position stable de l'arbre, sous `NetworkProvider` (doctrine d'`app-shell.tsx`
 * du socle, l. 270-330, sans AppShell) :
 *  · l'hôte UNIQUE de la couche d'appel (pool de salles, connecteur, entrants,
 *    surface, tonalités, Échap) ;
 *  · le battement de présence dans le réseau courant ;
 *  · le stockage local du dock iCom et du magasin d'appel (sortie audio),
 *    préfixé par le réseau (un état par réseau).
 *
 * Le dock iCom lui-même n'est PAS monté ici : comme au socle, il se pose dans le
 * rail de la page qui l'accueille (et se détache en carte flottante vers `body`).
 * L'hôte du direct (`DirectSessionHost`) rejoint cette couche avec le lot `live`.
 */
import { useNetwork } from "@antia/api/network"

import { configureDockStorage } from "../features/messagerie/dock-store"
import { configureCallStoreStorage } from "../stores"
import { GlobalCallSurfaceHost } from "./communication/global-call-surface-host"
import { DirectSessionHost } from "./communication/direct-session-host"
import { usePresenceHeartbeat } from "./presence/use-presence-heartbeat"

export function CommunicationShell() {
  const { storagePrefix, liveAvailable } = useNetwork()
  // Idempotent et synchrone : le dock lit son état au premier rendu.
  configureDockStorage(storagePrefix)
  configureCallStoreStorage(storagePrefix)
  usePresenceHeartbeat()
  return <><GlobalCallSurfaceHost />{liveAvailable ? <DirectSessionHost /> : null}</>
}
