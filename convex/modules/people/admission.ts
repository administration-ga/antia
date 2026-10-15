/**
 * Admission dans un réseau — le cœur de l'entrée, partagé par le chemin
 * générique (`memberships.joinNetwork`) et par les TRANCHES qui gouvernent un
 * réseau (`networks.managedBy`, ex. `convex/modules/diaspora`).
 *
 * Aucune fonction Convex ici : l'appelant a déjà établi l'adhésion requise, le
 * profil, les consentements, l'éligibilité et le débit (ordre du moteur :
 * adhésion → éligibilité → débit → droit). Ces aides posent l'état en tenant
 * les invariants : adhésion DÉRIVÉE vers la racine, suspension racine =
 * partout, facette validée contre le schéma BORNÉ du réseau.
 */
import { validateFacetValues } from "@antia/social-domain/facets"
import {
  type ActiveMembershipStatus,
  derivedRootMembership,
  type EntryEvidence,
  type MembershipStatus,
  nextMembershipStatus,
  type VerificationSource,
} from "@antia/social-domain/membership"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { getMembership } from "../../lib/access"
import { fail } from "../../lib/errors"

export type FacetInput = {
  values: Doc<"personFacets">["values"]
  visibilities: Doc<"personFacets">["visibilities"]
}

/** Change le statut d'une adhésion en datant le changement. */
export async function setMembershipStatus(
  ctx: MutationCtx,
  membership: Doc<"networkMemberships">,
  status: MembershipStatus,
  extra: Partial<Doc<"networkMemberships">> = {},
): Promise<void> {
  await ctx.db.patch(membership._id, { status, statusChangedAt: Date.now(), ...extra })
}

/**
 * Écrit la facette d'une personne dans un réseau, validée contre le schéma du
 * réseau : le champ fautif est nommé, jamais la valeur. Sans schéma, aucune
 * valeur n'est admise ; une visibilité ne vise qu'un champ déclaré.
 */
export async function writeNetworkFacet(
  ctx: MutationCtx,
  network: Doc<"networks">,
  personId: Id<"persons">,
  facet: FacetInput | undefined,
): Promise<void> {
  if (!network.facetSchema) {
    if (facet && Object.keys(facet.values).length > 0) fail("invalidArgument", { field: "facet" })
    return
  }
  const values = facet?.values ?? {}
  const visibilities = facet?.visibilities ?? {}
  const errors = validateFacetValues(network.facetSchema, values)
  if (errors.length > 0) fail("invalidArgument", { field: `facet.${errors[0]?.key ?? ""}` })
  const known = new Set(network.facetSchema.fields.map((field) => field.key))
  if (Object.keys(visibilities).some((key) => !known.has(key))) fail("invalidArgument", { field: "visibilities" })
  const existing = await ctx.db
    .query("personFacets")
    .withIndex("by_network_and_person", (q) => q.eq("networkId", network._id).eq("personId", personId))
    .unique()
  const row = { values, visibilities, updatedAt: Date.now() }
  if (existing) await ctx.db.patch(existing._id, row)
  else await ctx.db.insert("personFacets", { networkId: network._id, personId, ...row })
}

/**
 * Admet une personne dans un réseau au statut d'entrée décidé par l'appelant
 * (la politique générique, ou les règles propres d'une tranche) :
 * 1. la racine d'abord — l'adhésion dérivée est créée ou réactivée ; une
 *    personne suspendue à la racine n'entre nulle part (`membershipSuspended`) ;
 * 2. puis le réseau — adhésion créée, ou réactivée après un départ ; une
 *    adhésion déjà active garde son statut (la montée de statut a ses chemins).
 *
 * `verifiedBy` nomme la source d'un statut « vérifiée » (défaut : IDN) ;
 * `sponsorPersonId`, le parrain d'une entrée parrainée.
 */
export async function admitToNetwork(
  ctx: MutationCtx,
  args: {
    personId: Id<"persons">
    network: Doc<"networks">
    root: Doc<"networks">
    entry: ActiveMembershipStatus
    evidence: EntryEvidence
    verifiedBy?: VerificationSource
    sponsorPersonId?: Id<"persons">
  },
): Promise<{ status: MembershipStatus; rootStatus: MembershipStatus }> {
  const { personId, network, root, entry, evidence } = args
  const source = args.verifiedBy ?? "idn"
  // La racine suit la politique `open` : « vérifiée » par l'IDN forte si la
  // personne en a une, sinon par la vérification externe de l'entrée.
  const rootVerification = (status: MembershipStatus) =>
    status === "verifiee" ? { verifiedBy: evidence.strongIdentity ? ("idn" as const) : source } : {}
  const now = Date.now()

  const rootMembership = await getMembership(ctx, root._id, personId)
  let rootStatus: MembershipStatus | null = rootMembership?.status ?? null
  if (network.kind !== "root") {
    const action = derivedRootMembership({ childKind: network.kind, existingRootStatus: rootStatus, evidence })
    if (action.kind === "refuse") return fail("membershipSuspended")
    if (action.kind === "create") {
      await ctx.db.insert("networkMemberships", {
        networkId: root._id,
        personId,
        status: action.status,
        role: "member",
        derivedFrom: network._id,
        ...rootVerification(action.status),
        joinedAt: now,
        statusChangedAt: now,
      })
      rootStatus = action.status
    } else if (action.kind === "reactivate" && rootMembership) {
      await setMembershipStatus(ctx, rootMembership, action.status, { derivedFrom: network._id, leftAt: undefined, ...rootVerification(action.status) })
      rootStatus = action.status
    }
  }

  const existing = network.kind === "root" ? rootMembership : await getMembership(ctx, network._id, personId)
  let status: MembershipStatus
  if (!existing) {
    await ctx.db.insert("networkMemberships", {
      networkId: network._id,
      personId,
      status: entry,
      role: "member",
      ...(entry === "verifiee" ? { verifiedBy: source } : {}),
      ...(args.sponsorPersonId ? { sponsorPersonId: args.sponsorPersonId } : {}),
      joinedAt: now,
      statusChangedAt: now,
    })
    status = entry
  } else if (existing.status === "suspendue") {
    return fail("membershipSuspended")
  } else if (existing.status === "partie") {
    const next = nextMembershipStatus("partie", { kind: "rejoin", entryStatus: entry })
    if (!next) return fail("conflict")
    await setMembershipStatus(ctx, existing, next, {
      leftAt: undefined,
      ...(next === "verifiee" ? { verifiedBy: source } : {}),
      ...(args.sponsorPersonId ? { sponsorPersonId: args.sponsorPersonId } : {}),
    })
    status = next
  } else {
    status = existing.status
  }
  if (network.kind === "root") rootStatus = status
  return { status, rootStatus: rootStatus ?? status }
}
