/** P08 : liaison volontaire. Les mutations internes relisent session ET administrateur vivant. */
import { COMMERCE_COMMAND_SCOPES, COMMERCE_LINK_PERMISSIONS, parseCommerceCommandRequest, parseCommerceCommandResponse } from "@antsia/social-domain/commerce/command"
import { COMMERCE_COMMAND_CONTRACT, commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_LINK_CONSENT_VERSION, COMMERCE_LINK_CONTRACT, COMMERCE_LINK_TTL_MS, parseCommerceLinkPreparation, parseCommerceLinkPrepared } from "@antsia/social-domain/commerce-link"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { requireMembership } from "../../lib/access"
import { notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { getActiveIdentity } from "../../lib/session"
import { isFederatedPage } from "../federation/mirrorAccess"
import { assertSocialWriteAllowed } from "../moderation/policy"
import { managedShopOrNull, requireManagedShop } from "./access"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { s256Challenge, sha256Hex, validLinkToken } from "./commerceLinkCrypto"
import { invalidateCommerceChallenge, liveShopCommerceLink, revokeShopCommerceLink } from "./commerceLinkLifecycle"
import { commerceLinkPermissionValidator, commerceLinkStateValidator } from "./commerceLinkTables"

const LEASE_MS = 30_000
const expireChallenge = makeFunctionReference<"mutation", { networkId: Id<"networks">; challengeId: Id<"shopCommerceLinkChallenges">; stateDigest: string }, null>("modules/shops/commerceLinks:expireLinkChallenge")
const deliveryValidator = v.object({ kind: v.literal("deliver"), challengeId: v.id("shopCommerceLinkChallenges"), attemptToken: v.string(), rawBody: v.string() })
export const beginLinkResultValidator = v.union(v.object({ outcome: v.literal("ready"), authorizationUrl: v.string(), expiresAt: v.number() }), v.object({ outcome: v.literal("unavailable") }))
export const completeLinkResultValidator = v.union(v.object({ outcome: v.literal("linked"), shopId: v.id("shops") }), v.object({ outcome: v.union(v.literal("unavailable"), v.literal("refused")) }))
export type BeginLinkResult = { outcome: "ready"; authorizationUrl: string; expiresAt: number } | { outcome: "unavailable" }
export type CompleteLinkResult = { outcome: "linked"; shopId: Id<"shops"> } | { outcome: "unavailable" | "refused" }
export type LinkDelivery = { kind: "deliver"; challengeId: Id<"shopCommerceLinkChallenges">; attemptToken: string; rawBody: string }
export type PreparationAdmission = LinkDelivery | { kind: "ready"; authorizationUrl: string; expiresAt: number } | { kind: "unavailable" }
export type ConfirmationAdmission = LinkDelivery | { kind: "linked"; shopId: Id<"shops"> } | { kind: "unavailable" | "refused" }

async function authority(ctx: QueryCtx | MutationCtx, networkId: Id<"networks">, shopId: Id<"shops">) {
  const access = await requireMembership(ctx, networkId, "declaree")
  if (access.person.erasedAt !== undefined || access.person.deletionRequestedAt !== undefined) return null
  const identity = await getActiveIdentity(ctx)
  if (!identity || typeof identity.sessionId !== "string") return null
  const managed = await managedShopOrNull(ctx, networkId, access.person._id, shopId)
  if (!managed?.page || managed.shop.storefront === "suspended" || await isFederatedPage(ctx, managed.page._id)) return null
  return { ...managed, page: managed.page, personId: access.person._id, sessionDigest: await sha256Hex(identity.sessionId) }
}

/** Aucune autorité ne se déduit du seul auteur enregistré dans le défi. */
async function liveChallenge(ctx: MutationCtx, networkId: Id<"networks">, challengeId: Id<"shopCommerceLinkChallenges">) {
  const challenge = await ctx.db.get(challengeId)
  if (!challenge || challenge.networkId !== networkId || challenge.expiresAt <= Date.now()) return null
  const config = await readCommerceLinkConfig()
  if (!config || config.fingerprint !== challenge.configFingerprint || challenge.consentTextVersion !== COMMERCE_LINK_CONSENT_VERSION) return null
  const current = await authority(ctx, networkId, challenge.shopId)
  if (!current || current.personId !== challenge.personId || current.page._id !== challenge.pageId || current.sessionDigest !== challenge.sessionDigest) return null
  await assertSocialWriteAllowed(ctx, networkId, current.personId)
  return { challenge, config, current }
}

function samePermissions(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((permission, index) => permission === right[index])
}

export const linkStatus = networkQuery({
  args: { shopId: v.id("shops") },
  returns: v.object({
    available: v.boolean(), reason: v.union(v.literal("configuration_missing"), v.literal("page_required"), v.null()),
    link: v.union(v.null(), v.object({ state: commerceLinkStateValidator, shopRef: v.string(), linkRef: v.string(), permissions: v.array(commerceLinkPermissionValidator), linkedAt: v.number() })),
    pending: v.union(v.null(), v.object({ expiresAt: v.number() })), consentTextVersion: v.string(),
  }),
  handler: async (ctx, args) => {
    const managed = await requireManagedShop(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.shopId)
    if (managed.page && await isFederatedPage(ctx, managed.page._id)) return notFound()
    const config = await readCommerceLinkConfig()
    const link = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", ctx.networkId).eq("shopId", args.shopId)).unique()
    const challenge = await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_network_shop", (q) => q.eq("networkId", ctx.networkId).eq("shopId", args.shopId)).unique()
    const reason = !managed.page ? "page_required" as const : !config ? "configuration_missing" as const : null
    const suspended = link?.state === "active" && !await liveShopCommerceLink(ctx, ctx.networkId, args.shopId)
    return {
      available: reason === null && managed.shop.storefront !== "suspended" && ctx.person.deletionRequestedAt === undefined, reason,
      link: link ? { state: link.state === "active" && suspended ? "suspended" as const : link.state, shopRef: link.shopRef, linkRef: link.linkRef, permissions: link.permissions, linkedAt: link.linkedAt } : null,
      pending: challenge?.status === "pending" && challenge.expiresAt > Date.now() && challenge.configFingerprint === config?.fingerprint ? { expiresAt: challenge.expiresAt } : null,
      consentTextVersion: COMMERCE_LINK_CONSENT_VERSION,
    }
  },
})

export const revokeLink = networkMutation({
  writeBucket: "shop.link.revoke",
  args: { shopId: v.id("shops") }, returns: v.null(),
  handler: async (ctx, args) => {
    const managed = await requireManagedShop(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.shopId)
    if (managed.page && await isFederatedPage(ctx, managed.page._id)) return notFound()
    await revokeShopCommerceLink(ctx, ctx.networkId, args.shopId)
    return null
  },
})

export const prepareLink = internalMutation({
  args: {
    networkId: v.id("networks"), shopId: v.id("shops"), requestedPermissions: v.array(commerceLinkPermissionValidator), consentTextVersion: v.string(), configFingerprint: v.string(),
    state: v.string(), codeVerifier: v.string(), requestId: v.string(), subjectRef: v.string(), antsiaShopRef: v.string(), attemptToken: v.string(),
  },
  returns: v.union(deliveryValidator, v.object({ kind: v.literal("ready"), authorizationUrl: v.string(), expiresAt: v.number() }), v.object({ kind: v.literal("unavailable") })),
  handler: async (ctx, args): Promise<PreparationAdmission> => {
    const current = await authority(ctx, args.networkId, args.shopId)
    if (!current) return { kind: "unavailable" }
    await assertSocialWriteAllowed(ctx, args.networkId, current.personId)
    await enforceRateLimit(ctx, "shop.link.begin", current.personId)
    const config = await readCommerceLinkConfig()
    const permissions = [...args.requestedPermissions].sort()
    if (!config || config.fingerprint !== args.configFingerprint || args.consentTextVersion !== COMMERCE_LINK_CONSENT_VERSION || permissions.length === 0 || permissions.length > COMMERCE_LINK_PERMISSIONS.length || new Set(permissions).size !== permissions.length || !validLinkToken(args.state) || !validLinkToken(args.attemptToken) || args.codeVerifier.length !== 43 || !validLinkToken(args.codeVerifier)) return { kind: "unavailable" }
    const existingLink = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", args.networkId).eq("shopId", args.shopId)).unique()
    // Une liaison active se révoque explicitement avant d'être remplacée.
    if (existingLink?.state === "active") return { kind: "unavailable" }
    const now = Date.now()
    const previous = await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_network_shop", (q) => q.eq("networkId", args.networkId).eq("shopId", args.shopId)).unique()
    if (previous?.status === "pending" && previous.personId === current.personId && previous.sessionDigest === current.sessionDigest && previous.pageId === current.page._id && previous.configFingerprint === config.fingerprint && previous.expiresAt > now && samePermissions(previous.permissions, permissions)) {
      if (previous.phase === "ready" && previous.authorizationUrl) return { kind: "ready", authorizationUrl: previous.authorizationUrl, expiresAt: previous.expiresAt }
      if (previous.phase !== "preparing" || !previous.preparationBody || (previous.leaseUntil ?? 0) > now) return { kind: "unavailable" }
      await ctx.db.patch(previous._id, { attemptToken: args.attemptToken, leaseUntil: now + LEASE_MS, updatedAt: now })
      return { kind: "deliver", challengeId: previous._id, attemptToken: args.attemptToken, rawBody: previous.preparationBody }
    }
    const subject = await ctx.db.query("shopCommerceSubjects").withIndex("by_network_person", (q) => q.eq("networkId", args.networkId).eq("personId", current.personId)).unique()
    const shopRef = await ctx.db.query("shopCommerceShopRefs").withIndex("by_network_shop", (q) => q.eq("networkId", args.networkId).eq("shopId", args.shopId)).unique()
    const subjectRef = subject?.subjectRef ?? args.subjectRef
    const antsiaShopRef = shopRef?.antsiaShopRef ?? args.antsiaShopRef
    const expiresAt = now + COMMERCE_LINK_TTL_MS
    const rawBody = commerceCanonicalJson({
      contract: COMMERCE_LINK_CONTRACT, version: 1, source: config.source, environment: config.environment,
      requestId: args.requestId, state: args.state, codeChallenge: await s256Challenge(args.codeVerifier), codeChallengeMethod: "S256",
      subjectRef, antsiaShopRef, requestedPermissions: permissions, redirectUri: config.redirectUri, issuedAt: now, expiresAt, consentTextVersion: COMMERCE_LINK_CONSENT_VERSION,
    })
    if (!rawBody || !parseCommerceLinkPreparation(rawBody, { source: config.source, environment: config.environment, nowMs: now, allowedRedirectUris: [config.redirectUri] }).ok) return { kind: "unavailable" }
    if (!subject) await ctx.db.insert("shopCommerceSubjects", { networkId: args.networkId, personId: current.personId, subjectRef, createdAt: now })
    if (!shopRef) await ctx.db.insert("shopCommerceShopRefs", { networkId: args.networkId, shopId: args.shopId, antsiaShopRef, createdAt: now })
    if (previous) {
      const command = await ctx.db.query("shopCommerceLinkCommands").withIndex("by_challenge", (q) => q.eq("challengeId", previous._id)).unique()
      if (command) await ctx.db.delete(command._id)
    }
    const fields = {
      networkId: args.networkId, shopId: args.shopId, pageId: current.page._id, personId: current.personId,
      sessionDigest: current.sessionDigest, stateDigest: await sha256Hex(args.state), source: config.source, environment: config.environment, configFingerprint: config.fingerprint,
      status: "pending" as const, phase: "preparing" as const, requestId: args.requestId, subjectRef, antsiaShopRef, permissions,
      consentTextVersion: COMMERCE_LINK_CONSENT_VERSION, consentedAt: now, expiresAt, codeVerifier: args.codeVerifier,
      preparationBody: rawBody, attemptToken: args.attemptToken, leaseUntil: now + LEASE_MS, createdAt: now, updatedAt: now,
    }
    const challengeId = previous?._id ?? await ctx.db.insert("shopCommerceLinkChallenges", fields)
    if (previous) await ctx.db.replace(previous._id, fields)
    await ctx.scheduler.runAfter(COMMERCE_LINK_TTL_MS, expireChallenge, { networkId: args.networkId, challengeId, stateDigest: fields.stateDigest })
    return { kind: "deliver", challengeId, attemptToken: args.attemptToken, rawBody }
  },
})

/** Relu immédiatement avant chaque HTTP, y compris une reprise du même corps. */
export const authorizeDelivery = internalMutation({
  args: { networkId: v.id("networks"), challengeId: v.id("shopCommerceLinkChallenges"), attemptToken: v.string(), configFingerprint: v.string(), phase: v.union(v.literal("preparing"), v.literal("confirming")) }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const live = await liveChallenge(ctx, args.networkId, args.challengeId)
    return !!live && live.config.fingerprint === args.configFingerprint && live.challenge.status === "pending" && live.challenge.phase === args.phase && live.challenge.attemptToken === args.attemptToken && (live.challenge.leaseUntil ?? 0) > Date.now()
  },
})

