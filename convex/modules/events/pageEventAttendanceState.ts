/** DG-023 : état de présence et invalidation, indépendant des API et des rappels. */
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { failAppRule } from "../../lib/errors"
import { engineCounters } from "../posts/counters"

const attendanceOf = (eventId: Id<"events">) => `events.pageAttendance:${eventId}`

export function nextPageEventAttendanceVersion(row: Doc<"eventParticipants">): number {
  const current = row.pageAttendanceVersion ?? 0
  if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + 1)) return failAppRule("association_event_attendance_changed")
  return current + 1
}

export async function countPageEventAttendance(ctx: Pick<QueryCtx, "runQuery">, eventId: Id<"events">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: attendanceOf(eventId) })
}

export async function recordPageEventAttendance(ctx: MutationCtx, row: Doc<"eventParticipants">): Promise<void> {
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: attendanceOf(row.eventId), key: 0, id: row._id })
}

/** Retrait, réinscription, correction ou effacement : invalide aussi un accueil déjà prévisualisé. */
export async function resetPageEventAttendance(ctx: MutationCtx, row: Doc<"eventParticipants">): Promise<void> {
  await engineCounters.deleteIfExists(ctx, { namespace: attendanceOf(row.eventId), key: 0, id: row._id })
  await ctx.db.patch(row._id, {
    pageAttendanceTokenHash: undefined, pageAttendanceTokenExpiresAt: undefined, pageAttendanceCheckedInAt: undefined,
    pageAttendanceVersion: nextPageEventAttendanceVersion(row),
  })
}
