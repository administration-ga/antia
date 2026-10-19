/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §6, §7, §10.2) — aides internes offertes aux
 * tranches et effets de la conversation. Aucune fonction Convex publique ici.
 *
 * Crochets de la tranche (CC-3b), appelés DANS la transaction de ses transitions :
 *   - `openContextualConversation(ctx, ref)` : après une transition d'OUVERTURE (demande de service
 *     envoyée, mentorat accepté, candidature présélectionnée). Idempotente par `contextKey` ; rend
 *     « non ouvert » quand la politique est fermée ou qu'un côté manque ; ne crée ni message, ni
 *     avis, ni appel ; n'échoue JAMAIS pour un refus.
 *   - `syncContextualConversation(ctx, ref)` : après TOUTE autre transition, y compris les passages
 *     internes (échéances, retrait, décisions de la modération). Recalcule la phase, écrit le cache,
 *     relit les appels vivants du fil et arrête ceux qui ne sont plus admis (CC-4) ; n'échoue jamais
 *     pour un refus. Un crochet manqué ne change pas l'accès (relu sans cache).
 *   - `purgeContextualConversation(ctx, ref)` : AVANT de supprimer un objet hors effacement ;
 *     planifie la purge par tranches bornées.
 *
 * Avis (§7) : deux genres neutres, rédacteur unique `notifyPerson`, l'AUTRE côté seulement, aucun
 * contenu ; en voix de page, aucun acteur.
 */
import { CONTEXTUAL_READ_MIN_STATUS, CONTEXTUAL_TEAM_NOTICE_MAX, contextualReferencesConsistent, type ContextualNotificationKind, nextContextualCache } from "@antsia/social-domain/contextualMessaging"
import { makeFunctionReference } from "convex/server"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { notFound, failRule } from "../../lib/errors"
import { isBlockedBetween } from "../graph/graph"
import { notifyPerson } from "../notifications/notify"
import { signatoryRowsOf } from "../pages/access"
import {
  accessForThread,
  blockedForParty,
  type ContextualAccess,
  contextKeyOf,
  contextualPolicyEnabled,
  counterpartAvailableFor,
  findThreadForObject,
  livingParty,
  liveTeamMember,
  loadContextualSnapshot,
  messageEmitterOf,
  objectVisibleTo,
  partyOf,
  referenceColumnsOf,
  responderAvailable,
  snapshotMatchesThread,
  snapshotShapeValid,
  withContextualMemo,
} from "./access"
import { revalidateContextualThreadCalls, stopContextualThreadCalls } from "./callAccess"
import type { ContextualObjectRef, ContextualSnapshot } from "./contract"
import { CONTEXTUAL_REGISTRY, type ContextualRegistry } from "./registry"

const purgeSlice = makeFunctionReference<"mutation", { threadId: Id<"contextualThreads"> }, boolean>("modules/contextualMessaging/retention:purgeSlice")

export type ContextualOpenResult = { readonly opened: true; readonly threadId: Id<"contextualThreads">; readonly created: boolean } | { readonly opened: false }

