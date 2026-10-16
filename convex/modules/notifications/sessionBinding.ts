/** Une permission d'appareil est liée à la session qui l'a accordée, jamais réadoptée après logout. */
import { components } from "../../_generated/api"
import type { Doc } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
export async function subscriptionIsLive(ctx: Pick<QueryCtx, "db" | "runQuery">, subscription: Doc<"pushSubscriptions">): Promise<boolean> {
  if (!subscription.active || !subscription.sessionId) return false
  const person = await ctx.db.get(subscription.personId)
  if (!person || person.deletionRequestedAt !== undefined || person.erasedAt !== undefined) return false
  const session: unknown = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "_id", value: subscription.sessionId }] })
  return typeof session === "object" && session !== null && "_id" in session && session._id === subscription.sessionId
    && "userId" in session && session.userId === person.authUserId && "expiresAt" in session
    && typeof session.expiresAt === "number" && session.expiresAt > Date.now()
}
