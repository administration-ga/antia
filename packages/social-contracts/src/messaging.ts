// Dupliqué de socle/convex/schemas/chatMessages.ts (l. 1-20, `MESSAGE_EDIT_WINDOW_MS`) @ ad2e7fdc2 — adaptations : la fenêtre d'édition sortie du schéma vers le contrat partagé (le client en a besoin autant que la mutation) ; borne de longueur d'un message ajoutée (le socle n'en avait pas pour le 1:1) ; contenu jugé par une règle du domaine.
/**
 * Ce qu'un message de conversation est, des deux côtés de l'API.
 */
import { DomainViolation } from "@antsia/social-domain/violation"

/**
 * Fenêtre pendant laquelle l'AUTEUR peut encore modifier ou retirer son
 * message — 15 minutes. Le client la lit pour n'offrir « Modifier » que tant
 * qu'elle est ouverte ; la mutation la tient.
 */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

/** Un message n'est pas un document : 4 000 caractères au plus. */
export const MESSAGE_MAX_LENGTH = 4000

/** Le texte d'un message, nettoyé : vide seulement s'il porte des pièces ; borné. */
export function assertMessageContent(text: string, hasAttachments: boolean): string {
  const trimmed = text.trim()
  if (trimmed.length === 0 && !hasAttachments) throw new DomainViolation("MESSAGE_EMPTY")
  if (trimmed.length > MESSAGE_MAX_LENGTH) throw new DomainViolation("MESSAGE_TOO_LONG", { max: MESSAGE_MAX_LENGTH })
  return trimmed
}

/** La fenêtre d'édition est-elle encore ouverte pour ce message ? */
export function isWithinEditWindow(createdAt: number, now: number): boolean {
  return now - createdAt <= MESSAGE_EDIT_WINDOW_MS
}