export const finishPreparation = internalMutation({
  args: { networkId: v.id("networks"), challengeId: v.id("shopCommerceLinkChallenges"), attemptToken: v.string(), rawResponse: v.optional(v.string()), httpStatus: v.optional(v.number()) }, returns: beginLinkResultValidator,
  handler: async (ctx, args): Promise<BeginLinkResult> => {
    const live = await liveChallenge(ctx, args.networkId, args.challengeId)
    if (!live || live.challenge.status !== "pending" || live.challenge.phase !== "preparing" || live.challenge.attemptToken !== args.attemptToken || (live.challenge.leaseUntil ?? 0) <= Date.now()) return { outcome: "unavailable" }
    const { challenge, config } = live
    const request = challenge.preparationBody ? parseCommerceLinkPreparation(challenge.preparationBody, { source: config.source, environment: config.environment, nowMs: Date.now(), allowedRedirectUris: [config.redirectUri] }) : null
    const response = args.rawResponse && request?.ok ? parseCommerceLinkPrepared(args.rawResponse, { request: request.value, authorizationOrigin: config.proAppOrigin, nowMs: Date.now() }) : null
    if (!response?.ok || args.httpStatus !== 200) {
      await ctx.db.patch(challenge._id, { attemptToken: undefined, leaseUntil: undefined, updatedAt: Date.now() })
      return { outcome: "unavailable" }
    }
    await ctx.db.patch(challenge._id, { phase: "ready", authorizationUrl: response.value.authorizationUrl, attemptToken: undefined, leaseUntil: undefined, updatedAt: Date.now() })
    return { outcome: "ready", authorizationUrl: response.value.authorizationUrl, expiresAt: challenge.expiresAt }
  },
})

