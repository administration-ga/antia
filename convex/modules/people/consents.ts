/**
 * Consentements — accordés par un GESTE de la personne, horodatés, sur une
 * version de texte, révocables en un geste (EXF-AN-08). Jamais de case
 * précochée : une ligne n'existe que parce que la personne l'a voulue.
 */
import { CONSENT_TEXT_VERSIONS, isConsentInForce } from "@antia/social-domain/consent"
import { v } from "convex/values"

import { notFound } from "../../lib/errors"
import { personMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { consentOriginValidator, consentPurposeValidator } from "../../lib/validators"

/**
 * @selfScoped La personne de la session accorde un consentement (une finalité,
 * le texte courant). Idempotente : un consentement déjà en vigueur ne se double pas.
 */
export const recordConsent = personMutation({
  args: { purpose: consentPurposeValidator, origin: consentOriginValidator, networkId: v.optional(v.id("networks")) },
  returns: v.null(),
  handler: async (ctx, { purpose, origin, networkId }) => {
    await enforceRateLimit(ctx, "person.consent", ctx.person._id)
    if (networkId && !(await ctx.db.get(networkId))) return notFound()
    // borné : un consentement par finalité et par réseau.
    const rows = await ctx.db
      .query("consents")
      .withIndex("by_person_and_purpose", (q) => q.eq("personId", ctx.person._id).eq("purpose", purpose))
      .take(100)
    const scoped = rows.filter((row) => row.networkId === networkId)
    if (isConsentInForce(scoped, purpose)) return null
    await ctx.db.insert("consents", {
      personId: ctx.person._id,
      ...(networkId ? { networkId } : {}),
      purpose,
      textVersion: CONSENT_TEXT_VERSIONS[purpose],
      origin,
      grantedAt: Date.now(),
    })
    return null
  },
})

/** @selfScoped La personne de la session révoque un consentement, en un geste (toutes ses lignes en vigueur). */
export const revokeConsent = personMutation({
  args: { purpose: consentPurposeValidator, networkId: v.optional(v.id("networks")) },
  returns: v.null(),
  handler: async (ctx, { purpose, networkId }) => {
    await enforceRateLimit(ctx, "person.consent", ctx.person._id)
    // borné : un consentement par finalité et par réseau.
    const rows = await ctx.db
      .query("consents")
      .withIndex("by_person_and_purpose", (q) => q.eq("personId", ctx.person._id).eq("purpose", purpose))
      .take(100)
    const now = Date.now()
    for (const row of rows) if (row.networkId === networkId && row.revokedAt === undefined) await ctx.db.patch(row._id, { revokedAt: now })
    return null
  },
})
