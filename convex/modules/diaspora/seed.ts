/**
 * Graine du réseau `diasporale` — hors production seulement (double garde du
 * moteur : argument de confirmation ET déploiement local ou autorisé).
 *
 * Réseau fermé, enfant de la racine, GOUVERNÉ par la tranche `diaspora`,
 * politique « déclaré ou vérifié », visibilité « réseau », pays ouverts de
 * départ (arbitrage A8 : la France), facette diaspora au format du moteur, et un
 * hub par pays ouvert, compteurs à zéro jusqu'au premier passage nocturne.
 * Idempotente : rejouée, elle ne double rien. La racine doit exister (graine des
 * fondations d'abord). En production, la console crée le réseau avec
 * `managedBy: "diaspora"`.
 */
import { normalizeHandle } from "@antia/social-domain/content"
import { validateFacetSchema } from "@antia/social-domain/facets"
import { isValidNetworkSlug, validateNetworkShape } from "@antia/social-domain/network"
import { DAY_MS, DIASPORALE_NETWORK_SEED, DIASPORALE_SLICE, type EngineFacetField } from "@diasporale/domain"
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { getMembership, getRootNetwork } from "../../lib/access"
import { membershipStatusValidator } from "../../lib/validators"
import { assertSeedsAllowed, ensureNetwork } from "../../seeds/foundations"
import { liveIdentityLinks } from "../people/persons"
import { activeSponsorshipOf, applyDerivedStatus, facetOf, membershipGrounds } from "./facts"
import { hubRow } from "./hubs"

/** Un champ de facette du domaine (listes figées) au format mutable des tables du moteur. */
function engineFacetField(field: EngineFacetField) {
  return {
    key: field.key,
    kind: field.kind,
    required: field.required,
    defaultVisibility: field.defaultVisibility,
    ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
    ...(field.maxItems !== undefined ? { maxItems: field.maxItems } : {}),
    ...(field.excludedValues !== undefined ? { excludedValues: [...field.excludedValues] } : {}),
  }
}

export const run = internalMutation({
  args: { confirmNonProduction: v.string() },
  returns: v.object({ network: v.id("networks"), created: v.boolean(), hubs: v.array(v.string()) }),
  handler: async (ctx, { confirmNonProduction }) => {
    assertSeedsAllowed(confirmNonProduction)
    const root = await getRootNetwork(ctx)
    if (!root) throw new Error("Graine refusée : le réseau racine manque (graine des fondations d'abord).")

    const seed = DIASPORALE_NETWORK_SEED
    const facetSchema = { fields: seed.facetSchema.fields.map(engineFacetField) }
    const shapeErrors = validateNetworkShape({
      kind: seed.kind,
      parentId: root._id,
      membershipPolicy: seed.membershipPolicy,
      defaultVisibility: seed.defaultVisibility,
    })
    if (!isValidNetworkSlug(seed.slug) || shapeErrors.length > 0 || validateFacetSchema(facetSchema).length > 0) {
      throw new Error("Graine refusée : réglages du réseau diasporale invalides pour le moteur.")
    }

    const now = Date.now()
    const network = await ensureNetwork(ctx, seed.slug, () => ({
      slug: seed.slug,
      kind: seed.kind,
      parentId: root._id,
      managedBy: DIASPORALE_SLICE,
      name: seed.name,
      membershipPolicy: seed.membershipPolicy,
      defaultVisibility: seed.defaultVisibility,
      facetSchema,
      reachValues: [...seed.reachValues],
      openCountries: [...seed.openCountries],
      theme: seed.theme,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }))

    const hubs: string[] = []
    for (const country of seed.openCountries) {
      if (await hubRow(ctx, network.id, country)) continue
      await ctx.db.insert("countryHubs", {
        networkId: network.id,
        country,
        members: 0,
        associations: 0,
        companies: 0,
        upcomingEvents: 0,
        updatedAt: now,
      })
      hubs.push(country)
    }
    return { network: network.id, created: network.created, hubs }
  },
})

/** Poste FICTIF des attestations de recette : il ne désigne aucun poste consulaire réel. */
export const RECETTE_POST_SLUG = "poste-de-recette"

/**
 * Recette locale SEULEMENT (double garde des graines) : rend « vérifié » le membre
 * désigné par son identifiant, par une attestation consulaire FICTIVE (empreinte
 * « recette-… », poste de recette), vérifié depuis `verifiedDaysAgo` jours (31 par
 * défaut), pour jouer le parcours de parrainage (R3) sans consulat.ga. Rien n'est
 * créé d'office : la personne doit déjà être membre. Jamais en production.
 */
export const verifyForRecette = internalMutation({
  args: { confirmNonProduction: v.string(), handle: v.string(), verifiedDaysAgo: v.optional(v.number()) },
  returns: v.object({ status: membershipStatusValidator }),
  handler: async (ctx, args) => {
    assertSeedsAllowed(args.confirmNonProduction)
    const network = await ctx.db
      .query("networks")
      .withIndex("by_slug", (q) => q.eq("slug", DIASPORALE_NETWORK_SEED.slug))
      .unique()
    const person = await ctx.db
      .query("persons")
      .withIndex("by_handle", (q) => q.eq("handle", normalizeHandle(args.handle).replace(/^@/, "")))
      .unique()
    const membership = network && person ? await getMembership(ctx, network._id, person._id) : null
    if (!network || !person || !membership) throw new Error("Recette refusée : aucun membre de diasporale sous cet identifiant.")

    const now = Date.now()
    const links = await liveIdentityLinks(ctx, person._id)
    if (!links.some((link) => link.provider === "consular_attestation")) {
      const facet = await facetOf(ctx, network._id, person._id)
      await ctx.db.insert("identityLinks", {
        personId: person._id,
        provider: "consular_attestation",
        subject: `recette-${person._id}`,
        ...(facet ? { country: facet.countryOfResidence } : {}),
        postSlug: RECETTE_POST_SLUG,
        linkedAt: now,
      })
    }
    const grounds = await membershipGrounds(ctx, network._id, person._id, membership)
    const sponsorship = await activeSponsorshipOf(ctx, network._id, person._id)
    const status = await applyDerivedStatus(ctx, membership, grounds, sponsorship?.sponsorPersonId ?? null, now)
    if (status === "verifiee") await ctx.db.patch(membership._id, { statusChangedAt: now - (args.verifiedDaysAgo ?? 31) * DAY_MS })
    return { status }
  },
})
