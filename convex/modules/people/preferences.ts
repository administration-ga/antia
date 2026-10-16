/** Préférences choisies par la personne, indépendantes des claims civils. */
import { v } from "convex/values"
import { personMutation } from "../../lib/functions"
import { fail } from "../../lib/errors"
import { enforceRateLimit } from "../../lib/rateLimit"
import { localeValidator } from "../../lib/validators"

/** @selfScoped La personne modifie uniquement sa langue et son fuseau horaire. */
export const setMyPreferences = personMutation({
  args: { locale: localeValidator, timeZone: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "person.profile", ctx.person._id)
    if (args.timeZone.length > 100 || !args.timeZone.trim()) return fail("invalidArgument", { field: "timeZone" })
    let timeZone: string
    try { timeZone = new Intl.DateTimeFormat("en", { timeZone: args.timeZone }).resolvedOptions().timeZone }
    catch { return fail("invalidArgument", { field: "timeZone" }) }
    if (ctx.person.locale !== args.locale || ctx.person.timeZone !== timeZone) await ctx.db.patch(ctx.person._id, { locale: args.locale, timeZone, updatedAt: Date.now() })
    return null
  },
})
