/** Préférences choisies par la personne, indépendantes des claims civils. */
import { v } from "convex/values"
import type { Doc } from "../../_generated/dataModel"
import { personMutation } from "../../lib/functions"
import { fail } from "../../lib/errors"
import { enforceRateLimit } from "../../lib/rateLimit"
import { localeValidator, memberThemeValidator } from "../../lib/validators"

/**
 * @selfScoped La personne modifie uniquement sa langue, son fuseau horaire et son thème.
 * Chaque préférence absente reste inchangée : le formulaire envoie la langue et le
 * fuseau, le choix du thème (immédiat) n'envoie que le thème. Le thème a son propre
 * budget, pour qu'un membre qui parcourt les thèmes n'épuise pas celui des réglages.
 */
export const setMyPreferences = personMutation({
  args: { locale: v.optional(localeValidator), timeZone: v.optional(v.string()), theme: v.optional(memberThemeValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.locale === undefined && args.timeZone === undefined && args.theme === undefined) return fail("invalidArgument", { field: "preferences" })
    if (args.locale !== undefined || args.timeZone !== undefined) await enforceRateLimit(ctx, "person.profile", ctx.person._id)
    if (args.theme !== undefined) await enforceRateLimit(ctx, "person.theme", ctx.person._id)
    const patch: Partial<Pick<Doc<"persons">, "locale" | "timeZone" | "theme">> = {}
    if (args.timeZone !== undefined) {
      if (args.timeZone.length > 100 || !args.timeZone.trim()) return fail("invalidArgument", { field: "timeZone" })
      let timeZone: string
      try { timeZone = new Intl.DateTimeFormat("en", { timeZone: args.timeZone }).resolvedOptions().timeZone }
      catch { return fail("invalidArgument", { field: "timeZone" }) }
      if (ctx.person.timeZone !== timeZone) patch.timeZone = timeZone
    }
    if (args.locale !== undefined && ctx.person.locale !== args.locale) patch.locale = args.locale
    if (args.theme !== undefined && ctx.person.theme !== args.theme) patch.theme = args.theme
    if (Object.keys(patch).length > 0) await ctx.db.patch(ctx.person._id, { ...patch, updatedAt: Date.now() })
    return null
  },
})
