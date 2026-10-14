// Dupliqué de socle/convex/modules/reseauPersonnel/connectionState.ts @ ad2e7fdc2 — adaptations : `Doc<"connections">`/`Id<"users">` remplacés par une forme structurelle en identifiants de personnes ; statuts de connexion repris de socle/convex/modules/reseau/enums.ts (l. 183-189).
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
