/**
 * Hubs pays (EXF-DG-15, EXF-DG-17, EXT-DG-02).
 *
 * Les compteurs sont MATÉRIALISÉS par un passage nocturne paginé (cron
 * quotidien) : une lecture ne compte jamais rien. Le nombre de membres d'un pays
 * sous le seuil de publication ne quitte pas le serveur (anti-réidentification) :
 * la projection rend la PRÉSENTATION du compteur (`presentHubCounters`), jamais
 * le chiffre brut. L'ouverture d'un pays se lit dans `networks.openCountries`.
 */
import {
  countsAsHubMember,
  DEFAULT_DIRECTORY_VISIBILITY,
  DIASPORALE_NETWORK_SLUG,
  type HubCounters,
  isResidenceCountry,
  parseResidenceCountry,
  presentHubCounters,
} from "@diasporale/domain"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { networkQuery } from "../../lib/functions"
import { assertDiasporaNetwork, consentInForce, effectiveStatusIn, isDiasporaNetwork, privacyOf } from "./facts"
import { countryHubViewValidator } from "./validators"

/** Une page du passage nocturne : quelques lectures par membre, loin des limites d'une transaction. */
export const HUB_COUNTERS_PAGE_SIZE = 200

/** Borne des pays d'un réseau (ISO 3166-1 : 249 codes). */
const COUNTRIES_MAX = 250

const EMPTY_COUNTERS: HubCounters = { members: 0, associations: 0, companies: 0, upcomingEvents: 0 }

export async function hubRow(ctx: QueryCtx, networkId: Id<"networks">, country: string): Promise<Doc<"countryHubs"> | null> {
  return await ctx.db
    .query("countryHubs")
    .withIndex("by_network_and_country", (q) => q.eq("networkId", networkId).eq("country", country))
    .unique()
}

function hubView(network: Doc<"networks">, country: string, row: Doc<"countryHubs"> | null) {
  return {
    country,
    open: (network.openCountries ?? []).includes(country),
    counters: presentHubCounters(row ?? EMPTY_COUNTERS),
    countersComputedAt: row?.countersComputedAt ?? null,
  }
}

/** Le hub d'un pays : son ouverture et ses compteurs matérialisés (rien n'est compté ici). */
export const getCountryHub = networkQuery({
  args: { country: v.string() },
  returns: countryHubViewValidator,
  handler: async (ctx, { country }) => {
    assertDiasporaNetwork(ctx.network)
    const parsed = parseResidenceCountry(country)
    if (!parsed.ok) return notFound()
    return hubView(ctx.network, parsed.value, await hubRow(ctx, ctx.networkId, parsed.value))
  },
})

/** Les pays ouverts du réseau, dans l'ordre de la console, avec leurs compteurs matérialisés. */
export const listOpenCountries = networkQuery({
  args: {},
  returns: v.array(countryHubViewValidator),
  handler: async (ctx) => {
    assertDiasporaNetwork(ctx.network)
    const views = []
    for (const country of (ctx.network.openCountries ?? []).slice(0, COUNTRIES_MAX)) {
      if (!isResidenceCountry(country)) continue
      views.push(hubView(ctx.network, country, await hubRow(ctx, ctx.networkId, country)))
    }
    return views
  },
})

/** Une personne compte-t-elle parmi les membres du hub de son pays ? Accords relus au comptage. */
async function countsInHub(ctx: QueryCtx, network: Doc<"networks">, personId: Id<"persons">): Promise<boolean> {
  const { status } = await effectiveStatusIn(ctx, network, personId)
  if (status === null) return false
  return countsAsHubMember({
    status,
    directoryVisibility: (await privacyOf(ctx, network._id, personId))?.directoryVisibility ?? DEFAULT_DIRECTORY_VISIBILITY,
    directoryConsent: await consentInForce(ctx, network._id, personId, "directory"),
  })
}

/** Fin du passage : chaque hub connu, ouvert ou compté reçoit ses compteurs (zéro s'il n'a plus personne). */
async function writeHubCounters(ctx: MutationCtx, network: Doc<"networks">, members: Record<string, number>, computedAt: number) {
  const existing = await ctx.db
    .query("countryHubs")
    .withIndex("by_network_and_country", (q) => q.eq("networkId", network._id))
    .take(COUNTRIES_MAX)
  const byCountry = new Map(existing.map((row) => [row.country, row]))
  const countries = new Set([...byCountry.keys(), ...(network.openCountries ?? []), ...Object.keys(members)])
  const now = Date.now()
  for (const country of countries) {
    if (!isResidenceCountry(country)) continue
    // Associations, entreprises et évènements : leurs sources arrivent avec les pages (PD5) et les évènements (PD7).
    const counters = { members: members[country] ?? 0, associations: 0, companies: 0, upcomingEvents: 0, countersComputedAt: computedAt, updatedAt: now }
    const row = byCountry.get(country)
    if (row) await ctx.db.patch(row._id, counters)
    else await ctx.db.insert("countryHubs", { networkId: network._id, country, ...counters })
  }
}

/** Passage nocturne (cron quotidien) : lance le comptage paginé des membres listés de chaque pays. */
export const refreshHubCounters = internalMutation({
  args: { pageSize: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { pageSize }): Promise<null> => {
    const network = await ctx.db
      .query("networks")
      .withIndex("by_slug", (q) => q.eq("slug", DIASPORALE_NETWORK_SLUG))
      .unique()
    if (!isDiasporaNetwork(network)) return null
    await ctx.scheduler.runAfter(0, internal.modules.diaspora.hubs.refreshHubCountersPage, {
      networkId: network._id,
      cursor: null,
      members: {},
      startedAt: Date.now(),
      pageSize: pageSize ?? HUB_COUNTERS_PAGE_SIZE,
    })
    return null
  },
})

/** Une page du passage : accumule les membres listés par pays, puis passe la main ou écrit les compteurs. */
export const refreshHubCountersPage = internalMutation({
  args: {
    networkId: v.id("networks"),
    cursor: v.union(v.string(), v.null()),
    members: v.record(v.string(), v.number()),
    startedAt: v.number(),
    pageSize: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const network = await ctx.db.get(args.networkId)
    if (!isDiasporaNetwork(network)) return null
    const page = await ctx.db
      .query("personFacets")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", network._id))
      .paginate({ cursor: args.cursor, numItems: Math.min(Math.max(1, Math.trunc(args.pageSize)), HUB_COUNTERS_PAGE_SIZE) })
    const members = { ...args.members }
    for (const facet of page.page) {
      const country = facet.values.countryOfResidence
      if (typeof country !== "string" || !isResidenceCountry(country)) continue
      if (await countsInHub(ctx, network, facet.personId)) members[country] = (members[country] ?? 0) + 1
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.diaspora.hubs.refreshHubCountersPage, { ...args, cursor: page.continueCursor, members })
      return null
    }
    await writeHubCounters(ctx, network, members, args.startedAt)
    return null
  },
})
