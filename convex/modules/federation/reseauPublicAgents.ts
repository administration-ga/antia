/** PA9C : attestation signée sur un accord local déjà corrélé, sans provisioning. */
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import type { ReseauPublicPersonEvent } from "@antsia/social-domain/reseauPublic"
import type { Doc } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { currentVerifiedIdnSubjectOf } from "../people/identity"
import { syncPersonDirectory } from "../people/directory"
import { agentRootEligible, agentSourcePage, administrativeSubjectDigest } from "./agentAuthority"
import { revokeAgentGrant } from "./agentLifecycle"
import type { FederationApplyResult } from "./reseauPublic"
import { federationBodyDigest } from "./signature"

export async function applyAdministrativeAgent(ctx: MutationCtx, emitter: Doc<"federationEmitters">, network: Doc<"networks">, event: ReseauPublicPersonEvent, now: number): Promise<FederationApplyResult> {
  if (event.agentRef !== `agent:${await federationBodyDigest(event.consentRef)}`) return { applied: false, reason: "invalid_payload" }
  const grant = await ctx.db.query("federationAgentGrants").withIndex("by_agent_ref", q => q.eq("agentRef", event.agentRef)).unique()
  // Ni sujet inconnu conservé ni création d'une personne/adhésion/consentement.
  if (!grant) return event.type === "person.optout" ? { applied: true } : { applied: false, reason: "consent_required" }
  if (grant.emitterId !== emitter._id || grant.environment !== emitter.environment || grant.networkId !== network._id || grant.consentRef !== event.consentRef) return { applied: false, reason: "consent_required" }
  if (grant.subjectDigest !== await administrativeSubjectDigest(emitter, event.idnSub)) return { applied: false, reason: "identity_not_linked" }
  const sourceDigest = await federationBodyDigest(JSON.stringify(event))
  if (grant.sourceRevision !== undefined) {
    if (event.revision < grant.sourceRevision) return { applied: true }
    if (event.revision === grant.sourceRevision) return grant.sourceDigest === sourceDigest ? { applied: true } : { applied: false, reason: "source_conflict" }
  }
  if (event.type === "person.optout") {
    await revokeAgentGrant(ctx, grant)
    await ctx.db.patch(grant._id, { sourceRevision: event.revision, sourceDigest, updatedAt: now })
    return { applied: true }
  }
  if (grant.revokedAt !== undefined || grant.status === "revoked") return { applied: false, reason: "consent_required" }
  const person = await ctx.db.get(grant.personId)
  const consent = await ctx.db.get(grant.consentId)
  if (!consent || consent.personId !== grant.personId || consent.networkId !== network._id || consent.purpose !== "administration_reflection" || consent.revokedAt !== undefined || consent.textVersion !== CONSENT_TEXT_VERSIONS.administration_reflection || consent.grantedAt !== grant.grantedAt || event.consentedAt !== grant.grantedAt) return { applied: false, reason: "consent_required" }
  if (!person || !await agentRootEligible(ctx, person, network) || await currentVerifiedIdnSubjectOf(ctx, person) !== event.idnSub) return { applied: false, reason: "identity_not_linked" }
  if (!await agentSourcePage(ctx, emitter, event.orgRef)) return { applied: false, reason: "source_conflict" }
  const link = await ctx.db.query("identityLinks").withIndex("by_person_and_provider", q => q.eq("personId", person._id).eq("provider", "administration")).unique()
  const other = await ctx.db.query("identityLinks").withIndex("by_provider_and_subject", q => q.eq("provider", "administration").eq("subject", grant.subjectDigest)).unique()
  if ((other && other.personId !== person._id) || (link && link.revokedAt === undefined && link._id !== grant.identityLinkId)) return { applied: false, reason: "source_conflict" }
  const member = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", q => q.eq("networkId", network._id).eq("personId", person._id)).unique()
  if (member && (member.status === "suspendue" || (member.status !== "partie" && (member._id !== grant.membershipId || member.verifiedBy !== "federation")))) return { applied: false, reason: "source_conflict" }
  // Aucun nom de profil ni rôle de modération n'est alimenté par la source.
  const linkValues = { personId: person._id, provider: "administration" as const, subject: grant.subjectDigest, orgRef: event.orgRef, linkedAt: now }
  let identityLinkId = link?._id
  if (link) await ctx.db.replace(link._id, linkValues)
  else identityLinkId = await ctx.db.insert("identityLinks", linkValues)
  let membershipId = member?._id
  if (member) await ctx.db.patch(member._id, { status: "verifiee", verifiedBy: "federation", statusChangedAt: now, leftAt: undefined })
  else membershipId = await ctx.db.insert("networkMemberships", { personId: person._id, networkId: network._id, status: "verifiee", role: "member", verifiedBy: "federation", directoryListed: false, joinedAt: now, statusChangedAt: now })
  await ctx.db.patch(grant._id, { status: "active", identityLinkId, membershipId, orgRef: event.orgRef, roleLabel: event.roleLabel, sourceRevision: event.revision, sourceDigest, sourceConsentedAt: event.consentedAt, updatedAt: now })
  await syncPersonDirectory(ctx, person._id)
  return { applied: true }
}
