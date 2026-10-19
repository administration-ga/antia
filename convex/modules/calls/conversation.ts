/**
 * CC-4 (contrat CONVERSATION-CONTEXTUELLE-V1 §11.3, ADR-0025) — le SÉLECTEUR UNIQUE du contexte de
 * conversation d'un appel.
 *
 * Un appel porte au plus UN contexte de conversation : `commercialThreadId` (contact commercial P10)
 * OU `contextualThreadId` (conversation contextuelle), jamais les deux. Tous les embranchements des
 * appels passent par ce sélecteur au lieu d'une seconde chaîne de conditions : accès, sonnerie,
 * ouverture d'avis, jeton court, fermeture de salle, journal, refus de la messagerie vocale et de
 * l'appel de groupe. Les deux contextes à la fois sont une INCOHÉRENCE (`conflict`), refusée partout,
 * jamais un droit.
 *
 * Module PUR (aucune lecture, types seulement) : l'action Node du jeton l'importe sans tirer le
 * graphe des modules. Les règles VIVANTES de chaque famille vivent dans `conversationAccess.ts`.
 */
import type { Id } from "../../_generated/dataModel"

/** Les colonnes de contexte d'un appel (ou d'une autorisation de jeton). */
export type CallConversationFields = {
  readonly commercialThreadId?: Id<"commercialThreads">
  readonly contextualThreadId?: Id<"contextualThreads">
}

export type CallConversation =
  | { readonly kind: "none" }
  | { readonly kind: "commercial"; readonly threadId: Id<"commercialThreads"> }
  | { readonly kind: "contextual"; readonly threadId: Id<"contextualThreads"> }
  | { readonly kind: "conflict" }

/** Le contexte de conversation d'un appel, lu sur ses colonnes. */
export function callConversationOf(fields: CallConversationFields): CallConversation {
  const commercial = fields.commercialThreadId
  const contextual = fields.contextualThreadId
  if (commercial !== undefined && contextual !== undefined) return { kind: "conflict" }
  if (commercial !== undefined) return { kind: "commercial", threadId: commercial }
  if (contextual !== undefined) return { kind: "contextual", threadId: contextual }
  return { kind: "none" }
}

/**
 * Un appel de CONVERSATION (commerciale, contextuelle, ou incohérente) : tête-à-tête strict, ni
 * messagerie vocale ni appel de groupe, jeton court relu à chaque émission, salle fermée à la fin.
 */
export function isConversationCall(fields: CallConversationFields): boolean {
  return callConversationOf(fields).kind !== "none"
}

/**
 * Les colonnes à recopier (insertion d'un appel, DTO). Une incohérence ne recopie rien : elle est
 * refusée en amont par chaque porte.
 */
export function conversationFieldsOf(conversation: CallConversation): CallConversationFields {
  if (conversation.kind === "commercial") return { commercialThreadId: conversation.threadId }
  if (conversation.kind === "contextual") return { contextualThreadId: conversation.threadId }
  return {}
}

/** Les colonnes de contexte d'un appel, telles que ses DTO les rendent (aucune pour un appel personnel). */
export function conversationFieldsOfCall(fields: CallConversationFields): CallConversationFields {
  return conversationFieldsOf(callConversationOf(fields))
}

/**
 * Durée de vie d'un jeton de salle d'un appel de conversation : courte, le fil étant relu à chaque
 * émission. Limite assumée (§4.3) : un jeton déjà émis n'est pas révoqué cryptographiquement ; la
 * salle est fermée par `finishCall`.
 */
export const CONVERSATION_CALL_TOKEN_TTL = "60s"
