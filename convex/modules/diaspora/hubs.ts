/**
 * Hubs pays (EXF-DG-15, EXF-DG-17, EXT-DG-02).
 *
 * Les compteurs sont MATÉRIALISÉS par un passage nocturne paginé (cron
 * quotidien) : une lecture ne compte jamais rien. Le passage compte d'abord les
 * membres listés de chaque pays, puis les pages ACTIVES et lisibles du réseau,
 * par pays et par nature (associations, entreprises — DG-007), chacune relue par
 * LA garde des pages. Le nombre de membres d'un pays sous le seuil de publication
 * ne quitte pas le serveur (anti-réidentification) : la projection rend la
 * PRÉSENTATION du compteur (`presentHubCounters`), jamais le chiffre brut ; ce
 * seuil ne concerne que les membres. L'ouverture d'un pays se lit dans
 * `networks.openCountries` ; les pages elles-mêmes se lisent par `hubPages.ts`.
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
import { internalMutation, type MutationCtx, query, type QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { networkQuery } from "../../lib/functions"
import { readablePageOrNull } from "../pages/access"
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

/**
 * @publicProjection La vitrine publique (page d'accueil, sans compte) annonce les
 * pays OUVERTS du réseau, dans l'ordre de la console, et la présentation de leurs
 * compteurs matérialisés — sous le seuil, aucun chiffre de membres. Aucun membre,
 * aucun contenu, aucun pays fermé ; un réseau non gouverné par la tranche rend une liste vide.
 */
export const listOpenCountries = query({
  args: { networkId: v.id("networks") },
  returns: v.array(countryHubViewValidator),
  handler: async (ctx, { networkId }) => {
    const network = await ctx.db.get(networkId)
    if (!isDiasporaNetwork(network)) return []
    const views = []
    for (const country of (network.openCountries ?? []).slice(0, COUNTRIES_MAX)) {
      if (!isResidenceCountry(country)) continue
      views.push(hubView(network, country, await hubRow(ctx, network._id, country)))
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

/** Ce que le passage accumule, par pays (ISO alpha-2). */
type CountryTally = Record<string, number>

interface HubPassCounts {
  readonly members: CountryTally
  readonly associations: CountryTally
  readonly companies: CountryTally
}

/** Une page de passage, jamais plus large que `HUB_COUNTERS_PAGE_SIZE`. */
function passPageSize(pageSize: number): number {
  return Math.min(Math.max(1, Math.trunc(pageSize)), HUB_COUNTERS_PAGE_SIZE)
}

/** Fin du passage : chaque hub connu, ouvert ou compté reçoit ses compteurs (zéro s'il n'a plus rien). */
async function writeHubCounters(ctx: MutationCtx, network: Doc<"networks">, counts: HubPassCounts, computedAt: number) {
  const existing = await ctx.db
    .query("countryHubs")
    .withIndex("by_network_and_country", (q) => q.eq("networkId", network._id))
    .take(COUNTRIES_MAX)
  const byCountry = new Map(existing.map((row) => [row.country, row]))
  const countries = new Set([
    ...byCountry.keys(),
    ...(network.openCountries ?? []),
    ...Object.keys(counts.members),
    ...Object.keys(counts.associations),
    ...Object.keys(counts.companies),
  ])
  const now = Date.now()
  for (const country of countries) {
    if (!isResidenceCountry(country)) continue
    // Les évènements à venir : leur source arrive avec les évènements (PD7) ; d'ici là, zéro mesuré.
    const counters = {
      members: counts.members[country] ?? 0,
      associations: counts.associations[country] ?? 0,
      companies: counts.companies[country] ?? 0,
      upcomingEvents: 0,
      countersComputedAt: computedAt,
      updatedAt: now,
    }
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
      .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
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
    // Les membres comptés, le passage continue par les pages du réseau (DG-007).
    await ctx.scheduler.runAfter(0, internal.modules.diaspora.hubs.refreshHubPageCountersPage, {
      networkId: network._id,
      cursor: null,
      members,
      associations: {},
      companies: {},
      startedAt: args.startedAt,
      pageSize: args.pageSize,
    })
    return null
  },
})

/**
 * Une page du passage sur les PAGES : les pages actives du réseau, par pays et
 * par nature (associations, entreprises), chacune relue par LA garde des pages
 * sans lecteur — une page retirée, ou retenue par la modération, ne compte pas.
 * Une page sans pays, d'une autre nature ou d'un pays hors diaspora n'entre dans
 * aucun hub. À la dernière page, les compteurs du passage sont écrits ensemble.
 */
export const refreshHubPageCountersPage = internalMutation({
  args: {
    networkId: v.id("networks"),
    cursor: v.union(v.string(), v.null()),
    members: v.record(v.string(), v.number()),
    associations: v.record(v.string(), v.number()),
    companies: v.record(v.string(), v.number()),
    startedAt: v.number(),
    pageSize: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const network = await ctx.db.get(args.networkId)
    if (!isDiasporaNetwork(network)) return null
    const page = await ctx.db
      .query("pages")
      .withIndex("by_network_status_trustRank_createdAt", (q) => q.eq("networkId", network._id).eq("status", "active"))
      .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
    const associations = { ...args.associations }
    const companies = { ...args.companies }
    for (const row of page.page) {
      const tally = row.ownerKind === "association" ? associations : row.ownerKind === "company" ? companies : null
      const country = row.country
      if (tally === null || country === undefined || !isResidenceCountry(country)) continue
      if (!(await readablePageOrNull(ctx, network, row._id))) continue
      tally[country] = (tally[country] ?? 0) + 1
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.diaspora.hubs.refreshHubPageCountersPage, {
        ...args,
        cursor: page.continueCursor,
        associations,
        companies,
      })
      return null
    }
    await writeHubCounters(ctx, network, { members: args.members, associations, companies }, args.startedAt)
    return null
  },
})
