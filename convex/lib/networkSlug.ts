/** Reprise du nom de la racine sans changer aucun networkId ni aucune adhésion. */
import { LEGACY_ROOT_NETWORK_SLUG, ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"

import type { QueryCtx } from "../_generated/server"

export async function findNetworkBySlug(ctx: Pick<QueryCtx, "db">, slug: string) {
  const exact = await ctx.db.query("networks").withIndex("by_slug", (q) => q.eq("slug", slug)).unique()
  if (exact) return (slug === ROOT_NETWORK_SLUG || slug === LEGACY_ROOT_NETWORK_SLUG) && exact.kind !== "root" ? null : exact
  const alternate = slug === ROOT_NETWORK_SLUG ? LEGACY_ROOT_NETWORK_SLUG : slug === LEGACY_ROOT_NETWORK_SLUG ? ROOT_NETWORK_SLUG : null
  if (alternate === null) return null
  const previous = await ctx.db.query("networks").withIndex("by_slug", (q) => q.eq("slug", alternate)).unique()
  return previous?.kind === "root" ? previous : null
}
