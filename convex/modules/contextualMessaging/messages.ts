/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §5, §10.1) — messages contextuels : lecture paginée,
 * URL de dépôt, envoi idempotent, retrait par l'émetteur.
 *
 * Ordre des gardes d'écriture (§5.2) : adhésion et budget personnel (constructeur, seau
 * `contextual.message`) → droit (relecture complète) → statut d'écriture de la nature → règles du
 * message. Un refus de droit consomme le budget personnel sans rien révéler. Le seau
 * `contextual.thread`, lui, n'est consommé qu'APRÈS le droit : un tiers qui connaîtrait
 * l'identifiant d'un fil ne pourrait pas en épuiser le budget.
 */
import { isAppRule } from "@antsia/social-contracts/errors"
import {
  CONTEXTUAL_ATTACHMENTS_MAX,
  CONTEXTUAL_MESSAGES_PAGE_MAX,
  CONTEXTUAL_MESSAGES_ROWS_MAX,
  CONTEXTUAL_MODERATION_SURFACE,
  CONTEXTUAL_PAGE_BYTES_MAX,
  contextualDigestMaterial,
  contextualIdempotencyKey,
  contextualReplay,
  contextualText,
} from "@antsia/social-domain/contextualMessaging"
import { type PaginationResult, paginationOptsValidator, paginationResultValidator } from "convex/server"
import { type Infer, v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { fail, failAppRule, failRule, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { guardUploadUrl } from "../../lib/uploadPolicy"
import { purgeStoredFile } from "../files/purge"
import { withheldCodeValidator } from "../files/storageGuard"
import { attachmentFileValidator, type DeclaredAttachment } from "../messaging/attachmentStorage"
import { deliverAttachments } from "../messaging/participation"
import { moderateOwnedContentWrite } from "../moderation/policy"
import { pageCardValidator } from "../pages/validators"
import { type ContextualAccess, contextualMessageReadable, contextualThreadAccess, messageEmitterOf, sliceTextRule } from "./access"
import { admitContextualAttachments } from "./attachments"
import { notifyContextualActivity } from "./hooks"
import { markPersonRead } from "./personStates"
import { type ContextualLabel, contextualLabels, contextualLabelValidator, contextualPageCards } from "./projection"
import { CONTEXTUAL_REGISTRY, type ContextualRegistry } from "./registry"
import { contextualSideValidator, contextualVoiceValidator } from "./tables"

/** Lignes relues pour un rejeu : une clé n'est réutilisée que par erreur, par quelques émetteurs au plus. */
const REPLAY_SCAN = 8

/** Le message projeté (forme P10) : ni clé, ni empreinte, ni identifiant de stockage. */
export const contextualMessageValidator = v.object({
  messageId: v.id("contextualMessages"),
  side: contextualSideValidator,
  voice: contextualVoiceValidator,
  /** L'émetteur : une personne sous son libellé publié, ou la page — le coéquipier n'est montré qu'à l'équipe. */
  sender: v.union(
    v.object({ kind: v.literal("person"), label: contextualLabelValidator }),
    v.object({ kind: v.literal("page"), page: v.union(pageCardValidator, v.null()), teammate: v.union(contextualLabelValidator, v.null()) }),
  ),
  isMine: v.boolean(),
  content: v.union(v.string(), v.null()),
  deleted: v.boolean(),
  withheld: v.boolean(),
  attachmentFiles: v.array(v.object({
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    durationMs: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    withheld: v.union(withheldCodeValidator, v.null()),
  })),
  createdAt: v.number(),
})
export type ContextualMessageDto = Infer<typeof contextualMessageValidator>

/** SHA-256 hexadécimal du JSON canonique du domaine (modèle `commercialDigest`). */
export async function contextualDigest(material: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material)))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

const NEUTRAL_LABEL: ContextualLabel = { displayName: null, handle: null, avatarUrl: null }

