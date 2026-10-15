// Dupliqué de socle/packages/routing/src/provider.tsx @ ad2e7fdc2 — adaptations : message d'erreur au nom du paquet du moteur (`@antia/api/routing`).
"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { RouterImplementation } from "./types"

const RouterImplementationContext = createContext<RouterImplementation | null>(null)

export function RouterProvider({
  implementation,
  children,
}: {
  implementation: RouterImplementation
  children: ReactNode
}) {
  return (
    <RouterImplementationContext.Provider value={implementation}>
      {children}
    </RouterImplementationContext.Provider>
  )
}

export function useRouterImplementation(): RouterImplementation {
  const impl = useContext(RouterImplementationContext)
  if (!impl) {
    throw new Error(
      "@antia/api/routing : aucun RouterProvider. Envelopper l'application dans <RouterProvider implementation={…}> (ou NextRouterAdapter).",
    )
  }
  return impl
}
