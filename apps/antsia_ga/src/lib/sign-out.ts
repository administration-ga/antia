"use client"
import { signOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { authClient } from "./auth-client"
import { routes } from "./routes"

/** Rechargement complet : les singletons, médias et caches de l'onglet disparaissent. */
export async function signOutAndRedirect(): Promise<void> {
  await signOutEverywhere(authClient, {
    navigate: (result) => window.location.assign(routes.signedOut(!result.serverRevoked || !result.localCleared)),
  })
}
