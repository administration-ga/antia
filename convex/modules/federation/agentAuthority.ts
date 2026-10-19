/** PA9C : preuves vivantes en lecture seule, sans dépendance aux gardes d'adhésion. */
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { federationEnvironment, RESEAU_PUBLIC_CONTRACT } from "@antsia/social-domain/federationProtocol"
import { isActiveStatus } from "@antsia/social-domain/membership"
import { isSanctionLive, MODERATION_SCAN_LIMIT } from "@antsia/social-domain/moderationPolicy"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isFederatedContentAvailable } from "./mirrorAccess"
import { reseauPublicNetwork } from "./reseauPublicAccess"
import { federationBodyDigest } from "./signature"

type ReadCtx = Pick<QueryCtx, "db">
export type AgentAffiliation = { administrationName: string; administrationHandle: string; roleLabel: string }

/** Empreinte cloisonnée ; jamais un sujet IDN brut dans un lien administration. */
export async function administrativeSubjectDigest(emitter: Doc<"federationEmitters">, subject: string): Promise<string> {
  return await federationBodyDigest(JSON.stringify([RESEAU_PUBLIC_CONTRACT, "agent-subject", emitter._id, emitter.environment, subject]))
}

export async function agentRootEligible(ctx: ReadCtx, person: Doc<"persons">, network: Doc<"networks">): Promise<boolean> {
  if (person.erasedAt !== undefined || person.deletionRequestedAt !== undefined || !person.handle || !person.displayName || person.publishedAt === undefined || person.withdrawnAt !== undefined || !network.parentId) return false
  const rootId = network.parentId
  const root = await ctx.db.get(rootId)
  const membership = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", q => q.eq("networkId", rootId).eq("personId", person._id)).unique()
  if (!root || root.kind !== "root" || root.slug !== "antsia" || root.status !== "active" || !membership || (membership.status !== "declaree" && membership.status !== "verifiee")) return false
  const sanctions = await ctx.db.query("sanctions").withIndex("by_person_status", q => q.eq("personId", person._id).eq("status", "active")).take(MODERATION_SCAN_LIMIT + 1)
  if (sanctions.length > MODERATION_SCAN_LIMIT || sanctions.some(row => (row.kind === "suspension" || row.kind === "exclusion") && isSanctionLive(row, Date.now()))) return false
  const child = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", q => q.eq("networkId", network._id).eq("personId", person._id)).unique()
  return child?.status !== "suspendue"
}

export async function agentSourcePage(ctx: ReadCtx, emitter: Doc<"federationEmitters">, orgRef: string): Promise<Doc<"pages"> | null> {
  const mirror = await ctx.db.query("mirrors").withIndex("by_emitter_environment_object", q => q.eq("emitterId", emitter._id).eq("environment", emitter.environment).eq("objectRef", orgRef)).unique()
  if (!mirror || mirror.localTable !== "pages" || mirror.contract !== RESEAU_PUBLIC_CONTRACT || mirror.sourceState !== "active" || !mirror.localId || mirror.networkId !== emitter.networkId) return null
  const id = ctx.db.normalizeId("pages", mirror.localId)
  const page = id ? await ctx.db.get(id) : null
  return page && page.status === "active" && page.ownerKind === "institution" && page.trust === "official" && page.visibility === "root" && page.onRoot && await isFederatedContentAvailable(ctx, "pages", page._id) ? page : null
}

export async function liveAgentGrant(ctx: ReadCtx, grant: Doc<"federationAgentGrants">): Promise<AgentAffiliation | null> {
  if (grant.status !== "active" || grant.revokedAt !== undefined || !grant.orgRef || !grant.roleLabel || !grant.identityLinkId || !grant.membershipId || !grant.sourceDigest || grant.sourceRevision === undefined || !Number.isSafeInteger(grant.sourceRevision) || grant.sourceRevision < 1 || grant.sourceConsentedAt !== grant.grantedAt || grant.environment !== federationEnvironment(process.env.FEDERATION_ENVIRONMENT)) return null
  const emitter = await ctx.db.get(grant.emitterId)
  if (!emitter || emitter.environment !== grant.environment || emitter.networkId !== grant.networkId) return null
  const network = await reseauPublicNetwork(ctx, emitter)
  const person = await ctx.db.get(grant.personId)
  const consent = await ctx.db.get(grant.consentId)
  if (!network || !person || !await agentRootEligible(ctx, person, network) || !consent || consent.personId !== person._id || consent.networkId !== network._id || consent.purpose !== "administration_reflection" || consent.revokedAt !== undefined || consent.textVersion !== CONSENT_TEXT_VERSIONS.administration_reflection || consent.grantedAt !== grant.grantedAt) return null
  const idn = await ctx.db.query("identityLinks").withIndex("by_person_and_provider", q => q.eq("personId", person._id).eq("provider", "idn")).unique()
  if (!idn || idn.revokedAt !== undefined || (idn.loa ?? 0) < 2 || await administrativeSubjectDigest(emitter, idn.subject) !== grant.subjectDigest) return null
  const proof = await ctx.db.query("idnProofs").withIndex("by_subject", q => q.eq("subject", idn.subject)).unique()
  if (!proof || (proof.loa ?? 0) < 2) return null
  const link = await ctx.db.get(grant.identityLinkId)
  const member = await ctx.db.get(grant.membershipId)
  if (!link || link.provider !== "administration" || link.personId !== person._id || link.subject !== grant.subjectDigest || link.orgRef !== grant.orgRef || link.revokedAt !== undefined || !member || member.networkId !== network._id || member.personId !== person._id || member.verifiedBy !== "federation" || !isActiveStatus(member.status)) return null
  const page = await agentSourcePage(ctx, emitter, grant.orgRef)
  return page ? { administrationName: page.name, administrationHandle: page.handle, roleLabel: grant.roleLabel } : null
}

export async function hasLiveAdministrationGrant(ctx: ReadCtx, personId: Id<"persons">, networkId?: Id<"networks">): Promise<boolean> {
  // borné : un seul réseau administration ; doublon/volume inattendu refusé.
  const grants = await ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", personId)).take(2)
  return grants.length === 1 && !!grants[0] && (networkId === undefined || grants[0].networkId === networkId) && await liveAgentGrant(ctx, grants[0]) !== null
}

export async function publicAgentAffiliation(ctx: ReadCtx, personId: Id<"persons">): Promise<AgentAffiliation | null> {
  const grants = await ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", personId)).take(2)
  return grants.length === 1 && grants[0] ? await liveAgentGrant(ctx, grants[0]) : null
}
