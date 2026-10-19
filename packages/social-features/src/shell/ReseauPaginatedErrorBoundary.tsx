// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReseauPaginatedErrorBoundary.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`), à côté de `ReseauQueryError` qu'il rend ; modificateurs `override` posés sur les membres hérités de `Component` (règle `noImplicitOverride` du moteur), paramètres inutilisés de `componentDidCatch` retirés ; contrat des props inchangé (titre et message déjà traduits par l'appelant) ; comportement inchangé.
"use client"

import { Component, type ReactNode } from "react"
import { ReseauQueryError } from "./ReseauQueryError"

export class ReseauPaginatedErrorBoundary extends Component<
  {
    children: ReactNode
    resetKey: string
    title: string
    message: string
  },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch() {
    // Convex/React conserve le détail technique dans sa télémétrie : l'erreur
    // et sa pile n'ont rien à faire ici.
  }

  override componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <ReseauQueryError
        title={this.props.title}
        message={this.props.message}
        onRetry={() => this.setState({ error: null })}
      />
    )
  }
}
