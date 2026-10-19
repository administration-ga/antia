/** PA9C : retirer seulement les effets appartenant à l'accord administratif. */
import { isActiveStatus } from "@antsia/social-domain/membership"
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { setMembershipStatus } from "../people/admission"

export async function revokeAgentGrant(ctx: MutationCtx, grant: Doc<"federationAgentGrants">): Promise<void> {
  const now = Date.now()
  const consent = await ctx.db.get(grant.consentId)
  if (consent?.personId === grant.personId && consent.purpose === "administration_reflection" && consent.networkId === grant.networkId && consent.revokedAt === undefined) await ctx.db.patch(consent._id, { revokedAt: now })
  await ctx.db.patch(grant._id, { status: "revoked", revokedAt: grant.revokedAt ?? now, orgRef: undefined, roleLabel: undefined, transferTokenHash: undefined, transferExpiresAt: undefined, transferUsedAt: undefined, updatedAt: now })
  const link = grant.identityLinkId ? await ctx.db.get(grant.identityLinkId) : null
  if (link?.personId === grant.personId && link.provider === "administration" && link.subject === grant.subjectDigest && link.revokedAt === undefined) await ctx.db.patch(link._id, { revokedAt: now, orgRef: undefined })
  const membership = grant.membershipId ? await ctx.db.get(grant.membershipId) : null
  // Une sanction ne devient jamais un départ : elle reste opposable à un retour.
  if (membership?.personId === grant.personId && membership.networkId === grant.networkId && membership.verifiedBy === "federation" && isActiveStatus(membership.status)) await setMembershipStatus(ctx, membership, "partie", { leftAt: now, directoryListed: false })
}

export async function revokeAdministrationForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<void> {
  // borné : le réseau administration est unique ; une anomalie de volume n'est pas tronquée.
  const grants = await ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", personId)).take(17)
  if (grants.length > 16) throw new Error("[federation] unexpected grant count")
  for (const grant of grants) await revokeAgentGrant(ctx, grant)
}