export const prepareConfirmation = internalMutation({
  args: { networkId: v.id("networks"), state: v.string(), code: v.string(), requestId: v.string(), attemptToken: v.string(), configFingerprint: v.string() },
  returns: v.union(deliveryValidator, v.object({ kind: v.literal("linked"), shopId: v.id("shops") }), v.object({ kind: v.union(v.literal("unavailable"), v.literal("refused")) })),
  handler: async (ctx, args): Promise<ConfirmationAdmission> => {
    const access = await requireMembership(ctx, args.networkId, "declaree")
    await enforceRateLimit(ctx, "shop.link.complete", access.person._id)
    if (!validLinkToken(args.state) || !validLinkToken(args.code) || !validLinkToken(args.attemptToken)) return { kind: "refused" }
    // Le digest est calculé serveur ; aucune recherche par une valeur brute du navigateur.
    const stateDigest = await sha256Hex(args.state)
    const challenge = await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_state_digest", (q) => q.eq("stateDigest", stateDigest)).unique()
    if (!challenge || challenge.stateDigest !== stateDigest) return { kind: "refused" }
    const live = await liveChallenge(ctx, args.networkId, challenge._id)
    if (!live || live.config.fingerprint !== args.configFingerprint) return { kind: "refused" }
    const codeDigest = await sha256Hex(args.code)
    if (challenge.status === "completed" && challenge.codeDigest === codeDigest) {
      const link = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", args.networkId).eq("shopId", challenge.shopId)).unique()
      return link?.state === "active" && link.personId === live.current.personId && link.configFingerprint === live.config.fingerprint ? { kind: "linked", shopId: challenge.shopId } : { kind: "refused" }
    }
    if (challenge.status !== "pending") return { kind: "refused" }
    if (challenge.phase === "preparing" || (challenge.leaseUntil ?? 0) > Date.now()) return { kind: "unavailable" }
    if (challenge.codeDigest && challenge.codeDigest !== codeDigest) return { kind: "refused" }
    let command = await ctx.db.query("shopCommerceLinkCommands").withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id)).unique()
    if (command && (command.codeDigest !== codeDigest || command.outcome !== "pending" || !command.rawBody)) return { kind: "refused" }
    if (!command) {
      if (!challenge.codeVerifier) return { kind: "refused" }
      const now = Date.now()
      const rawBody = commerceCanonicalJson({
        command: "link.confirm", contract: COMMERCE_COMMAND_CONTRACT, version: 1, requestId: args.requestId,
        source: live.config.source, environment: live.config.environment, issuedAt: now, expiresAt: challenge.expiresAt,
        scope: COMMERCE_COMMAND_SCOPES["link.confirm"], subject: { kind: "seller_operator", ref: challenge.subjectRef, authVerifiedAt: now },
        payload: { antsiaShopRef: challenge.antsiaShopRef, codeVerifier: challenge.codeVerifier, linkCode: args.code, requestedPermissions: challenge.permissions, consent: { givenAt: challenge.consentedAt, purpose: "commerce_link", textVersion: challenge.consentTextVersion } },
      })
      if (!rawBody || !parseCommerceCommandRequest(rawBody, { source: live.config.source, environment: live.config.environment, nowMs: now }).ok) return { kind: "refused" }
      const id = await ctx.db.insert("shopCommerceLinkCommands", { networkId: args.networkId, personId: live.current.personId, challengeId: challenge._id, requestId: args.requestId, codeDigest, bodySha256: await sha256Hex(rawBody), rawBody, outcome: "pending", createdAt: now, updatedAt: now })
      command = await ctx.db.get(id)
    }
    if (!command?.rawBody || await sha256Hex(command.rawBody) !== command.bodySha256) return { kind: "refused" }
    await ctx.db.patch(challenge._id, { phase: "confirming", codeDigest, attemptToken: args.attemptToken, leaseUntil: Date.now() + LEASE_MS, updatedAt: Date.now() })
    return { kind: "deliver", challengeId: challenge._id, attemptToken: args.attemptToken, rawBody: command.rawBody }
  },
})

