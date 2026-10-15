// Dupliqué de socle/convex/modules/messagerieScope/transfert.ts @ ad2e7fdc2 — adaptations : la frontière n'est plus « fil de poste / fil personnel » mais le RÉSEAU — source et cible dans le réseau de la fonction appelée, un fil d'un autre réseau dont je suis partie est un refus EXPLICITE (`MESSAGE_FORWARD_CROSS_NETWORK`), jamais un filtrage muet ; source et cible PERSONNELLES pour ce lot (la source et la cible de groupe s'ajoutent au lot 11, avec la provenance `group`) ; cible `personal` au lieu de `chat` ; pièces RECOPIÉES par la garde du moteur (`verifyDeclaredAttachments` sans acteur : le blob est celui de l'original, relu au stockage, et l'original reste son propriétaire) ; contenu rejugé par le contrat ; un seul point d'insertion (`appendPersonalMessage` : aperçu, pastille, idempotence) ; ressortissants (`isPublicUser`), poste et push retirés (D20) ; débit propre, et celui de l'ouverture d'un fil quand la cible est un identifiant ; refus à code.
/**
 * TRANSFÉRER un message vers une autre conversation du MÊME réseau.
 *
 * Deux surfaces de fuite, fermées ici :
 *  1. **jamais d'un réseau à l'autre** : le réseau de la source et celui de la
 *     cible sont résolus côté SERVEUR (par le fil, jamais par un argument
 *     client), et un écart est un refus explicite ;
 *  2. **le serveur relit CHAQUE pièce** avant de la recopier : son identifiant
 *     vient du message d'origine, jamais du client ; un blob disparu refuse du
 *     même mot qu'un identifiant inventé.
 *
 * Refusés aussi : un message RETIRÉ ou MASQUÉ de ma vue (le transfert serait le
 * seul endroit où il survivrait), un message qui n'est pas du texte (un appel,
 * un événement : il annonce un fait de SON fil), un destinataire implicite (la
 * cible est TOUJOURS choisie : un fil existant, ou une personne du réseau par
 * son identifiant, qui ouvre le fil s'il n'existe pas — avec les gardes de
 * `startThreadWithHandle`, dans leur ordre).
 *
 * La copie porte `forwardedFrom` — une PROVENANCE, relue à chaque lecture :
 * l'original retiré emporte la marque.
 */
import { assertMessageContent } from "@antia/social-contracts/messaging"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked, failRule, notFound } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { isBlockedBetween } from "../graph/graph"
import { findPublishedPersonByHandle } from "../people/miniProfile"
import { verifyDeclaredAttachments } from "./attachmentStorage"
import { assertCanOpenPersonalThread } from "./inbox"
import { requireThread } from "./participation"
import { appendPersonalMessage, ensurePersonalThread, findIdempotentReplay, isHiddenFor, otherParticipant } from "./threads"

/** La cible d'un transfert — TOUJOURS explicite, jamais « le dernier fil ». */
const forwardTargetValidator = v.union(v.object({ kind: v.literal("personal"), threadId: v.id("personalThreads") }), v.object({ kind: v.literal("handle"), handle: v.string() }))

type ForwardTarget = { kind: "personal"; threadId: Id<"personalThreads"> } | { kind: "handle"; handle: string }

type NetworkCtx = MutationCtx & { networkId: Id<"networks">; person: Doc<"persons"> }

/**
 * Le fil personnel où je suis partie, DANS le réseau appelé. Un fil d'un AUTRE
 * réseau dont je suis partie se refuse explicitement — je le connais, le dire
 * ne révèle rien ; tout le reste est le refus indistinct de la garde du fil.
 */
async function requireThreadOfThisNetwork(ctx: NetworkCtx, threadId: Id<"personalThreads">): Promise<Doc<"personalThreads">> {
  const thread = await ctx.db.get(threadId)
  if (thread !== null && thread.networkId !== ctx.networkId && otherParticipant(thread, ctx.person._id) !== null) {
    return failRule("MESSAGE_FORWARD_CROSS_NETWORK")
  }
  return (await requireThread(ctx, ctx.networkId, threadId, ctx.person._id)).thread
}

