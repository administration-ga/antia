/**
 * P14 : cycle de vie des traces privées de services. Les corps signés vivent au plus trente
 * minutes ; une demande close (objet PRO.GA terminé, échec, abandon) est purgée après sa
 * durée technique ; une demande d'effacement expurge sans attendre les corps et baux de la
 * personne, et une commande encore en vol n'appliquera aucune réponse tardive. L'effacement
 * générique supprime ensuite les lignes (`DATA_TABLE_POLICIES`, propriétaire `personId`).
 * Aucun ordre distant n'est émis ici : un rendez-vous PRO.GA ne s'annule que par son client.
 */
import { COMMERCE_MAX_SKEW_MS } from "@antsia/social-domain/commerce/primitives"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { personQuery } from "../../lib/functions"
import { SERVICE_CLOSED_RETENTION_MS, SERVICE_COMMANDS_PER_REQUEST_MAX, SERVICE_PENDING_MAX_MS } from "./serviceRules"

const REVOCATION_PAGE = 25
export const continueServiceRevocationRef = makeFunctionReference<"mutation", { personId: Id<"persons"> }, null>("modules/shops/serviceLifecycle:continueServiceRevocation")
const purgeClosedRef = makeFunctionReference<"mutation", { requestRowId: string }, null>("modules/shops/serviceLifecycle:purgeClosed")
const closeStaleRef = makeFunctionReference<"mutation", { requestRowId: string }, null>("modules/shops/serviceLifecycle:closeStale")

/** À appeler DÈS la demande d'effacement, puis jusqu'à `true` (pages bornées). */
export async function revokeServicesForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<boolean> {
  const now = Date.now()
  const commands = await ctx.db.query("commerceServiceCommands").withIndex("by_person_private", (q) => q.eq("personId", personId).eq("privatePurgedAt", undefined)).take(REVOCATION_PAGE + 1)
  for (const row of commands.slice(0, REVOCATION_PAGE)) {
    await ctx.db.patch(row._id, {
      rawBody: undefined, leaseToken: undefined, leaseUntil: undefined, privatePurgedAt: now,
      // Une intention encore en vol ne recevra plus d'effet local (réponse tardive refusée).
      ...(row.state === "unknown" ? { cancelledAt: now, reason: "erasure_requested" } : {}), updatedAt: now,
    })
  }
  return commands.length <= REVOCATION_PAGE
}

/** P16 : lecture bornée des demandes les plus récentes pour l'avertissement d'effacement. */
const UPCOMING_BOOKINGS_SCAN = 100

/**
 * @selfScoped La personne appelante compte SES rendez-vous à venir avant de demander l'effacement
 * de son compte (P16) : l'effacement n'annule rien chez le professionnel, l'annulation reste son
 * geste depuis Mes demandes. Aucun réseau, contenu ni professionnel révélé ; lisible pendant le
 * délai de grâce, comme le reste de Mes données.
 */
export const myUpcomingBookings = personQuery({
  args: {}, returns: v.object({ count: v.number(), truncated: v.boolean() }),
  handler: async (ctx) => {
    const now = Date.now()
    const rows = await ctx.db.query("commerceServiceRequests").withIndex("by_person_network_updated", (q) => q.eq("personId", ctx.person._id)).order("desc").take(UPCOMING_BOOKINGS_SCAN + 1)
    const upcoming = rows.slice(0, UPCOMING_BOOKINGS_SCAN).filter((row) => row.cancelledAt === undefined && row.state !== "closed" && row.state !== "failed" &&
      row.booking !== undefined && (row.booking.state === "requested" || row.booking.state === "confirmed") && row.booking.endAt > now)
    return { count: upcoming.length, truncated: rows.length > UPCOMING_BOOKINGS_SCAN }
  },
})

export const continueServiceRevocation = internalMutation({
  args: { personId: v.id("persons") }, returns: v.null(),
  handler: async (ctx, args) => {
    if (!await revokeServicesForPerson(ctx, args.personId)) await ctx.scheduler.runAfter(0, continueServiceRevocationRef, { personId: args.personId })
    return null
  },
})

async function close(ctx: MutationCtx, rowId: Id<"commerceServiceRequests">, requestRowId: string, state: "closed" | "failed", reason: string, now: number): Promise<void> {
  const purgeAt = now + SERVICE_CLOSED_RETENTION_MS
  await ctx.db.patch(rowId, { state, reason, purgeAt, updatedAt: now })
  await ctx.scheduler.runAt(purgeAt, purgeClosedRef, { requestRowId })
}

/**
 * Une demande restée SANS effet (aucune réponse, reconfirmation laissée en suspens) se ferme
 * après sept jours ; une demande active sans nouvelle observation depuis la durée technique
 * se ferme aussi. Sinon la vérification est reprogrammée : jamais de ligne oubliée.
 */
export const closeStale = internalMutation({
  args: { requestRowId: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("commerceServiceRequests").withIndex("by_request", (q) => q.eq("requestRowId", args.requestRowId)).unique()
    if (!row || row.state === "closed" || row.state === "failed") return null
    const now = Date.now()
    const last = await ctx.db.query("commerceServiceCommands").withIndex("by_request_row", (q) => q.eq("requestRowId", row.requestRowId)).order("desc").first()
    // Une intention encore exécutable n'est jamais fermée sous elle.
    const inFlight = last !== null && last.state === "unknown" && last.cancelledAt === undefined && now <= last.expiresAt + COMMERCE_MAX_SKEW_MS
    if (!inFlight && row.state === "pending" && now - row.createdAt >= SERVICE_PENDING_MAX_MS) {
      await close(ctx, row._id, row.requestRowId, "failed", "abandoned", now)
      return null
    }
    if (!inFlight && row.state === "active" && now - row.updatedAt >= SERVICE_CLOSED_RETENTION_MS) {
      await close(ctx, row._id, row.requestRowId, "closed", "inactive", now)
      return null
    }
    await ctx.scheduler.runAfter(SERVICE_PENDING_MAX_MS, closeStaleRef, { requestRowId: row.requestRowId })
    return null
  },
})

/** Purge d'une demande close et de ses commandes, par pages bornées et reprise. */
export const purgeClosed = internalMutation({
  args: { requestRowId: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("commerceServiceRequests").withIndex("by_request", (q) => q.eq("requestRowId", args.requestRowId)).unique()
    const now = Date.now()
    if (row && (row.purgeAt === undefined || row.purgeAt > now || (row.state !== "closed" && row.state !== "failed"))) return null
    // borné : SERVICE_COMMANDS_PER_REQUEST_MAX + 1 commandes par passage, puis reprise.
    const commands = await ctx.db.query("commerceServiceCommands").withIndex("by_request_row", (q) => q.eq("requestRowId", args.requestRowId)).take(SERVICE_COMMANDS_PER_REQUEST_MAX + 1)
    for (const command of commands.slice(0, SERVICE_COMMANDS_PER_REQUEST_MAX)) await ctx.db.delete(command._id)
    if (commands.length > SERVICE_COMMANDS_PER_REQUEST_MAX) {
      await ctx.scheduler.runAfter(0, purgeClosedRef, { requestRowId: args.requestRowId })
      return null
    }
    if (row) await ctx.db.delete(row._id)
    return null
  },
})
