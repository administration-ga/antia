/** P08 : révocation LOCALE ; aucune prétendue commande distante link.revoke. */
import { COMMERCE_LINK_CONSENT_VERSION } from "@antsia/social-domain/commerce-link"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { managedShopOrNull } from "./access"
import { readCommerceLinkConfig } from "./commerceLinkConfig"

/** Une ligne active ne suffit jamais : mandat du consentant, page et configuration sont vivants. */
export async function liveShopCommerceLink(ctx: Pick<QueryCtx, "db">, networkId: Id<"networks">, shopId: Id<"shops">): Promise<Doc<"shopCommerceLinks"> | null> {
  const link = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", networkId).eq("shopId", shopId)).unique()
  if (!link || link.state !== "active" || link.consentTextVersion !== COMMERCE_LINK_CONSENT_VERSION) return null
  const config = await readCommerceLinkConfig()
  if (!config || config.fingerprint !== link.configFingerprint) return null
  const person = await ctx.db.get(link.personId)
  if (!person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined) return null
  const managed = await managedShopOrNull(ctx, networkId, link.personId, shopId)
  return managed?.page?._id === link.pageId && managed.shop.storefront !== "suspended" ? link : null
}

export async function invalidateCommerceChallenge(ctx: MutationCtx, challenge: Doc<"shopCommerceLinkChallenges">, status: "refused" | "revoked", now = Date.now()): Promise<void> {
  await ctx.db.patch(challenge._id, {
    status, codeVerifier: undefined, preparationBody: undefined, authorizationUrl: undefined,
    attemptToken: undefined, leaseUntil: undefined, updatedAt: now,
  })
  const command = await ctx.db.query("shopCommerceLinkCommands").withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id)).unique()
  if (command) await ctx.db.patch(command._id, { outcome: status, rawBody: undefined, updatedAt: now })
}

export async function revokeShopCommerceLink(ctx: MutationCtx, networkId: Id<"networks">, shopId: Id<"shops">): Promise<void> {
  const now = Date.now()
  const link = await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", networkId).eq("shopId", shopId)).unique()
  if (link && link.state !== "revoked") await ctx.db.patch(link._id, { state: "revoked", revokedAt: now, updatedAt: now })
  const challenge = await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_network_shop", (q) => q.eq("networkId", networkId).eq("shopId", shopId)).unique()
  if (challenge && challenge.status !== "revoked") await invalidateCommerceChallenge(ctx, challenge, "revoked", now)
}

/**
 * À appeler avant l'effacement des preuves personnelles. Lots bornés ; si false,
 * le job rappelle cette étape avant d'avancer. Le parcours générique supprime
 * ensuite liens/défis/commandes par leur personId (politiques explicites).
 */
export async function revokeCommerceForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<boolean> {
  let done = true
  const now = Date.now()
  for (const state of ["active", "suspended"] as const) {
    const links = await ctx.db.query("shopCommerceLinks").withIndex("by_person_state", (q) => q.eq("personId", personId).eq("state", state)).take(26)
    if (links.length > 25) done = false
    // L'effacement du consentant n'annule pas un nouveau défi d'un autre admin.
    for (const link of links.slice(0, 25)) await ctx.db.patch(link._id, { state: "revoked", revokedAt: now, updatedAt: now })
  }
  const challenges = await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_person_status", (q) => q.eq("personId", personId).eq("status", "pending")).take(26)
  if (challenges.length > 25) done = false
  for (const challenge of challenges.slice(0, 25)) await invalidateCommerceChallenge(ctx, challenge, "revoked", now)
  return done
}