/**
 * Ce message peut-il revivre ailleurs ? Pas un événement ; pas retiré ; pas
 * masqué de MA vue — ce dernier se dit comme une absence : il ne m'est plus
 * servi, je n'ai donc rien à transférer.
 */
function assertForwardable(message: Doc<"personalMessages">, readerId: Id<"persons">): void {
  if (isHiddenFor(message, readerId)) notFound()
  if (message.type !== undefined && message.type !== "text") failRule("MESSAGE_FORWARD_NOT_TEXT")
  if (message.deletedAt !== undefined) failRule("MESSAGE_FORWARD_UNAVAILABLE")
}

/**
 * La cible, résolue côté serveur. `personal` : un fil où je suis partie, actif ;
 * `handle` : les gardes de `startThreadWithHandle` mot pour mot — identifiant
 * publié dans le réseau puis blocage (le MÊME refus), soi-même, relation pour
 * un fil NEUF — puis le fil, continué ou créé.
 */
async function resolveTarget(ctx: NetworkCtx, to: ForwardTarget): Promise<{ thread: Doc<"personalThreads">; created: boolean }> {
  if (to.kind === "personal") {
    const thread = await requireThreadOfThisNetwork(ctx, to.threadId)
    if (thread.status !== "active") return failRule("THREAD_ARCHIVED")
    return { thread, created: false }
  }
  const found = await findPublishedPersonByHandle(ctx, ctx.networkId, to.handle)
  if (!found) return notFound()
  if (found._id === ctx.person._id) return failRule("THREAD_SELF")
  if (await isBlockedBetween(ctx, ctx.person._id, found._id)) return notFound()
  await assertCanOpenPersonalThread(ctx, ctx.networkId, ctx.person._id, found._id)
  return await ensurePersonalThread(ctx, ctx.networkId, ctx.person._id, found._id)
}

/**
 * Transférer un message d'un fil personnel vers un autre fil personnel du
 * réseau, ou vers une personne du réseau. L'écran propose, le serveur décide :
 * participation au fil source, état du message, réseau des deux bouts,
 * existence réelle des pièces et politique de la cible sont rejugés ici.
 */
export const forwardMessage = networkMutation({
  minStatus: "declaree",
  args: { messageId: v.id("personalMessages"), to: forwardTargetValidator, idempotencyKey: v.optional(v.string()) },
  returns: v.object({ threadId: v.id("personalThreads"), messageId: v.id("personalMessages"), createdThread: v.boolean(), deduplicated: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.forward", ctx.person._id)
    // Ouvrir un fil par un transfert reste ouvrir un fil : un seul budget, quel que soit le chemin.
    if (args.to.kind === "handle") await enforceRateLimit(ctx, "thread.open", ctx.person._id)
    const source = await ctx.db.get(args.messageId)
    if (!source) return notFound()
    // Lire la source, c'est être partie à SON fil, sans blocage avec son auteur
    // (dans un fil 1:1, l'auteur est moi ou l'autre participant : la garde du fil suffit).
    const sourceThread = await requireThreadOfThisNetwork(ctx, source.threadId)
    assertForwardable(source, ctx.person._id)
    const files = source.attachmentFiles ?? []
    // Le texte et les pièces de la SOURCE, relus côté serveur — jamais un argument client.
    const content = checked(() => assertMessageContent(source.content ?? "", files.length > 0))
    const { thread, created } = await resolveTarget(ctx, args.to)
    const replay = created ? null : await findIdempotentReplay(ctx, thread._id, args.idempotencyKey)
    if (replay) return { threadId: thread._id, messageId: replay._id, createdThread: false, deduplicated: true }
    const attachmentFiles = await verifyDeclaredAttachments(
      ctx,
      files.map((file) => ({ storageId: file.storageId, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes, ...(file.durationMs !== undefined ? { durationMs: file.durationMs } : {}) })),
      { networkId: ctx.networkId, source: "message" },
    )
    const messageId = await appendPersonalMessage(ctx, thread, {
      senderPersonId: ctx.person._id,
      content,
      ...(attachmentFiles ? { attachmentFiles } : {}),
      ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
      forwardedFrom: { kind: "personal", threadId: sourceThread._id, messageId: source._id },
    })
    return { threadId: thread._id, messageId, createdThread: created, deduplicated: false }
  },
})