/** Insère le fil d'un objet relu en phase `open` : une seule ligne par `contextKey`, aucune autre écriture. */
async function insertThread(ctx: Pick<MutationCtx, "db">, ref: ContextualObjectRef, snapshot: ContextualSnapshot, now: number): Promise<Id<"contextualThreads"> | null> {
  const key = contextKeyOf(ref)
  const references = referenceColumnsOf(ref)
  if (key === null || !contextualReferencesConsistent(ref.kind, references) || !snapshotShapeValid(ref.kind, snapshot)) return null
  return await ctx.db.insert("contextualThreads", {
    networkId: snapshot.networkId,
    kind: ref.kind,
    contextKey: key,
    ...references,
    requesterPersonId: snapshot.requester.personId,
    ...("pageId" in snapshot.responder ? { responderPageId: snapshot.responder.pageId } : { responderPersonId: snapshot.responder.personId }),
    status: "open",
    revision: 1,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

/** Les deux côtés sont-ils présents (demandeur vivant, au moins une personne vivante habilitée en face) ? */
async function bothSidesPresent(ctx: MutationCtx, snapshot: ContextualSnapshot): Promise<boolean> {
  const memo = withContextualMemo(ctx)
  if (!(await livingParty(memo, snapshot.networkId, snapshot.requester.personId, CONTEXTUAL_READ_MIN_STATUS))) return false
  const page = "pageId" in snapshot.responder ? await ctx.db.get(snapshot.responder.pageId) : null
  return await responderAvailable(memo, snapshot.networkId, snapshot, page)
}

/**
 * Crochet d'OUVERTURE de la tranche (§4.1, chemin 1 ; §6.1). Rend le fil (créé ou retrouvé) ou
 * « non ouvert » ; ne lève jamais pour un refus et ne fait donc jamais échouer le geste de la tranche.
 */
export async function openContextualConversation(ctx: MutationCtx, ref: ContextualObjectRef, registry: ContextualRegistry = CONTEXTUAL_REGISTRY): Promise<ContextualOpenResult> {
  const now = Date.now()
  const snapshot = await loadContextualSnapshot(ctx, ref, now, registry)
  if (snapshot === null || snapshot.phase !== "open" || !snapshotShapeValid(ref.kind, snapshot)) return { opened: false }
  const existing = await findThreadForObject(ctx, ref)
  if (existing !== null) return snapshotMatchesThread(snapshot, existing) ? { opened: true, threadId: existing._id, created: false } : { opened: false }
  if (!(await contextualPolicyEnabled(ctx, snapshot.networkId, ref.kind))) return { opened: false }
  if (!(await bothSidesPresent(ctx, snapshot))) return { opened: false }
  const threadId = await insertThread(ctx, ref, snapshot, now)
  return threadId === null ? { opened: false } : { opened: true, threadId, created: true }
}

/**
 * Ouverture à la demande d'une PARTIE (`threads.openForObject`, §4.1 chemin 2) : objet antérieur au
 * module, politique ouverte après coup, crochet manqué. Tiers : refus indistinct ; partie : refus
 * explicite fermé (`CONTEXT_NOT_OPEN`, `CONTEXT_CLOSED`, `CONTEXT_UNAVAILABLE`). Idempotente.
 */
export async function openForParty(ctx: MutationCtx, actor: { readonly networkId: Id<"networks">; readonly personId: Id<"persons"> }, ref: ContextualObjectRef, registry: ContextualRegistry = CONTEXTUAL_REGISTRY): Promise<{ threadId: Id<"contextualThreads">; created: boolean }> {
  const now = Date.now()
  const memo = withContextualMemo(ctx)
  const snapshot = await loadContextualSnapshot(ctx, ref, now, registry)
  if (snapshot === null || snapshot.networkId !== actor.networkId || !snapshotShapeValid(ref.kind, snapshot)) return notFound()
  const existing = await findThreadForObject(ctx, ref)
  if (existing !== null) {
    // Un fil existe déjà : la relecture complète décide, y compris des clés divergentes (absent pour tous).
    return (await accessForThread(memo, existing, actor.personId, registry)) === null ? notFound() : { threadId: existing._id, created: false }
  }
  const party = await partyOf(memo, snapshot, actor.personId)
  if (party === null || !(await livingParty(memo, snapshot.networkId, actor.personId, CONTEXTUAL_READ_MIN_STATUS))) return notFound()
  if (!(await objectVisibleTo(ctx, ref, actor.personId, now, registry)) || (await blockedForParty(memo, snapshot, party.side, actor.personId))) return notFound()
  if (snapshot.phase === "not_open") return failRule("CONTEXT_NOT_OPEN")
  if (snapshot.phase === "closed" || !(await contextualPolicyEnabled(memo, snapshot.networkId, ref.kind))) return failRule("CONTEXT_CLOSED")
  if (!(await counterpartAvailableFor(memo, snapshot.networkId, snapshot, party))) return failRule("CONTEXT_UNAVAILABLE")
  const threadId = await insertThread(ctx, ref, snapshot, now)
  return threadId === null ? notFound() : { threadId, created: true }
}

export type ContextualSyncResult = { readonly threadId: Id<"contextualThreads"> | null; readonly change: "none" | "opened" | "closed" | "reopened" | "unchanged" }

/**
 * Crochet de SYNCHRONISATION de la tranche (§6.3) : relit l'objet, écrit le cache et le premier
 * mot acquis par un geste de l'objet (D4). Sans fil et en phase `open`, ouvre comme le crochet
 * d'ouverture (rattrape un crochet manqué). N'échoue jamais pour un refus. L'accès, lui, ne lit
 * jamais ce cache.
 */
export async function syncContextualConversation(ctx: MutationCtx, ref: ContextualObjectRef, registry: ContextualRegistry = CONTEXTUAL_REGISTRY): Promise<ContextualSyncResult> {
  const thread = await findThreadForObject(ctx, ref)
  const now = Date.now()
  const snapshot = await loadContextualSnapshot(ctx, ref, now, registry)
  if (thread === null) {
    if (snapshot === null || snapshot.phase !== "open") return { threadId: null, change: "none" }
    const opened = await openContextualConversation(ctx, ref, registry)
    return opened.opened ? { threadId: opened.threadId, change: opened.created ? "opened" : "unchanged" } : { threadId: null, change: "none" }
  }
  // Objet disparu, illisible ou divergent : le cache se ferme ; la purge reste un geste explicite (§6.5).
  const live = snapshot !== null && snapshotMatchesThread(snapshot, thread) ? snapshot : null
  const phase = live === null ? "closed" : live.phase
  const decision = nextContextualCache(thread, phase)
  const firstWord = live !== null && live.phase === "open" && !live.responderFirst && thread.responderSpokeAt === undefined
  if (decision === "unchanged" && !firstWord) {
    // CC-4 : une transition sans effet sur le cache peut retirer la phase « engagée » : chaque appel vivant est relu.
    await revalidateContextualThreadCalls(ctx, thread._id, registry)
    return { threadId: thread._id, change: "unchanged" }
  }
  const patch: Partial<Doc<"contextualThreads">> = { revision: thread.revision + 1, updatedAt: now }
  if (firstWord) patch.responderSpokeAt = now
  if (decision === "close") {
    patch.status = "closed"
    patch.closedAt = now
    patch.closedCause = "object"
  } else if (decision === "reopen") {
    patch.status = "open"
    patch.closedAt = undefined
    patch.closedCause = undefined
  }
  await ctx.db.patch(thread._id, patch)
  // CC-4 : chaque appel vivant du fil (`calls.contextualThreadId`) est relu dans cette transaction : fermeture, phase non
  // engagée ou perte d'une partie l'arrêtent (`finishCall`, salle fermée). Les pertes nées hors du module : `retention.revalidateCalls`.
  await revalidateContextualThreadCalls(ctx, thread._id, registry)
  return { threadId: thread._id, change: decision === "close" ? "closed" : decision === "reopen" ? "reopened" : "unchanged" }
}

/**
 * Crochet de PURGE de la tranche (§6.5), avant la suppression d'un objet hors effacement : la purge
 * procède par tranches bornées (vingt messages et leurs blobs par transaction, puis les états
 * personnels, puis le fil). L'objet supprimé, la conversation est déjà absente pour tous.
 */
export async function purgeContextualConversation(ctx: MutationCtx, ref: ContextualObjectRef): Promise<{ readonly scheduled: boolean }> {
  const thread = await findThreadForObject(ctx, ref)
  if (thread === null) return { scheduled: false }
  const now = Date.now()
  // CC-4 : l'objet va disparaître — ses appels s'arrêtent dans la transaction de la tranche, avant la purge.
  await stopContextualThreadCalls(ctx, thread._id)
  await ctx.db.patch(thread._id, { purgeAt: now, updatedAt: now })
  await ctx.scheduler.runAfter(0, purgeSlice, { threadId: thread._id })
  return { scheduled: true }
}

// ═══════════════════════════════════════════════════════════════
// Avis (§7)
// ═══════════════════════════════════════════════════════════════

/**
 * Les destinataires d'un avis : l'AUTRE côté seulement. Côté personne, la personne ; côté page,
 * vingt signataires vivants au plus, administrateurs d'abord, jamais bloqués avec le demandeur.
 */
async function counterpartRecipients(ctx: MutationCtx, access: ContextualAccess, actorPersonId: Id<"persons">): Promise<Id<"persons">[]> {
  const { snapshot } = access
  if (access.side === "responder") return [snapshot.requester.personId]
  if ("personId" in snapshot.responder) return [snapshot.responder.personId]
  const page = access.responderPage
  if (page === null) return []
  const memo = withContextualMemo(ctx)
  const recipients: Id<"persons">[] = []
  // borné : plafond des signataires d'une page ; administrateurs d'abord (`signatoryRowsOf`), vingt au plus.
  for (const row of await signatoryRowsOf(ctx, page._id)) {
    if (recipients.length >= CONTEXTUAL_TEAM_NOTICE_MAX) break
    if (row.acceptedAt === undefined || row.personId === actorPersonId) continue
    if (await liveTeamMember(memo, access.thread.networkId, page, row.personId, snapshot.requester.personId)) recipients.push(row.personId)
  }
  return recipients
}

/**
 * Un avis neutre à l'autre côté. En voix de personne, l'acteur est l'émetteur ; en voix de page,
 * AUCUN acteur (avis du système) : le signataire ne sert qu'aux refus « soi-même » et « blocage ».
 * La porte (`notifyPerson`) relit encore chaque destinataire (`canReadContextualThread`).
 */
export async function notifyContextualActivity(ctx: MutationCtx, access: ContextualAccess, input: { readonly actorPersonId: Id<"persons">; readonly kind: ContextualNotificationKind }): Promise<void> {
  for (const recipientPersonId of await counterpartRecipients(ctx, access, input.actorPersonId)) {
    if (recipientPersonId === input.actorPersonId || (await isBlockedBetween(ctx, input.actorPersonId, recipientPersonId))) continue
    await notifyPerson(ctx, {
      networkId: access.thread.networkId,
      recipientPersonId,
      ...(access.voice === "person" ? { actorPersonId: input.actorPersonId } : {}),
      kind: input.kind,
      subject: { contextualThread: access.thread._id },
    })
  }
}

/**
 * Un message sorti de relecture (modération : approuvé) émet l'avis qu'il n'avait pas émis (§7 :
 * un message en relecture n'émet rien). L'émetteur est RELU : s'il n'est plus partie, rien.
 */
export async function onContextualMessageReleased(ctx: MutationCtx, messageId: Id<"contextualMessages">): Promise<void> {
  const message = await ctx.db.get(messageId)
  if (message === null || message.deletedAt !== undefined) return
  const emitter = messageEmitterOf(message)
  const thread = await ctx.db.get(message.threadId)
  if (emitter === null || thread === null) return
  const access = await accessForThread(withContextualMemo(ctx), thread, emitter)
  if (access === null || access.side !== message.side || access.voice !== message.voice) return
  await notifyContextualActivity(ctx, access, { actorPersonId: emitter, kind: "contextual_message" })
}
