/**
 * La personne — identité sociale UNIQUE d'un être humain dans le moteur
 * (invariant 2), créée à la première session sans rien recopier ni publier
 * (invariant 7). Les badges ne sont pas stockés : ils sont calculés ici, à
 * chaque lecture, à partir des liens d'identité (invariant 5).
 */
import { computePersonBadges, hasStrongIdentity } from "@antia/social-domain/badges"
import { isConsentInForce } from "@antia/social-domain/consent"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import { mutation, query, type QueryCtx } from "../../_generated/server"
import { getCurrentPerson } from "../../lib/access"
import { fail } from "../../lib/errors"
import { enforceRateLimit } from "../../lib/rateLimit"
import { badgeValidator, consentPurposeValidator, localeValidator } from "../../lib/validators"

/** Liens d'identité VIVANTS d'une personne (bornés : un par fournisseur, quatre fournisseurs). */
export async function liveIdentityLinks(ctx: QueryCtx, personId: Id<"persons">): Promise<Doc<"identityLinks">[]> {
  // borné : au plus un lien par fournisseur et par personne (quatre fournisseurs).
  const links = await ctx.db
    .query("identityLinks")
    .withIndex("by_person_and_provider", (q) => q.eq("personId", personId))
    .take(16)
  return links.filter((link) => link.revokedAt === undefined)
}

export async function badgesOf(ctx: QueryCtx, personId: Id<"persons">) {
  return computePersonBadges(await liveIdentityLinks(ctx, personId))
}

export async function hasStrongIdentityFor(ctx: QueryCtx, personId: Id<"persons">): Promise<boolean> {
  return hasStrongIdentity(await liveIdentityLinks(ctx, personId))
}

const myPersonValidator = v.object({
  _id: v.id("persons"),
  handle: v.optional(v.string()),
  displayName: v.optional(v.string()),
  headline: v.optional(v.string()),
  published: v.boolean(),
  private: v.boolean(),
  locale: v.optional(localeValidator),
  timeZone: v.optional(v.string()),
  badges: v.array(badgeValidator),
  consentsInForce: v.array(consentPurposeValidator),
})

/**
 * @selfScoped La personne de la session lit SA propre fiche (aucun contenu d'un
 * réseau) ; `null` tant qu'elle n'existe pas encore (première session).
 */
export const getMyPerson = query({
  args: {},
  returns: v.union(myPersonValidator, v.null()),
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx)
    if (!person) return null
    // borné : un consentement par finalité et par réseau, six finalités.
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_person_and_purpose", (q) => q.eq("personId", person._id))
      .take(100)
    const purposes = [...new Set(consents.map((consent) => consent.purpose))].filter((purpose) => isConsentInForce(consents, purpose))
    return {
      _id: person._id,
      ...(person.handle ? { handle: person.handle } : {}),
      ...(person.displayName ? { displayName: person.displayName } : {}),
      ...(person.headline ? { headline: person.headline } : {}),
      published: person.publishedAt !== undefined && person.withdrawnAt === undefined,
      private: person.privateAt !== undefined,
      ...(person.locale ? { locale: person.locale } : {}),
      ...(person.timeZone ? { timeZone: person.timeZone } : {}),
      badges: await badgesOf(ctx, person._id),
      consentsInForce: purposes,
    }
  },
})

/**
 * @selfScoped Première session : crée la personne liée au jeton, SANS
 * identifiant, nom ni adhésion (rien n'est recopié, rien n'est publié).
 * Idempotente : rend la personne existante.
 */
export const ensureMyPerson = mutation({
  args: {},
  returns: v.id("persons"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return fail("unauthenticated")
    const existing = await ctx.db
      .query("persons")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique()
    if (existing) return existing._id
    await enforceRateLimit(ctx, "person.ensure", identity.subject)
    const now = Date.now()
    return await ctx.db.insert("persons", { authUserId: identity.subject, createdAt: now, updatedAt: now })
  },
})
