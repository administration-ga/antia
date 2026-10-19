// Dupliqué de socle/convex/modules/reseauPersonnel/connectionState.ts @ ad2e7fdc2 — adaptations : `Doc<"connections">`/`Id<"users">` remplacés par une forme structurelle en identifiants de personnes ; statuts de connexion repris de socle/convex/modules/reseau/enums.ts (l. 183-189) ; `canonicalPair` et `viewConnection` (purs) repris de socle/convex/modules/reseau/connections.ts (l. 60-140), le blocage étant lu sur TOUTE la paire (tous réseaux) par l'appelant.
/**
 * connectionState — l'état d'une demande de relation, projeté pour UN lecteur.
 *
 * Module PUR : la même projection sert la lecture d'un état de demande et le
 * DTO des notifications, qui la pose sur chaque ligne de demande comme ÉTAT
 * VIVANT : relue à l'instant, la connexion dit s'il reste quelque chose à
 * décider.
 */

/** Les états d'une connexion entre deux personnes d'un même réseau. */
export const CONNECTION_STATUSES = ["requested", "accepted", "declined", "blocked"] as const
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export type ConnectionInviteStatus = ConnectionStatus | "missing"

/** Ce qu'il faut d'une ligne de connexion pour la projeter (paire canonique). */
export interface ConnectionRowFacts<PersonId extends string = string> {
  personIdLow: PersonId
  personIdHigh: PersonId
  requestedByPersonId: PersonId
  status: ConnectionStatus
}

export interface ConnectionInviteState {
  status: ConnectionInviteStatus
  /** Suis-je la personne à qui la demande s'adresse (et non son auteur) ? */
  iAmRecipient: boolean
}

/**
 * `null` quand le lecteur n'est PAS partie à la connexion : la notification n'a
 * alors aucun état à montrer, et ne doit surtout pas en inventer un. Une ligne
 * absente rend `missing` — une réponse utile (« invitation annulée »), pas une
 * erreur.
 */
export function pendingStateOf<PersonId extends string>(
  row: ConnectionRowFacts<PersonId> | null,
  me: PersonId,
): ConnectionInviteState | null {
  if (!row) return { status: "missing", iAmRecipient: false }
  if (row.personIdLow !== me && row.personIdHigh !== me) return null
  return { status: row.status, iAmRecipient: row.requestedByPersonId !== me }
}

/**
 * Ordonne deux identifiants pour qu'une paire ait toujours la même clé : les
 * identifiants sont des chaînes, la comparaison lexicographique est stable.
 */
export function canonicalPair<PersonId extends string>(a: PersonId, b: PersonId): { low: PersonId; high: PersonId } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
}

/**
 * L'état d'une relation, du point de vue d'un observateur. Un blocage est
 * UNILATÉRAL : celui qui est bloqué ne l'apprend pas, il voit `none`, comme s'il
 * n'y avait jamais eu de lien — sinon le blocage devient un signal, et un signal
 * se contourne.
 */
export type ConnectionView<ConnectionId extends string = string> =
  | { state: "none" }
  | { state: "requested_by_me"; connectionId: ConnectionId }
  | { state: "requested_by_them"; connectionId: ConnectionId; message?: string }
  | { state: "connected"; connectionId: ConnectionId; since: number }
  | { state: "declined"; connectionId: ConnectionId }
  | { state: "blocked_by_me"; connectionId: ConnectionId | null }

export interface ConnectionViewFacts<PersonId extends string, ConnectionId extends string> extends ConnectionRowFacts<PersonId> {
  _id: ConnectionId
  blockedByPersonId?: PersonId
  message?: string
  requestedAt: number
  respondedAt?: number
}

export function viewConnection<PersonId extends string, ConnectionId extends string>(
  connection: ConnectionViewFacts<PersonId, ConnectionId> | null,
  observer: PersonId,
): ConnectionView<ConnectionId> {
  if (!connection) return { state: "none" }
  if (connection.status === "blocked") {
    return connection.blockedByPersonId === observer ? { state: "blocked_by_me", connectionId: connection._id } : { state: "none" }
  }
  if (connection.status === "accepted") {
    return { state: "connected", connectionId: connection._id, since: connection.respondedAt ?? connection.requestedAt }
  }
  if (connection.status === "declined") return { state: "declined", connectionId: connection._id }
  return connection.requestedByPersonId === observer
    ? { state: "requested_by_me", connectionId: connection._id }
    : { state: "requested_by_them", connectionId: connection._id, ...(connection.message ? { message: connection.message } : {}) }
}
