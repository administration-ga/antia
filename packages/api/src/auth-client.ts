// Dupliqué de plateforme/espace/espace_administration_ga/src/lib/auth-client.ts @ ad2e7fdc2 — adaptations : fabrique partagée par les applications du moteur (au lieu d'un fichier par application) ; greffons `convexClient`, `crossDomainClient` et `emailOTPClient` (comptes légers) ; IDN (`genericOAuthClient`) et SMS (`phoneNumberClient`) arrivent avec PA4.
"use client"

import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/**
 * Client Better Auth d'une application du moteur. Les requêtes passent par le
 * proxy `/api/auth/*` de l'application elle-même (même origine) → actions HTTP
 * Convex ; le greffon `crossDomain` garde la session par origine.
 */
function buildClient() {
  return createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
    plugins: [convexClient(), crossDomainClient(), emailOTPClient()],
  })
}

type Client = ReturnType<typeof buildClient>

/**
 * `ConvexBetterAuthProvider` attend le type-mère `AuthClient`, dont
 * `useSession().data` vaut `never` avec better-auth 1.6 ; on garde l'inférence
 * complète des greffons et on n'élargit que les deux membres que le fournisseur
 * vérifie (même contournement que le socle).
 */
export type EngineAuthClient = Omit<Client, "useSession" | "$Infer"> & {
  useSession: Client["useSession"] & ((...args: never[]) => unknown)
  $Infer: unknown
}

export function createEngineAuthClient(): EngineAuthClient {
  return buildClient() as unknown as EngineAuthClient
}
