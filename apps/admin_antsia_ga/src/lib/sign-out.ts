"use client"

import { signOutEverywhere } from "@antsia/api/sign-out-everywhere"

import { authClient } from "./auth-client"
import { routes } from "./routes"

/** La navigation complète termine aussi les caches et stores de cet onglet. */
export async function signOutAndRedirect() {
  return signOutEverywhere(authClient, {
    navigate: (result) => window.location.assign(routes.signedOut(!result.serverRevoked || !result.localCleared)),
  })
}