async function projectMessage(
  ctx: Pick<QueryCtx, "db" | "storage">,
  access: ContextualAccess,
  personId: Id<"persons">,
  row: Doc<"contextualMessages">,
  helpers: { labelOf: ReturnType<typeof contextualLabels>; cardOf: ReturnType<typeof contextualPageCards> },
): Promise<ContextualMessageDto> {
  const deleted = row.deletedAt !== undefined
  const withheld = !deleted && !(await contextualMessageReadable(ctx, row, access, personId))
  const sender: ContextualMessageDto["sender"] = row.voice === "page"
    ? {
      kind: "page",
      page: await helpers.cardOf(access.responderPage),
      // Le coéquipier qui a écrit n'est visible que de l'équipe ; jamais du demandeur (D3, N33).
      teammate: access.side === "responder" && row.pageSpeakerPersonId !== undefined ? await helpers.labelOf(row.pageSpeakerPersonId) : null,
    }
    : { kind: "person", label: row.authorPersonId !== undefined ? await helpers.labelOf(row.authorPersonId) : NEUTRAL_LABEL }
  return {
    messageId: row._id,
    side: row.side,
    voice: row.voice,
    sender,
    isMine: messageEmitterOf(row) === personId,
    content: deleted || withheld ? null : (row.content ?? null),
    deleted,
    withheld,
    attachmentFiles: deleted || withheld ? [] : await deliverAttachments(ctx, row.attachmentFiles ?? []),
    createdAt: row.createdAt,
  }
}

/** Les messages d'un fil, du plus récent au plus ancien (≤ 40 messages, 80 lignes lues, 512 Kio). */
export const paginateMessages = networkQuery({
  args: { threadId: v.id("contextualThreads"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(contextualMessageValidator),
  handler: async (ctx, args): Promise<PaginationResult<ContextualMessageDto>> => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    if (access === null) return notFound()
    const window = await ctx.db
      .query("contextualMessages")
      .withIndex("by_thread_createdAt", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(CONTEXTUAL_MESSAGES_PAGE_MAX, Math.max(1, Math.trunc(args.paginationOpts.numItems))),
        maximumRowsRead: CONTEXTUAL_MESSAGES_ROWS_MAX,
        maximumBytesRead: CONTEXTUAL_PAGE_BYTES_MAX,
      })
    const helpers = { labelOf: contextualLabels(ctx), cardOf: contextualPageCards(ctx) }
    const page: ContextualMessageDto[] = []
    for (const row of window.page) {
      if (row.networkId !== ctx.networkId) continue
      page.push(await projectMessage(ctx, access, ctx.person._id, row, helpers))
    }
    return { ...window, page }
  },
})

/** Le refus d'une pièce pour une partie : celui de l'envoi d'abord, puis la fermeture des pièces. */
function attachmentRefusal(access: ContextualAccess): never {
  const { capabilities } = access
  if (!capabilities.canSend) return capabilities.sendRefusal !== null ? failRule(capabilities.sendRefusal) : fail("statusInsufficient")
  return failRule(capabilities.attachRefusal ?? "CONTEXT_ATTACHMENTS_CLOSED")
}

/** URL de dépôt d'une pièce : partie actuelle, capacité de joindre, usage `chat_attachment` (§5.7). */
export const generateUploadUrl = networkMutation({
  writeBucket: "upload.url",
  args: { threadId: v.id("contextualThreads") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    if (access === null) return notFound()
    if (!access.capabilities.canAttach) return attachmentRefusal(access)
    return await guardUploadUrl(ctx, "chat_attachment")
  },
})

/**
 * L'envoi d'un message (§5.5, §5.6, §5.7) : relecture complète, rejeu idempotent lié au fil et à
 * l'émetteur, capacités et premier mot, budget du fil, règle de texte de la tranche, pièces par la
 * garde, modération (propriétaire personne ou page), avis neutre si le message est publié.
 */
