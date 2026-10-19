/** P10/P11 : sujet acheteur opaque commun, distinct du mandat vendeur P08. */
import type { CommerceEnvironment } from "@antsia/social-domain/commerce/primitives"
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { readCommerceLinkConfig } from "./commerceLinkConfig"

export async function ensureCommerceBuyerSubject(ctx: MutationCtx, args: {
  networkId: Id<"networks">; personId: Id<"persons">; shopId: Id<"shops">;
  source: string; environment: CommerceEnvironment;
}): Promise<string> {
  const current = await ctx.db.query("shopCommerceBuyerSubjects").withIndex("by_scope", (q) =>
    q.eq("networkId", args.networkId).eq("personId", args.personId).eq("shopId", args.shopId)
      .eq("source", args.source).eq("environment", args.environment)).unique()
  if (current) return current.subjectRef
  const config = await readCommerceLinkConfig()
  if (!config || config.source !== args.source || config.environment !== args.environment) return notFound()
  // HMAC déterministe autorisé en mutation ; aucun ID interne n'est transmis.
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const input = JSON.stringify(["antsia-commerce-buyer-v1", args.source, args.environment, args.networkId, args.personId, args.shopId])
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)))
  const subjectRef = `antsia:sub:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  await ctx.db.insert("shopCommerceBuyerSubjects", { ...args, subjectRef, createdAt: Date.now() })
  return subjectRef
}

/**
 * P15 : sujet opaque `candidate`, même construction mais étiquette et table
 * DISTINCTES — aucune corrélation entre achat et candidature, ni entre boutiques
 * (COMMAND §2). Aucun rôle de structure n'en découle chez PRO.GA.
 */
export async function ensureCommerceCandidateSubject(ctx: MutationCtx, args: {
  networkId: Id<"networks">; personId: Id<"persons">; shopId: Id<"shops">;
  source: string; environment: CommerceEnvironment;
}): Promise<string> {
  const current = await ctx.db.query("commerceApplicationSubjects").withIndex("by_scope", (q) =>
    q.eq("networkId", args.networkId).eq("personId", args.personId).eq("shopId", args.shopId)
      .eq("source", args.source).eq("environment", args.environment)).unique()
  if (current) return current.subjectRef
  const config = await readCommerceLinkConfig()
  if (!config || config.source !== args.source || config.environment !== args.environment) return notFound()
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const input = JSON.stringify(["antsia-commerce-candidate-v1", args.source, args.environment, args.networkId, args.personId, args.shopId])
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)))
  const subjectRef = `antsia:sub:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  await ctx.db.insert("commerceApplicationSubjects", { ...args, subjectRef, createdAt: Date.now() })
  return subjectRef
}
