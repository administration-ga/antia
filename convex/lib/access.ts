/**
 * Résolution d'accès du moteur (cahier §12.1) :
 *
 *   session → personne → adhésion au réseau demandé → statut
 *   (puis, dans chaque écriture : limitation de débit → droit sur la ressource)
 *
 * L'identité ne se prend JAMAIS dans les arguments : elle vient du jeton
 * (`ctx.auth`). Tout refus d'accès à un réseau dont on n'est pas membre est
 * INDISTINCT (`notFound`) ; une suspension à la racine vaut partout.
 */
import { type ActiveMembershipStatus, effectiveAccessStatus, satisfiesMinimum } from "@antia/social-domain/membership"

import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { fail, notFound } from "./errors"

/** La personne liée à la session, ou `null` (pas de session, ou personne pas encore créée). */
export async function getCurrentPerson(ctx: QueryCtx): Promise<Doc<"persons"> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query("persons")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique()
}

/** La personne liée à la session ; `unauthenticated` sinon. */
export async function requirePerson(ctx: QueryCtx): Promise<Doc<"persons">> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return fail("unauthenticated")
  const person = await ctx.db
    .query("persons")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique()
  if (!person) return fail("unauthenticated")
  return person
}

/** Le réseau racine actif (il y en a un, et un seul). */
export async function getRootNetwork(ctx: QueryCtx): Promise<Doc<"networks"> | null> {
  return await ctx.db
    .query("networks")
    .withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active"))
    .unique()
}

export async function getMembership(
  ctx: QueryCtx,
  networkId: Id<"networks">,
  personId: Id<"persons">,
): Promise<Doc<"networkMemberships"> | null> {
  return await ctx.db
    .query("networkMemberships")
    .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", personId))
    .unique()
}

export type NetworkAccess = {
  person: Doc<"persons">
  network: Doc<"networks">
  membership: Doc<"networkMemberships">
  rootNetwork: Doc<"networks">
}

/**
 * LA garde du moteur : la personne de la session est-elle membre du réseau,
 * au statut minimal demandé ? Rend la personne, le réseau et l'adhésion.
 * - pas de session : `unauthenticated` ;
 * - réseau absent ou archivé, personne non membre ou partie : `notFound` (indistinct) ;
 * - suspendue (ici ou à la racine) : `membershipSuspended` ;
 * - membre au statut insuffisant (ex. `en_attente` qui veut publier) : `statusInsufficient`.
 */
export async function requireMembership(
  ctx: QueryCtx,
  networkId: Id<"networks">,
  minStatus: ActiveMembershipStatus,
): Promise<NetworkAccess> {
  const person = await requirePerson(ctx)
  const network = await ctx.db.get(networkId)
  if (!network || network.status !== "active") return notFound()
  const rootNetwork = network.kind === "root" ? network : await getRootNetwork(ctx)
  if (!rootNetwork) return notFound()
  const membership = await getMembership(ctx, network._id, person._id)
  const rootMembership = network.kind === "root" ? membership : await getMembership(ctx, rootNetwork._id, person._id)
  const status = effectiveAccessStatus({
    networkStatus: membership?.status ?? null,
    rootStatus: rootMembership?.status ?? null,
    isRoot: network.kind === "root",
  })
  if (!membership || status === null || status === "partie") return notFound()
  if (status === "suspendue") return fail("membershipSuspended")
  if (!satisfiesMinimum(status, minStatus)) return fail("statusInsufficient")
  return { person, network, membership, rootNetwork }
}