export const finishConfirmation = internalMutation({
  args: { networkId: v.id("networks"), challengeId: v.id("shopCommerceLinkChallenges"), attemptToken: v.string(), rawResponse: v.optional(v.string()), httpStatus: v.optional(v.number()) }, returns: completeLinkResultValidator,
  handler: async (ctx, args): Promise<CompleteLinkResult> => {
    const live = await liveChallenge(ctx, args.networkId, args.challengeId)
    if (!live || live.challenge.status !== "pending" || live.challenge.phase !== "confirming" || live.challenge.attemptToken !== args.attemptToken || (live.challenge.leaseUntil ?? 0) <= Date.now()) return { outcome: "refused" }
    const { challenge, config } = live
    const command = await ctx.db.query("shopCommerceLinkCommands").withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id)).unique()
    if (!command?.rawBody || command.outcome !== "pending" || await sha256Hex(command.rawBody) !== command.bodySha256) return { outcome: "refused" }
    const request = parseCommerceCommandRequest(command.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
    const response = args.rawResponse && request.ok && request.value.command === "link.confirm" ? parseCommerceCommandResponse(args.rawResponse, { request: request.value, requestSha256: command.bodySha256 }, Date.now()) : null
    if (!response?.ok || ![200, 422].includes(args.httpStatus ?? 0) || (response.value.outcome !== "accepted" && response.value.outcome !== "rejected")) {
      await ctx.db.patch(challenge._id, { attemptToken: undefined, leaseUntil: undefined, updatedAt: Date.now() })
      return { outcome: "unavailable" }
    }
    if (response.value.outcome === "rejected" && args.httpStatus === 422) {
      await invalidateCommerceChallenge(ctx, challenge, "refused")
      await ctx.db.patch(command._id, { responseSha256: await sha256Hex(args.rawResponse!), respondedAt: response.value.respondedAt })
      return { outcome: "refused" }
    }
    const result = response.value.result
    if (response.value.outcome !== "accepted" || args.httpStatus !== 200 || !result || !("linkRef" in result) || !("grantedPermissions" in result) || !("shopRef" in result) || !("linkedAt" in result) || !("state" in result) || result.state !== "active") {
      await ctx.db.patch(challenge._id, { attemptToken: undefined, leaseUntil: undefined, updatedAt: Date.now() })
      return { outcome: "unavailable" }
    }
    const now = Date.now()
    const previous = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", args.networkId).eq("shopId", challenge.shopId)).unique()
    const fields = {
      networkId: args.networkId, shopId: challenge.shopId, pageId: live.current.page._id, personId: live.current.personId,
      state: "active" as const, source: config.source, environment: config.environment, configFingerprint: config.fingerprint,
      subjectRef: challenge.subjectRef, antsiaShopRef: challenge.antsiaShopRef, shopRef: result.shopRef, linkRef: result.linkRef,
      permissions: [...result.grantedPermissions], linkedAt: result.linkedAt, consentTextVersion: challenge.consentTextVersion, consentedAt: challenge.consentedAt,
      createdAt: previous?.createdAt ?? now, updatedAt: now,
    }
    if (previous) await ctx.db.replace(previous._id, fields)
    else await ctx.db.insert("shopCommerceLinks", fields)
    await ctx.db.patch(challenge._id, { status: "completed", codeVerifier: undefined, preparationBody: undefined, authorizationUrl: undefined, attemptToken: undefined, leaseUntil: undefined, updatedAt: now })
    await ctx.db.patch(command._id, { outcome: "accepted", rawBody: undefined, responseSha256: await sha256Hex(args.rawResponse!), respondedAt: response.value.respondedAt, updatedAt: now })
    return { outcome: "linked", shopId: challenge.shopId }
  },
})

/** Réveil transactionnel sans identité utilisateur : ne fait qu'expurger l'incarnation échue. */
export const expireLinkChallenge = internalMutation({
  args: { networkId: v.id("networks"), challengeId: v.id("shopCommerceLinkChallenges"), stateDigest: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (challenge?.networkId === args.networkId && challenge.stateDigest === args.stateDigest && challenge.expiresAt <= Date.now() && challenge.status === "pending") await invalidateCommerceChallenge(ctx, challenge, "revoked")
    return null
  },
})
