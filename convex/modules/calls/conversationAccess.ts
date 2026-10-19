/**
 * CC-4 (contrat CONVERSATION-CONTEXTUELLE-V1 §11.3, ADR-0025) — le sélecteur de contexte d'appel,
 * côté RÈGLES VIVANTES : chaque famille de conversation relit SA règle, et elle seule.
 *
 *   · aucun contexte (appel personnel ou de groupe) : `null`, le chemin habituel s'applique ;
 *   · contact commercial P10 : les règles de `commercialMessaging/access.ts`, INCHANGÉES ;
 *   · conversation contextuelle : les règles de `contextualMessaging/callAccess.ts` (§5.8, D5 (a)) ;
 *   · les deux contextes à la fois : incohérence, refus partout.
 *
 * Lu par `calls/{access,direct,history}.ts` et `notifications/{open,policy}.ts` : aucun de ces
 * fichiers ne porte de seconde chaîne de conditions par famille. Aucune fonction Convex ici.
 */
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { canParticipateCommercialCall, commercialCallPairAllowed } from "../commercialMessaging/access"
import { canParticipateContextualCall, contextualCallPairAllowed, contextualCallVisibleTo } from "../contextualMessaging/callAccess"
import { type CallConversation, callConversationOf } from "./conversation"

type ReadCtx = Pick<QueryCtx, "db">

/**
 * Le droit VIVANT d'une personne d'être dans un appel de conversation (sonnerie, décrochage, jeton,
 * état, gestes, avis d'appel) : `null` pour un appel sans conversation ; sinon la règle de sa famille.
 */
export async function canParticipateConversationCall(ctx: ReadCtx, call: Doc<"calls">, personId: Id<"persons">): Promise<boolean | null> {
  const conversation = callConversationOf(call)
  switch (conversation.kind) {
    case "none":
      return null
    case "conflict":
      return false
    case "commercial":
      return await canParticipateCommercialCall(ctx, call, personId)
    case "contextual":
      return await canParticipateContextualCall(ctx, call, personId)
  }
}

/**
 * Le JOURNAL d'un appel de conversation : `null` sans conversation ; P10 garde sa règle (droit d'appel
 * vivant, comportement inchangé) ; un appel contextuel reste au journal d'une personne de l'appel tant
 * qu'elle LIT le fil (« le journal rappelle par la conversation »).
 */
export async function conversationCallInJournal(ctx: ReadCtx, call: Doc<"calls">, personId: Id<"persons">): Promise<boolean | null> {
  const conversation = callConversationOf(call)
  switch (conversation.kind) {
    case "none":
      return null
    case "conflict":
      return false
    case "commercial":
      return await canParticipateCommercialCall(ctx, call, personId)
    case "contextual":
      return await contextualCallVisibleTo(ctx, call, personId)
  }
}

/**
 * La porte d'appel (`placeDirectCall`) : la paire appelant / appelé est-elle admise dans CE contexte,
 * dans CE réseau ? Sans contexte, rien de plus ; une incohérence est refusée.
 */
export async function conversationCallPairAllowed(ctx: ReadCtx, networkId: Id<"networks">, conversation: CallConversation, callerPersonId: Id<"persons">, calleePersonId: Id<"persons">): Promise<boolean> {
  switch (conversation.kind) {
    case "none":
      return true
    case "conflict":
      return false
    case "commercial": {
      const thread = await ctx.db.get(conversation.threadId)
      return thread !== null && thread.networkId === networkId && (await commercialCallPairAllowed(ctx, thread, callerPersonId, calleePersonId))
    }
    case "contextual": {
      const thread = await ctx.db.get(conversation.threadId)
      return thread !== null && thread.networkId === networkId && (await contextualCallPairAllowed(ctx, thread, callerPersonId, calleePersonId))
    }
  }
}
