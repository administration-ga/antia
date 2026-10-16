/**
 * Réseaux — lecture publique et gestion par la console du moteur (cahier
 * EXF-AN-01). Un réseau se crée, se règle et s'archive SANS déploiement ;
 * jamais il ne se supprime. Chaque geste de console laisse sa trace dans
 * `networkSettingsHistory` (les réglages figés) et dans le journal des
 * décisions du moteur (`engineAudit` : qui, à quel titre, pourquoi).
 */
import { assertDecisionReason } from "@antsia/social-domain/audit"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { validateFacetSchema } from "@antsia/social-domain/facets"
import { isValidNetworkSlug, validateNetworkShape, LEGACY_ROOT_NETWORK_SLUG, ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import { type MutationCtx, query } from "../../_generated/server"
import { checked, fail } from "../../lib/errors"
import { operatorMutation, operatorQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { findNetworkBySlug } from "../../lib/networkSlug"
import {
  contentVisibilityValidator,
  facetSchemaValidator,
  membershipPolicyValidator,
  networkKindValidator,
  networkSliceValidator,
  networkStatusValidator,
} from "../../lib/validators"
import { appendAudit, operatorCapacity } from "../platform/audit"

/** Projection PUBLIQUE d'un réseau : ce qu'une application doit savoir pour le servir. */
const publicNetworkValidator = v.object({
  _id: v.id("networks"),
  slug: v.string(),
  name: v.string(),
  kind: networkKindValidator,
  parentId: v.optional(v.id("networks")),
  /** Présent : l'entrée et les facettes passent par la tranche nommée, jamais par les chemins génériques. */
  managedBy: v.optional(networkSliceValidator),
  membershipPolicy: membershipPolicyValidator,
  defaultVisibility: contentVisibilityValidator,
  facetSchema: v.optional(facetSchemaValidator),
  reachValues: v.array(v.string()),
  openCountries: v.optional(v.array(v.string())),
  theme: v.string(),
})

function toPublicNetwork(network: Doc<"networks">) {
  const legacyRoot = network.kind === "root" && network.slug === LEGACY_ROOT_NETWORK_SLUG
  return {
    _id: network._id,
    slug: legacyRoot ? ROOT_NETWORK_SLUG : network.slug,
    name: legacyRoot ? BRAND_NAME : network.name,
    kind: network.kind,
    ...(network.parentId ? { parentId: network.parentId } : {}),
    ...(network.managedBy ? { managedBy: network.managedBy } : {}),
    membershipPolicy: network.membershipPolicy,
    defaultVisibility: network.defaultVisibility,
    ...(network.facetSchema ? { facetSchema: network.facetSchema } : {}),
    reachValues: network.reachValues,
    ...(network.openCountries ? { openCountries: network.openCountries } : {}),
    theme: network.theme === LEGACY_ROOT_NETWORK_SLUG ? ROOT_NETWORK_SLUG : network.theme,
  }
}

/**
 * @publicProjection Une application résout son réseau courant par son
 * identifiant public avant toute session (NetworkProvider) ; seule la
 * projection publique des réglages est servie, jamais un membre ni un contenu.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(publicNetworkValidator, v.null()),
  handler: async (ctx, { slug }) => {
    const network = await findNetworkBySlug(ctx, slug)
    if (!network || network.status !== "active") return null
    return toPublicNetwork(network)
  },
})

async function recordHistory(
  ctx: MutationCtx,
  network: Doc<"networks">,
  kind: "created" | "updated" | "archived",
  actorPersonId: Id<"persons">,
  reason?: string,
) {
  await ctx.db.insert("networkSettingsHistory", {
    networkId: network._id,
    actorPersonId,
    kind,
    settings: {
      name: network.name,
      membershipPolicy: network.membershipPolicy,
      defaultVisibility: network.defaultVisibility,
      ...(network.facetSchema ? { facetSchema: network.facetSchema } : {}),
      reachValues: network.reachValues,
      ...(network.openCountries ? { openCountries: network.openCountries } : {}),
      theme: network.theme,
      status: network.status,
    },
    ...(reason ? { reason } : {}),
    at: Date.now(),
  })
}

const settingsArgs = {
  name: v.string(),
  membershipPolicy: membershipPolicyValidator,
  defaultVisibility: contentVisibilityValidator,
  facetSchema: v.optional(facetSchemaValidator),
  reachValues: v.array(v.string()),
  openCountries: v.optional(v.array(v.string())),
  theme: v.string(),
}

function assertSettings(args: { name: string; facetSchema?: Doc<"networks">["facetSchema"]; openCountries?: string[] }) {
  if (args.name.trim().length < 2 || args.name.length > 60) fail("invalidArgument", { field: "name" })
  if (args.facetSchema && validateFacetSchema(args.facetSchema).length > 0) fail("invalidArgument", { field: "facetSchema" })
  if (args.openCountries?.some((country) => !/^[A-Z]{2}$/.test(country))) fail("invalidArgument", { field: "openCountries" })
}

/**
 * Console : créer un réseau (la racine unique, ou un réseau fermé enfant de la
 * racine). `managedBy` se pose ici, à la naissance, et nulle part ailleurs.
 */
export const create = operatorMutation({
  args: { slug: v.string(), kind: networkKindValidator, managedBy: v.optional(networkSliceValidator), ...settingsArgs },
  returns: v.id("networks"),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "operator.network", ctx.person._id)
    if (!isValidNetworkSlug(args.slug)) fail("invalidArgument", { field: "slug" })
    assertSettings(args)
    const existing = await ctx.db
      .query("networks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (existing) fail("conflict")
    const root = await ctx.db
      .query("networks")
      .withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active"))
      .unique()
    if (args.kind === "root" && root) fail("conflict")
    const parentId = args.kind === "root" ? null : (root?._id ?? null)
    if (args.kind === "closed" && !parentId) fail("invalidArgument", { field: "kind" })
    // La racine est ouverte à toute personne : aucune tranche ne la gouverne.
    if (args.kind === "root" && args.managedBy) fail("invalidArgument", { field: "managedBy" })
    const shapeErrors = validateNetworkShape({
      kind: args.kind,
      parentId,
      membershipPolicy: args.membershipPolicy,
      defaultVisibility: args.defaultVisibility,
    })
    if (shapeErrors.length > 0) fail("invalidArgument", { field: shapeErrors[0] })
    const now = Date.now()
    const networkId = await ctx.db.insert("networks", {
      slug: args.slug,
      kind: args.kind,
      ...(parentId ? { parentId } : {}),
      ...(args.managedBy ? { managedBy: args.managedBy } : {}),
      name: args.name.trim(),
      membershipPolicy: args.membershipPolicy,
      defaultVisibility: args.defaultVisibility,
      ...(args.facetSchema ? { facetSchema: args.facetSchema } : {}),
      reachValues: args.reachValues,
      ...(args.openCountries ? { openCountries: args.openCountries } : {}),
      theme: args.theme,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    const created = await ctx.db.get(networkId)
    if (created) await recordHistory(ctx, created, "created", ctx.person._id)
    await appendAudit(ctx, {
      action: "network.create",
      capacity: operatorCapacity(ctx.operator),
      actorPersonId: ctx.person._id,
      networkId,
      subject: { table: "networks", id: networkId },
      details: { slug: args.slug, kind: args.kind, ...(args.managedBy ? { managedBy: args.managedBy } : {}) },
    })
    return networkId
  },
})

/** Console : régler un réseau (politique, visibilité par défaut, facettes, portées, pays, thème). */
export const update = operatorMutation({
  args: { networkId: v.id("networks"), ...settingsArgs, reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { networkId, reason, ...settings }) => {
    await enforceRateLimit(ctx, "operator.network", ctx.person._id)
    const network = await ctx.db.get(networkId)
    if (!network || network.status !== "active") fail("notFound")
    assertSettings(settings)
    const shapeErrors = validateNetworkShape({
      kind: network.kind,
      parentId: network.parentId ?? null,
      membershipPolicy: settings.membershipPolicy,
      defaultVisibility: settings.defaultVisibility,
    })
    if (shapeErrors.length > 0) fail("invalidArgument", { field: shapeErrors[0] })
    // Motif facultatif pour un réglage ; donné, il est borné comme tout motif.
    const motive = reason === undefined || reason.trim() === "" ? undefined : checked(() => assertDecisionReason(reason, 1))
    await ctx.db.patch(networkId, { ...settings, name: settings.name.trim(), updatedAt: Date.now() })
    const updated = await ctx.db.get(networkId)
    if (updated) await recordHistory(ctx, updated, "updated", ctx.person._id, motive)
    await appendAudit(ctx, {
      action: "network.update",
      capacity: operatorCapacity(ctx.operator),
      actorPersonId: ctx.person._id,
      networkId,
      subject: { table: "networks", id: networkId },
      ...(motive ? { details: { reason: motive } } : {}),
    })
    return null
  },
})

/** Console : archiver un réseau fermé (jamais la racine, jamais une suppression). */
export const archive = operatorMutation({
  args: { networkId: v.id("networks"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { networkId, reason }) => {
    await enforceRateLimit(ctx, "operator.network", ctx.person._id)
    const network = await ctx.db.get(networkId)
    if (!network || network.status !== "active") fail("notFound")
    if (network.kind === "root") fail("invalidArgument", { field: "kind" })
    const motive = checked(() => assertDecisionReason(reason, 10))
    const now = Date.now()
    await ctx.db.patch(networkId, { status: "archived", archivedAt: now, updatedAt: now })
    const archived = await ctx.db.get(networkId)
    if (archived) await recordHistory(ctx, archived, "archived", ctx.person._id, motive)
    await appendAudit(ctx, {
      action: "network.archive",
      capacity: operatorCapacity(ctx.operator),
      actorPersonId: ctx.person._id,
      networkId,
      subject: { table: "networks", id: networkId },
      details: { reason: motive },
      at: now,
    })
    return null
  },
})

/** Console : liste des réseaux (actifs puis archivés), bornée. */
export const listForConsole = operatorQuery({
  args: {},
  returns: v.array(v.object({ ...publicNetworkValidator.fields, status: networkStatusValidator })),
  handler: async (ctx) => {
    const active = await ctx.db
      .query("networks")
      .withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active"))
      .take(1)
    const closedActive = await ctx.db
      .query("networks")
      .withIndex("by_kind_and_status", (q) => q.eq("kind", "closed").eq("status", "active"))
      .take(200)
    const archived = await ctx.db
      .query("networks")
      .withIndex("by_kind_and_status", (q) => q.eq("kind", "closed").eq("status", "archived"))
      .take(200)
    return [...active, ...closedActive, ...archived].map((network) => ({ ...toPublicNetwork(network), status: network.status }))
  },
})
