// Dupliqué de plateforme/espace/espace_administration_ga/src/lib/convex-provider.tsx @ ad2e7fdc2 — adaptations : fournisseur partagé par les applications du moteur (URL Convex, client d'authentification, mutation « ma personne » et textes reçus en props) ; client Convex mémorisé par URL au lieu d'une constante de module.
"use client"

import { ConvexQueryClient } from "@convex-dev/react-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useConvexAuth, useMutation } from "convex/react"
import type { FunctionReference } from "convex/server"
import { type ReactNode, useEffect, useMemo, useRef } from "react"

import type { RefreshableCrossDomainAuthClient } from "./cross-domain-session-bootstrap"
import { type SessionBootstrapLabels, StableConvexBetterAuthProvider } from "./stable-convex-better-auth-provider"

/** Un client Convex par URL et par onglet : les montages successifs (StrictMode) le partagent. */
const clients = new Map<string, ConvexQueryClient>()
/** URL dont le client est déjà relié à TanStack Query (une seule fois par onglet). */
const connectedUrls = new Set<string>()

function convexClientFor(convexUrl: string): ConvexQueryClient {
  let client = clients.get(convexUrl)
  if (!client) {
    client = new ConvexQueryClient(convexUrl)
    clients.set(convexUrl, client)
  }
  return client
}

function connectOnce(convexUrl: string, client: ConvexQueryClient, queryClient: QueryClient): void {
  if (connectedUrls.has(convexUrl)) return
  try {
    client.connect(queryClient)
  } catch {
    // « already subscribed » : le client est de fait connecté.
  }
  connectedUrls.add(convexUrl)
}

/** Crée la personne du moteur à la première session authentifiée (rien n'est recopié ni publié). */
function PersonSync({ ensurePerson, children }: { ensurePerson: FunctionReference<"mutation", "public">; children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const ensure = useMutation(ensurePerson)
  const synced = useRef(false)

  useEffect(() => {
    if (isAuthenticated && !synced.current) {
      synced.current = true
      ensure({}).catch((error: unknown) => console.warn("[auth] création de la personne impossible", error))
    }
    if (!isAuthenticated) synced.current = false
  }, [isAuthenticated, ensure])

  return <>{children}</>
}

export function EngineConvexProvider(props: {
  convexUrl: string
  authClient: RefreshableCrossDomainAuthClient
  ensurePerson: FunctionReference<"mutation", "public">
  labels: SessionBootstrapLabels
  children: ReactNode
}) {
  const convexQueryClient = convexClientFor(props.convexUrl)
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryKeyHashFn: convexQueryClient.hashFn(),
            queryFn: convexQueryClient.queryFn(),
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
    [convexQueryClient],
  )

  useEffect(() => {
    connectOnce(props.convexUrl, convexQueryClient, queryClient)
  }, [props.convexUrl, convexQueryClient, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <StableConvexBetterAuthProvider client={convexQueryClient.convexClient} authClient={props.authClient} labels={props.labels}>
        <PersonSync ensurePerson={props.ensurePerson}>{props.children}</PersonSync>
      </StableConvexBetterAuthProvider>
    </QueryClientProvider>
  )
}