export async function sendContextualMessage(
  ctx: MutationCtx,
  actor: { readonly networkId: Id<"networks">; readonly personId: Id<"persons"> },
  args: { readonly threadId: Id<"contextualThreads">; readonly text: string; readonly attachments?: readonly DeclaredAttachment[]; readonly idempotencyKey: string },
  registry: ContextualRegistry = CONTEXTUAL_REGISTRY,
): Promise<{ messageId: Id<"contextualMessages">; deduplicated: boolean }> {
  const access = await contextualThreadAccess(ctx, { ...actor, threadId: args.threadId }, registry)
  if (access === null) return notFound()
  if (!contextualIdempotencyKey(args.idempotencyKey)) return fail("invalidArgument", { field: "idempotencyKey" })
  const declared = args.attachments ?? []
  const text = contextualText(args.text, declared.length > 0)
  if (!text.ok) return failRule(text.rule, text.params)
  // Le NOMBRE avant toute lecture du stockage (D9).
  if (declared.length > CONTEXTUAL_ATTACHMENTS_MAX) return failRule("ATTACHMENTS_TOO_MANY", { max: CONTEXTUAL_ATTACHMENTS_MAX })
  const digest = await contextualDigest(contextualDigestMaterial({ kind: access.thread.kind, threadId: access.thread._id, text: text.text, attachments: declared }))
  // Rejeu : la ligne de CET émetteur seulement ; un message admis avant une fermeture est rendu tel quel.
  const previous = await ctx.db.query("contextualMessages").withIndex("by_thread_key", (q) => q.eq("threadId", access.thread._id).eq("idempotencyKey", args.idempotencyKey)).take(REPLAY_SCAN)
  const replay = contextualReplay(previous.map((row) => ({ row, emitterPersonId: messageEmitterOf(row), digest: row.digest })), actor.personId, digest)
  if (replay.kind === "replay") return { messageId: replay.row.row._id, deduplicated: true }
  if (replay.kind === "conflict") return fail("conflict", { rule: "CONTEXT_IDEMPOTENCY_CONFLICT" })
  const { capabilities } = access
  if (!capabilities.canSend) return capabilities.sendRefusal !== null ? failRule(capabilities.sendRefusal) : fail("statusInsufficient")
  if (declared.length > 0 && !capabilities.canAttach) return attachmentRefusal(access)
  await enforceRateLimit(ctx, "contextual.thread", access.thread._id)
  if (text.text.length > 0) {
    // D8 : règle de la tranche, au texte normalisé et au contexte de l'émetteur ; code fermé, jamais journalisé.
    const verdict = sliceTextRule(access.thread.kind, { text: text.text, side: access.side, voice: access.voice }, registry)
    if (!verdict.ok) return isAppRule(verdict.code) ? failAppRule(verdict.code, {}, "invalidArgument") : fail("invalidArgument", { field: "text" })
  }
  const attachmentFiles = await admitContextualAttachments(ctx, declared, actor)
  const now = Date.now()
  const messageId = await ctx.db.insert("contextualMessages", {
    networkId: access.thread.networkId,
    threadId: access.thread._id,
    side: access.side,
    voice: access.voice,
    ...(access.voice === "person" ? { authorPersonId: actor.personId } : { pageSpeakerPersonId: actor.personId }),
    ...(text.text.length > 0 ? { content: text.text } : {}),
    ...(attachmentFiles ? { attachmentFiles } : {}),
    idempotencyKey: args.idempotencyKey,
    digest,
    createdAt: now,
  })
  await ctx.db.patch(access.thread._id, {
    lastMessageAt: now,
    updatedAt: now,
    revision: access.thread.revision + 1,
    // Le premier mot du répondant est acquis par son message (D4).
    ...(access.side === "responder" && access.thread.responderSpokeAt === undefined ? { responderSpokeAt: now } : {}),
  })
  await markPersonRead(ctx, access.thread, actor.personId, now)
  const page = access.responderPage
  const owner = access.voice === "page" && page !== null ? { pageId: page._id } : { personId: actor.personId }
  const published = await moderateOwnedContentWrite(ctx, { networkId: access.thread.networkId, owner, kind: CONTEXTUAL_MODERATION_SURFACE, id: messageId, text: text.text })
  // Un message en relecture n'émet aucun avis (N35) ; sa libération l'émettra.
  if (published) await notifyContextualActivity(ctx, access, { actorPersonId: actor.personId, kind: "contextual_message" })
  return { messageId, deduplicated: false }
}

export const send = networkMutation({
  writeBucket: "contextual.message",
  args: { threadId: v.id("contextualThreads"), text: v.string(), attachments: v.optional(v.array(attachmentFileValidator)), idempotencyKey: v.string() },
  returns: v.object({ messageId: v.id("contextualMessages"), deduplicated: v.boolean() }),
  handler: async (ctx, args) => await sendContextualMessage(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args),
})

/**
 * Retrait de son propre message (auteur, ou signataire qui a porté la voix de page), tant qu'il
 * lit le fil ; les blobs sont purgés avec lui ; le message apparaît `deleted` pour tous.
 */
export const remove = networkMutation({
  minStatus: "en_attente",
  writeBucket: "contextual.manage",
  args: { threadId: v.id("contextualThreads"), messageId: v.id("contextualMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    if (access === null) return notFound()
    const row = await ctx.db.get(args.messageId)
    if (row === null || row.networkId !== ctx.networkId || row.threadId !== access.thread._id || messageEmitterOf(row) !== ctx.person._id || row.side !== access.side) return notFound()
    if (row.deletedAt !== undefined) return null
    for (const file of row.attachmentFiles ?? []) await purgeStoredFile(ctx, file.storageId)
    await ctx.db.patch(row._id, { content: undefined, attachmentFiles: undefined, deletedAt: Date.now() })
    return null
  },
})
