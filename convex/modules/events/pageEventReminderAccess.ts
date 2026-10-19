/** DG-023 : garde de lecture du rappel, sans écrivain de cloche ni module events.ts. */
import { associationEventReminderAt } from "../diaspora/associationEventRules"

import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isDiasporaNetwork } from "../diaspora/facts"
import { isFederatedPage } from "../federation/mirrorAccess"
import { readablePageOrNull } from "../pages/access"
import { pageEventAccess } from "./pageEventAccess"

/** Réutilisée à l'écriture, à la lecture de cloche et avant tout transport. */
export async function pageEventReminderVisible(ctx: Pick<QueryCtx, "db">, networkId: Id<"networks">, eventId: Id<"events">, personId: Id<"persons">): Promise<boolean> {
  const event = await ctx.db.get(eventId)
  const now = Date.now()
  if (!event || event.networkId !== networkId || !event.organizerPageId || event.organizerPersonId !== undefined || event.status !== "scheduled" || now >= event.startAt || now < associationEventReminderAt(event.startAt)) return false
  const person = await ctx.db.get(personId)
  if (!person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined) return false
  const participation = await ctx.db.query("eventParticipants")
    .withIndex("by_event_person", (q) => q.eq("eventId", eventId).eq("personId", personId)).unique()
  if (!participation || participation.networkId !== networkId || participation.status !== "accepted" || participation.pageReminderEnabled !== true) return false
  const network = await ctx.db.get(networkId)
  if (!isDiasporaNetwork(network)) return false
  const page = await readablePageOrNull(ctx, network, event.organizerPageId)
  if (!page || page.networkId !== networkId || page.ownerKind !== "association" || await isFederatedPage(ctx, page._id)) return false
  return (await pageEventAccess(ctx, event, personId))?.moderation === "published"
}
