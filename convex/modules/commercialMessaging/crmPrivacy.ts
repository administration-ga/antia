/** P10 : révocation en lots avant effacement, y compris si la session disparaît. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import { internalMutation } from "../../_generated/server"
import { revokeCommercialCrmForPerson } from "./crm"

export const revokeCrmPersonRef = makeFunctionReference<"mutation", { personId: Id<"persons"> }, null>("modules/commercialMessaging/crmPrivacy:revokeForPerson")
export const revokeForPerson = internalMutation({
  args: { personId: v.id("persons") }, returns: v.null(),
  handler: async (ctx, args) => {
    if (!await revokeCommercialCrmForPerson(ctx, args.personId)) await ctx.scheduler.runAfter(60_000, revokeCrmPersonRef, args)
    return null
  },
})
