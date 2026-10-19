/** PA9D : transfert privé d'un accord ANTSIA vers le même titulaire administratif. */
import { AGENT_CONSENT_TRANSFER_PATH, agentConsentTransferSigningText, parseAgentConsentTransferRequest } from "@antsia/social-domain/agentConsentTransfer"
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { equalFederationSignature, federationEnvironment, freshFederationTimestamp, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { v } from "convex/values"
import { internal } from "../../_generated/api"
import type { Doc } from "../../_generated/dataModel"
import { httpAction, internalMutation, type MutationCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { enforceRateLimit } from "../../lib/rateLimit"
import { currentVerifiedIdnSubjectOf } from "../people/identity"
import { administrativeSubjectDigest, agentRootEligible } from "./agentAuthority"
import { readFederationBody } from "./http"
import { reseauPublicNetwork } from "./reseauPublicAccess"
import { federationBodyDigest, federationTextSignature } from "./signature"
import { federationEnvironmentValidator } from "./tables"

export const AGENT_TRANSFER_TTL_MS = 10 * 60 * 1000
const grantValidator = v.object({ agentRef: v.string(), consentRef: v.string(), textVersion: v.string(), grantedAt: v.number() })
const refusalValidator = v.object({ outcome: v.union(v.literal("unavailable"), v.literal("unauthorized"), v.literal("invalid_request")) })

/** Origine exacte fournie par le propriétaire ; aucun hôte choisi par le navigateur. */
function transferUrl(token: string, environment: "sandbox" | "production"): URL | null {
  const raw = process.env.ANTSIA_ADMINISTRATION_PUBLIC_ORIGIN
  if (!raw || raw.trim() !== raw) return null
  try {
    const url = new URL(raw)
    const local = url.protocol === "http:" && environment === "sandbox" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null
    url.pathname = "/espace/profil"
    url.searchParams.set("section", "reseau")
    // Le fragment n'est pas transmis par HTTP ni dans le Referer du navigateur.
    url.hash = `antsia-transfer=${token}`
    return url
  } catch { return null }
}

export async function prepareAgentTransfer(ctx: MutationCtx, person: Doc<"persons">, emitter: Doc<"federationEmitters">, network: Doc<"networks">): Promise<{ url: string; expiresAt: number }> {
  if (emitter.environment !== federationEnvironment(process.env.FEDERATION_ENVIRONMENT) || !await agentRootEligible(ctx, person, network)) return fail("policyRefused")
  const grant = await ctx.db.query("federationAgentGrants").withIndex("by_person_network", q => q.eq("personId", person._id).eq("networkId", network._id)).unique()
  const subject = await currentVerifiedIdnSubjectOf(ctx, person)
  const consent = grant ? await ctx.db.get(grant.consentId) : null
  if (!grant || grant.status === "revoked" || grant.revokedAt !== undefined || grant.emitterId !== emitter._id || grant.environment !== emitter.environment || !subject || grant.subjectDigest !== await administrativeSubjectDigest(emitter, subject) || !consent || consent.personId !== person._id || consent.purpose !== "administration_reflection" || consent.networkId !== network._id || consent.grantedAt !== grant.grantedAt || consent.revokedAt !== undefined || consent.textVersion !== CONSENT_TEXT_VERSIONS.administration_reflection) return fail("policyRefused")
  const now = Date.now(), revision = (grant.transferRevision ?? 0) + 1
  const token = await federationBodyDigest(JSON.stringify(["agent-transfer", grant._id, grant.consentRef, revision, now]))
  const url = transferUrl(token, emitter.environment)
  if (!url) return fail("policyRefused")
  const expiresAt = now + AGENT_TRANSFER_TTL_MS
  await ctx.db.patch(grant._id, { transferTokenHash: await federationBodyDigest(token), transferExpiresAt: expiresAt, transferUsedAt: undefined, transferRevision: revision, updatedAt: now })
  return { url: url.toString(), expiresAt }
}

/** Rejuge signature, configuration et titulaire dans la transaction de consommation du code. */
export const redeem = internalMutation({
  args: { emitterId: v.id("federationEmitters"), emitterRevision: v.number(), environment: federationEnvironmentValidator, timestamp: v.string(), signature: v.string(), rawBody: v.string() },
  returns: v.union(refusalValidator, v.object({ outcome: v.literal("granted"), grant: grantValidator })),
  handler: async (ctx, args) => {
    if (args.environment !== federationEnvironment(process.env.FEDERATION_ENVIRONMENT) || !freshFederationTimestamp(args.timestamp, Date.now())) return { outcome: "unauthorized" as const }
    const emitter = await ctx.db.get(args.emitterId)
    if (!emitter || emitter.revision !== args.emitterRevision || emitter.environment !== args.environment || emitter.slug !== RESEAU_PUBLIC_EMITTER || !await reseauPublicNetwork(ctx, emitter)) return { outcome: "unauthorized" as const }
    const expected = await federationTextSignature(agentConsentTransferSigningText(args.environment, args.timestamp, args.rawBody), emitter.keyEnvName)
    if (!expected) return { outcome: "unavailable" as const }
    if (!equalFederationSignature(expected, args.signature)) return { outcome: "unauthorized" as const }
    await enforceRateLimit(ctx, "federation.receive", `agent-transfer:${emitter._id}:${emitter.environment}`)
    const parsed = parseAgentConsentTransferRequest(args.rawBody)
    if (!parsed.ok) return { outcome: "invalid_request" as const }
    const tokenHash = await federationBodyDigest(parsed.request.token)
    const grant = await ctx.db.query("federationAgentGrants").withIndex("by_transfer_token_hash", q => q.eq("transferTokenHash", tokenHash)).unique()
    if (!grant || grant.emitterId !== emitter._id || grant.environment !== args.environment || grant.networkId !== emitter.networkId || grant.revokedAt !== undefined || grant.status === "revoked" || grant.transferUsedAt !== undefined || grant.transferExpiresAt === undefined || grant.transferExpiresAt <= Date.now()) return { outcome: "unauthorized" as const }
    const person = await ctx.db.get(grant.personId)
    const network = await reseauPublicNetwork(ctx, emitter)
    const consent = await ctx.db.get(grant.consentId)
    if (!person || !network || !await agentRootEligible(ctx, person, network) || !consent || consent.personId !== person._id || consent.networkId !== grant.networkId || consent.purpose !== "administration_reflection" || consent.revokedAt !== undefined || consent.textVersion !== CONSENT_TEXT_VERSIONS.administration_reflection || consent.grantedAt !== grant.grantedAt || await currentVerifiedIdnSubjectOf(ctx, person) !== parsed.request.idnSub || grant.subjectDigest !== await administrativeSubjectDigest(emitter, parsed.request.idnSub) || grant.agentRef !== `agent:${await federationBodyDigest(grant.consentRef)}`) return { outcome: "unauthorized" as const }
    await ctx.db.patch(grant._id, { transferUsedAt: Date.now(), transferTokenHash: undefined, updatedAt: Date.now() })
    return { outcome: "granted" as const, grant: { agentRef: grant.agentRef, consentRef: grant.consentRef, textVersion: consent.textVersion, grantedAt: grant.grantedAt } }
  },
})

function response(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers } })
}

