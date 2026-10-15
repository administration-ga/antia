import { COMPOSE_GROUPE_LEAF, COMPOSE_LEAF, CONVERSATION_ROUTE_KINDS } from "@antia/social-features/features/messagerie/messagerie-routes"

/** Ce que l'aiguillage de la messagerie (`MessagesRoute`) reçoit d'une adresse. */
export type MessagesRouteTarget = { kind?: string; id?: string; compose?: "personne" | "groupe" }

/**
 * Les segments d'une adresse de messagerie → l'aiguillage de `MessagesRoute`
 * (liste, composeurs, conversation `<genre>/<identifiant>`), `null` pour toute
 * autre forme (la page répond « introuvable »). Module PUR : la page serveur le
 * lit avant de rendre l'écran client.
 */
export function parseMessagesSegments(segments: readonly string[]): MessagesRouteTarget | null {
  if (segments.length === 0) return {}
  const [first, second, ...rest] = segments
  if (rest.length > 0 || first === undefined) return null
  if (second === undefined) {
    if (first === COMPOSE_LEAF) return { compose: "personne" }
    if (first === COMPOSE_GROUPE_LEAF) return { compose: "groupe" }
    return null
  }
  const kind = decodeURIComponent(first)
  if (!(CONVERSATION_ROUTE_KINDS as readonly string[]).includes(kind)) return null
  return { kind, id: decodeURIComponent(second) }
}
