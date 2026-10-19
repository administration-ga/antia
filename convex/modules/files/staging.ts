/** Les copies fédérées non admises appartiennent à un reflet, jamais à un dépôt client. */
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"

type WriteCtx = Pick<MutationCtx, "db">

export async function reserveStagedFile(ctx: WriteCtx, mirror: Doc<"mirrors">, storageId: Id<"_storage">): Promise<void> {
  const existing = await ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", storageId)).unique()
  if (existing) {
    if (existing.mirrorId !== mirror._id || existing.networkId !== mirror.networkId) return fail("conflict")
    return
  }
  await ctx.db.insert("fileStagingReservations", { networkId: mirror.networkId, mirrorId: mirror._id, storageId, createdAt: Date.now() })
}

/** L'admission ou la purge effective libère la réservation dans sa transaction. */
export async function releaseStagedFile(ctx: WriteCtx, storageId: Id<"_storage">): Promise<void> {
  const existing = await ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", storageId)).unique()
  if (existing) await ctx.db.delete(existing._id)
}