/** Aucun CORS navigateur : seul le serveur administratif enregistré peut résoudre le code. */
export const transfer = httpAction(async (ctx, request): Promise<Response> => {
  const environment = federationEnvironment(process.env.FEDERATION_ENVIRONMENT)
  if (!environment) return response(503, JSON.stringify({ outcome: "unavailable" }))
  const timestamp = request.headers.get("x-antsia-timestamp") ?? ""
  const signature = request.headers.get("x-antsia-signature") ?? ""
  if (request.headers.get("x-antsia-emitter") !== RESEAU_PUBLIC_EMITTER || request.headers.get("x-antsia-environment") !== environment || !freshFederationTimestamp(timestamp, Date.now())) return response(401, JSON.stringify({ outcome: "unauthorized" }))
  const body = await readFederationBody(request)
  if (!body.ok || !parseAgentConsentTransferRequest(body.rawBody).ok) return response(400, JSON.stringify({ outcome: "invalid_request" }))
  const emitter = await ctx.runQuery(internal.modules.federation.emitters.getForInbox, { slug: RESEAU_PUBLIC_EMITTER, environment })
  if (!emitter) return response(401, JSON.stringify({ outcome: "unauthorized" }))
  const expected = await federationTextSignature(agentConsentTransferSigningText(environment, timestamp, body.rawBody), emitter.keyEnvName)
  if (!expected) return response(503, JSON.stringify({ outcome: "unavailable" }))
  if (!equalFederationSignature(expected, signature)) return response(401, JSON.stringify({ outcome: "unauthorized" }))
  try {
    const result = await ctx.runMutation(internal.modules.federation.agentConsentTransfer.redeem, { emitterId: emitter.emitterId, emitterRevision: emitter.revision, environment, timestamp, signature, rawBody: body.rawBody })
    const rawResponse = JSON.stringify(result)
    const responseTimestamp = String(Math.floor(Date.now() / 1000))
    const responseSignature = await federationTextSignature(agentConsentTransferSigningText(environment, responseTimestamp, rawResponse, await federationBodyDigest(body.rawBody)), emitter.keyEnvName)
    if (!responseSignature) return response(503, JSON.stringify({ outcome: "unavailable" }))
    return response(result.outcome === "granted" ? 200 : result.outcome === "invalid_request" ? 400 : result.outcome === "unavailable" ? 503 : 401, rawResponse, { "x-antsia-environment": environment, "x-antsia-timestamp": responseTimestamp, "x-antsia-signature": responseSignature })
  } catch {
    // Ni code, sujet, corps ni motif interne ne sont reflétés dans le refus.
    return response(503, JSON.stringify({ outcome: "unavailable" }))
  }
})

export { AGENT_CONSENT_TRANSFER_PATH }
