/** P08 : seuls les serveurs échangent code et PKCE ; le navigateur reçoit l'URL allowlistée. */
import { COMMERCE_COMMAND_LIMITS, type CommerceLinkPermission } from "@antsia/social-domain/commerce/command"
import { COMMERCE_LINK_MAX_BYTES } from "@antsia/social-domain/commerce-link"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { networkAction } from "../../lib/functions"
import { readCommerceLinkConfig, type CommerceLinkConfig } from "./commerceLinkConfig"
import { commerceLinkHeaders, randomLinkId, randomLinkToken, readCommerceLinkResponse, validLinkToken } from "./commerceLinkCrypto"
import {
  beginLinkResultValidator, type BeginLinkResult, type ConfirmationAdmission, type CompleteLinkResult,
  completeLinkResultValidator, type PreparationAdmission,
} from "./commerceLinks"
import { commerceLinkPermissionValidator } from "./commerceLinkTables"

type ChallengeId = Id<"shopCommerceLinkChallenges">
type DeliveryArgs = { networkId: Id<"networks">; challengeId: ChallengeId; attemptToken: string }
type Reply = { rawResponse?: string; httpStatus?: number }

const prepare = makeFunctionReference<"mutation", {
  networkId: Id<"networks">; shopId: Id<"shops">; requestedPermissions: CommerceLinkPermission[]; consentTextVersion: string; configFingerprint: string;
  state: string; codeVerifier: string; requestId: string; subjectRef: string; antsiaShopRef: string; attemptToken: string;
}, PreparationAdmission>("modules/shops/commerceLinks:prepareLink")
const confirm = makeFunctionReference<"mutation", {
  networkId: Id<"networks">; state: string; code: string; requestId: string; attemptToken: string; configFingerprint: string;
}, ConfirmationAdmission>("modules/shops/commerceLinks:prepareConfirmation")
const authorize = makeFunctionReference<"mutation", DeliveryArgs & { phase: "preparing" | "confirming"; configFingerprint: string }, boolean>("modules/shops/commerceLinks:authorizeDelivery")
const finishPreparation = makeFunctionReference<"mutation", DeliveryArgs & Reply, BeginLinkResult>("modules/shops/commerceLinks:finishPreparation")
const finishConfirmation = makeFunctionReference<"mutation", DeliveryArgs & Reply, CompleteLinkResult>("modules/shops/commerceLinks:finishConfirmation")

/** Pas de suivi de redirection ; limite de temps commune aux en-têtes et au corps lu. */
async function post(config: CommerceLinkConfig, path: "/commerce/v1/link-challenges" | "/commerce/v1/commands", rawBody: string, headers: Record<string, string>): Promise<Reply> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(new URL(path, config.proHttpOrigin), { method: "POST", headers, body: rawBody, redirect: "error", signal: controller.signal })
    const rawResponse = await readCommerceLinkResponse(response, path === "/commerce/v1/link-challenges" ? COMMERCE_LINK_MAX_BYTES : COMMERCE_COMMAND_LIMITS.responseMaxBytes)
    return { httpStatus: response.status, ...(rawResponse === null ? {} : { rawResponse }) }
  } catch {
    // Ni corps, ni URL de retour, ni code/clé dans les logs ou erreurs publiques.
    return {}
  } finally { clearTimeout(timeout) }
}

export const beginLink = networkAction({
  args: { shopId: v.id("shops"), requestedPermissions: v.array(commerceLinkPermissionValidator), consentTextVersion: v.string() },
  returns: beginLinkResultValidator,
  handler: async (ctx, args): Promise<BeginLinkResult> => {
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const admission = await ctx.runMutation(prepare, {
      networkId: ctx.networkId, ...args, configFingerprint: config.fingerprint,
      state: randomLinkToken(), codeVerifier: randomLinkToken(), requestId: randomLinkId(),
      subjectRef: `antsia:sub:${randomLinkId()}`, antsiaShopRef: `antsia:shop:${randomLinkId()}`, attemptToken: randomLinkToken(),
    })
    if (admission.kind === "ready") return { outcome: "ready", authorizationUrl: admission.authorizationUrl, expiresAt: admission.expiresAt }
    if (admission.kind !== "deliver") return { outcome: "unavailable" }
    const delivery = { networkId: ctx.networkId, challengeId: admission.challengeId, attemptToken: admission.attemptToken }
    const headers = await commerceLinkHeaders(config, admission.rawBody)
    if (!await ctx.runMutation(authorize, { ...delivery, configFingerprint: config.fingerprint, phase: "preparing" })) return { outcome: "unavailable" }
    const reply = await post(config, "/commerce/v1/link-challenges", admission.rawBody, headers)
    // Même après timeout : session/rôle/config/incarnation sont relus avant de libérer le bail.
    return await ctx.runMutation(finishPreparation, { ...delivery, ...reply })
  },
})

export const completeLink = networkAction({
  args: { state: v.string(), code: v.string() }, returns: completeLinkResultValidator,
  handler: async (ctx, args): Promise<CompleteLinkResult> => {
    if (!validLinkToken(args.state) || !validLinkToken(args.code)) return { outcome: "refused" }
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const admission = await ctx.runMutation(confirm, { networkId: ctx.networkId, ...args, configFingerprint: config.fingerprint, requestId: randomLinkId(), attemptToken: randomLinkToken() })
    if (admission.kind === "linked") return { outcome: "linked", shopId: admission.shopId }
    if (admission.kind !== "deliver") return { outcome: admission.kind }
    const delivery = { networkId: ctx.networkId, challengeId: admission.challengeId, attemptToken: admission.attemptToken }
    const headers = await commerceLinkHeaders(config, admission.rawBody)
    if (!await ctx.runMutation(authorize, { ...delivery, configFingerprint: config.fingerprint, phase: "confirming" })) return { outcome: "refused" }
    const reply = await post(config, "/commerce/v1/commands", admission.rawBody, headers)
    return await ctx.runMutation(finishConfirmation, { ...delivery, ...reply })
  },
})
