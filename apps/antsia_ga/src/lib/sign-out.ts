"use client"
import { signOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { authClient } from "./auth-client"
import { routes } from "./routes"
import { requestSessionBridge, rotateSessionBridgeFence, withSessionBridgeLock } from "./session-bridge-client"

async function finishSignOut(generation: string | null): Promise<void> {
  let navigation: Promise<void> = Promise.resolve()
  await signOutEverywhere(authClient, {
    navigate: (result) => {
      // Le callback démarre la navigation, le verrou shared reste acquis jusqu'au nouveau document.
      navigation = (async () => {
        const bridgeCleared = generation !== null && await requestSessionBridge("DELETE", { generation, anonymous: result.localCleared })
        window.location.assign(routes.signedOut(!result.serverRevoked || !result.localCleared || !bridgeCleared))
      })()
    },
  })
  // Le callback partagé est synchrone : garder le verrou d'origine jusqu'à sa continuation.
  await navigation
}

/** Rechargement complet : les singletons, médias et caches de l'onglet disparaissent. */
export async function signOutAndRedirect(): Promise<void> {
  let started = false
  try {
    await withSessionBridgeLock(async () => {
      started = true
      let generation: string | null = null
      try { generation = rotateSessionBridgeFence() } catch { /* La sortie SDK et sa purge restent nécessaires. */ }
      await finishSignOut(generation)
    })
  } catch (error) {
    if (started) throw error
    // Sans verrou, révoquer/purger le SDK reste nécessaire ; aucun reçu étranger n'est touché.
    await finishSignOut(null)
  }
}
