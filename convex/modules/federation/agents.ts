/** PA9C : accord personnel explicite ; aucune identité ou adhésion reçue d'office. */
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { federationEnvironment, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { v } from "convex/values"
import type { QueryCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { personMutation, personQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { currentVerifiedIdnSubjectOf } from "../people/identity"
import { appendAudit } from "../platform/audit"
import { administrativeSubjectDigest, agentRootEligible, liveAgentGrant } from "./agentAuthority"
import { revokeAdministrationForPerson } from "./agentLifecycle"
import { reseauPublicNetwork } from "./reseauPublicAccess"
import { federationBodyDigest } from "./signature"
import { prepareAgentTransfer } from "./agentConsentTransfer"

const VERSION = CONSENT_TEXT_VERSIONS.administration_reflection
async function configuredSource(ctx: Pick<QueryCtx, "db">) {
  const environment = federationEnvironment(process.env.FEDERATION_ENVIRONMENT)
  if (!environment) return null
  const emitter = await ctx.db.query("federationEmitters").withIndex("by_slug_environment", q => q.eq("slug", RESEAU_PUBLIC_EMITTER).eq("environment", environment)).unique()
  if (!emitter) return null
  const network = await reseauPublicNetwork(ctx, emitter)
  return network ? { emitter, network } : null
}

/** @selfScoped La personne relit son choix et ses dates même privée d'accès au réseau. */
export const getMyAgentConsent = personQuery({
  args: {},
  returns: v.object({
    version: v.string(), eligible: v.boolean(), available: v.boolean(),
    status: v.union(v.literal("inactive"), v.literal("waiting"), v.literal("active"), v.literal("revoked"), v.literal("unavailable")),
    grantedAt: v.union(v.number(), v.null()), revokedAt: v.union(v.number(), v.null()),
    affiliation: v.union(v.null(), v.object({ administrationName: v.string(), administrationHandle: v.string(), roleLabel: v.string() })),
  }),
  handler: async ctx => {
    const source = await configuredSource(ctx)
    const rows = await ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", ctx.person._id)).take(2)
    const grant = rows.length === 1 ? rows[0] : undefined
    // Une preuve indisponible ferme l'activation, sans masquer le bouton de retrait.
    let subject: string | null = null
    try { subject = await currentVerifiedIdnSubjectOf(ctx, ctx.person) } catch { /* fail-closed pour l'éligibilité seulement */ }
    const eligible = !!source && !!subject && await agentRootEligible(ctx, ctx.person, source.network)
    const affiliation = grant && eligible ? await liveAgentGrant(ctx, grant) : null
    const consent = grant ? await ctx.db.get(grant.consentId) : null
    const available = source !== null && rows.length < 2
    const status = !grant ? (available ? "inactive" as const : "unavailable" as const)
      : grant.revokedAt !== undefined || grant.status === "revoked" ? "revoked" as const
      : affiliation ? "active" as const
      : eligible && available && grant.status === "waiting" && consent?.revokedAt === undefined && consent?.textVersion === VERSION && source && subject && grant.emitterId === source.emitter._id && grant.subjectDigest === await administrativeSubjectDigest(source.emitter, subject) ? "waiting" as const : "unavailable" as const
    return { version: VERSION, eligible, available, status, grantedAt: grant?.grantedAt ?? null, revokedAt: grant?.revokedAt ?? consent?.revokedAt ?? null, affiliation }
  },
})

/** @selfScoped L'accord est donné par le titulaire existant, pas par l'émetteur administratif. */
export const grant = personMutation({
  args: { accepted: v.literal(true), textVersion: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    if (args.textVersion !== VERSION) return fail("policyRefused")
    const source = await configuredSource(ctx)
    const subject = await currentVerifiedIdnSubjectOf(ctx, ctx.person)
    if (!source || !subject || !await agentRootEligible(ctx, ctx.person, source.network)) return fail("policyRefused")
    await enforceRateLimit(ctx, "person.consent", ctx.person._id)
    const existing = await ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", ctx.person._id)).take(2)
    if (existing.length > 1 || (existing[0] && existing[0].networkId !== source.network._id)) return fail("conflict")
    const previous = existing[0]
    const subjectDigest = await administrativeSubjectDigest(source.emitter, subject)
    if (previous && previous.revokedAt === undefined && previous.status !== "revoked") {
      const consent = await ctx.db.get(previous.consentId)
      if (previous.subjectDigest === subjectDigest && previous.emitterId === source.emitter._id && consent?.revokedAt === undefined && consent?.textVersion === VERSION) return null
      await revokeAdministrationForPerson(ctx, ctx.person._id)
    }
    const now = Date.now(), generation = (previous?.generation ?? 0) + 1
    const consentId = await ctx.db.insert("consents", { personId: ctx.person._id, networkId: source.network._id, purpose: "administration_reflection", textVersion: VERSION, origin: "settings", grantedAt: now })
    // Nonce de corrélation opaque issu d'une nouvelle référence serveur ; jamais une autorité d'authentification.
    const consentRef = await federationBodyDigest(JSON.stringify(["administration-grant", consentId, generation, now]))
    const agentRef = `agent:${await federationBodyDigest(consentRef)}`
    const values = { networkId: source.network._id, personId: ctx.person._id, emitterId: source.emitter._id, environment: source.emitter.environment, subjectDigest, consentRef, agentRef, consentId, generation, grantedAt: now, status: "waiting" as const, updatedAt: now,
      // Conserver la propriété des effets précédents, notamment une sanction jamais effacée.
      ...(previous?.identityLinkId ? { identityLinkId: previous.identityLinkId } : {}),
      ...(previous?.membershipId ? { membershipId: previous.membershipId } : {}),
    }
    if (previous) await ctx.db.replace(previous._id, { ...values, createdAt: previous.createdAt })
    else await ctx.db.insert("federationAgentGrants", { ...values, createdAt: now })
    await appendAudit(ctx, { action: "federation.agent_consent", capacity: "member", actorPersonId: ctx.person._id, networkId: source.network._id, subject: { table: "persons", id: ctx.person._id }, details: { textVersion: VERSION, generation }, at: now })
    return null
  },
})

/** @selfScoped Retrait idempotent, sans dépendance à la disponibilité de la source ni à l'adhésion. */
export const withdraw = personMutation({
  args: {}, returns: v.null(), handler: async ctx => {
    await enforceRateLimit(ctx, "person.consent", ctx.person._id)
    await revokeAdministrationForPerson(ctx, ctx.person._id)
    await appendAudit(ctx, { action: "federation.agent_withdraw", capacity: "member", actorPersonId: ctx.person._id, subject: { table: "persons", id: ctx.person._id } })
    return null
  },
})

/** @selfScoped Code court pour continuer dans son administration, sans sujet IDN dans l'URL. */
export const prepareTransfer = personMutation({
  args: {}, returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async ctx => {
    await enforceRateLimit(ctx, "person.consent", ctx.person._id)
    const source = await configuredSource(ctx)
    if (!source) return fail("policyRefused")
    return await prepareAgentTransfer(ctx, ctx.person, source.emitter, source.network)
  },
})

/** @selfScoped Matériel du futur transfert PA9D : seulement pour son titulaire connecté. */
export const myTransferGrant = personQuery({
  args: {}, returns: v.union(v.null(), v.object({ consentRef: v.string(), agentRef: v.string(), textVersion: v.string(), grantedAt: v.number() })),
  handler: async ctx => {
    const source = await configuredSource(ctx)
    if (!source || !await agentRootEligible(ctx, ctx.person, source.network)) return null
    const grant = await ctx.db.query("federationAgentGrants").withIndex("by_person_network", q => q.eq("personId", ctx.person._id).eq("networkId", source.network._id)).unique()
    const subject = await currentVerifiedIdnSubjectOf(ctx, ctx.person)
    const consent = grant ? await ctx.db.get(grant.consentId) : null
    if (!grant || grant.revokedAt !== undefined || grant.status === "revoked" || !subject || grant.emitterId !== source.emitter._id || grant.subjectDigest !== await administrativeSubjectDigest(source.emitter, subject) || !consent || consent.revokedAt !== undefined || consent.textVersion !== VERSION) return null
    return { consentRef: grant.consentRef, agentRef: grant.agentRef, textVersion: VERSION, grantedAt: grant.grantedAt }
  },
})
