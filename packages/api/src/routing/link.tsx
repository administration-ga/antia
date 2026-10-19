// Dupliqué de socle/packages/routing/src/link.tsx @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

import { useRouterImplementation } from "./provider"
import type { LinkProps } from "./types"

export function Link(props: LinkProps) {
  const { LinkComponent } = useRouterImplementation()
  return <LinkComponent {...props} />
}
