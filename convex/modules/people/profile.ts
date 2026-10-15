// Dupliqué de socle/convex/modules/reseauPersonnel/people.ts (l. 230-330 et 440-530) @ ad2e7fdc2 — adaptations : la paire `users` + `reseauPersonnel_profiles` devient `persons` ; propositions dérivées du nom que la personne SAISIT (jamais d'état civil recopié) ; un identifiant abandonné reste réservé à son ancien titulaire (`handleHistory`) ; bornes par les règles du domaine (`checked`) ; limitation de débit ; refus `handleUnavailable` sans phrase.
/**
 * Le profil social d'une personne : son identifiant public (`@handle`), son nom
 * affiché, son accroche. Rien n'est publié d'office (invariant 7) : c'est la
 * personne qui choisit et publie.
 */
import { assertDisplayName, assertHandle, assertHeadline, normalizeHandle } from "@antia/social-domain/content"
import { handleLadder } from "@antia/social-domain/handleSuggestion"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { checked, fail } from "../../lib/errors"
import { personMutation, personQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"

/**
 * Un identifiant est-il libre POUR cette personne ? Pris par une autre
 * personne, ou porté naguère par une autre (un identifiant est une ADRESSE : le
 * recycler ferait suivre les liens anciens vers quelqu'un d'autre) : non.
 */
async function isHandleFreeFor(ctx: QueryCtx, handle: string, personId: Id<"persons">): Promise<boolean> {
  const holder = await ctx.db
    .query("persons")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique()
  if (holder && holder._id !== personId) return false
  // borné : un identifiant n'a qu'une poignée de titulaires successifs.
  const past = await ctx.db
    .query("handleHistory")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .take(20)
  return past.every((row) => row.personId === personId)
}

/**
 * @selfScoped La personne de la session reçoit les identifiants proposés à
 * partir du nom qu'elle saisit, avec leur disponibilité. Aucune forme n'est
 * pré-sélectionnée : l'ordre est une présentation, pas une préférence.
 */
export const suggestHandles = personQuery({
  args: { displayName: v.string() },
  returns: v.array(v.object({ handle: v.string(), available: v.boolean() })),
  handler: async (ctx, { displayName }) => {
    const ladder = handleLadder({ name: displayName.slice(0, 120) }).slice(0, 8)
    const suggestions = []
    for (const handle of ladder) suggestions.push({ handle, available: await isHandleFreeFor(ctx, handle, ctx.person._id) })
    return suggestions
  },
})

/**
 * @selfScoped La personne de la session vérifie si un identifiant de SON choix
 * est libre POUR ELLE (pris, ou porté naguère par une autre : non) — l'accueil
 * le vérifie avant les consentements. Une forme invalide lève la règle du
 * domaine (`HANDLE_LENGTH`, `HANDLE_CHARSET`), comme à la publication.
 */
export const isHandleAvailable = personQuery({
  args: { handle: v.string() },
  returns: v.object({ available: v.boolean() }),
  handler: async (ctx, { handle }) => {
    const normalized = checked(() => assertHandle(handle))
    return { available: await isHandleFreeFor(ctx, normalized, ctx.person._id) }
  },
})

/**
 * @selfScoped La personne de la session publie (ou met à jour) SON profil :
 * identifiant, nom affiché, accroche. Idempotente ; republier après un retrait
 * lève le retrait. Changer d'identifiant laisse l'ancien réservé à soi.
 */
export const publishMyProfile = personMutation({
  args: { handle: v.string(), displayName: v.string(), headline: v.optional(v.string()) },
  returns: v.object({ handle: v.string() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "person.profile", ctx.person._id)
    const handle = checked(() => assertHandle(args.handle))
    const displayName = checked(() => assertDisplayName(args.displayName))
    const headline = checked(() => assertHeadline(args.headline))
    if (!(await isHandleFreeFor(ctx, handle, ctx.person._id))) return fail("handleUnavailable")

    const now = Date.now()
    const previous = ctx.person.handle
    if (previous && normalizeHandle(previous) !== handle) {
      // borné : une personne change rarement d'identifiant.
      const open = await ctx.db
        .query("handleHistory")
        .withIndex("by_person", (q) => q.eq("personId", ctx.person._id))
        .take(50)
      for (const row of open) if (row.handle === previous && row.until === undefined) await ctx.db.patch(row._id, { until: now })
    }
    if (previous !== handle) await ctx.db.insert("handleHistory", { personId: ctx.person._id, handle, from: now })

    await ctx.db.patch(ctx.person._id, {
      handle,
      displayName,
      headline,
      publishedAt: ctx.person.publishedAt === undefined || ctx.person.withdrawnAt !== undefined ? now : ctx.person.publishedAt,
      withdrawnAt: undefined,
      updatedAt: now,
    })
    return { handle }
  },
})
