/**
 * P10 : une fin d'appel ne transforme jamais un échange commercial en relation personnelle.
 * CC-5 : ni un appel CONTEXTUEL (mise en relation) — aucun rappel par l'appel personnel, aucun fil
 * personnel, aucun ajout de participant (ni appel de groupe) ; on revient à SA conversation, sous la
 * base de messagerie de l'application (`<base>/mise-en-relation/<fil>`), où l'accord et la cible
 * d'un nouvel appel sont relus.
 */
import { contextualConversationKey, draftKey } from "../messagerie/messagerie-dock"
import { conversationHref } from "../messagerie/messagerie-routes"

export function callEndActions(input: {
  meeting: { commercialThreadId?: string; contextualThreadId?: string } | null | undefined;
  kind: "direct" | "group";
  peer?: { userId?: string; handle?: string | null } | null;
  routes: { messages: () => string; commercialConversation?: (threadId: string) => string };
}): { retryAvailable: boolean; writeHref: string | null; addParticipantAvailable: boolean } {
  if (!input.meeting) return { retryAvailable: false, writeHref: null, addParticipantAvailable: false }
  if (input.meeting.commercialThreadId) return {
    retryAvailable: false,
    writeHref: input.routes.commercialConversation?.(input.meeting.commercialThreadId) ?? null,
    addParticipantAvailable: false,
  }
  if (input.meeting.contextualThreadId) return {
    retryAvailable: false,
    writeHref: conversationHref(contextualConversationKey(input.meeting.contextualThreadId), input.routes.messages()),
    addParticipantAvailable: false,
  }
  return {
    retryAvailable: input.kind !== "group" && input.peer?.userId !== undefined,
    writeHref: input.kind !== "group" && input.peer?.handle ? conversationHref(draftKey(input.peer.handle), input.routes.messages()) : null,
    addParticipantAvailable: true,
  }
}
