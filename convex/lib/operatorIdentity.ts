/** PA7 : l'autorité de console appartient à une session IDN, pas à un ancien lien de profil. */
import { components } from "../_generated/api"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { fail } from "./errors"
import { getActiveIdentity } from "./session"

type IdentityCtx = Pick<QueryCtx, "db" | "runQuery">

export function requirePlatformAdmin(actor: { operator: Doc<"operators"> }): void {
  if (actor.operator.role !== "platform_admin") fail("operatorRequired")
}

export async function hasCurrentIdnLink(ctx: Pick<QueryCtx, "db">, person: Doc<"persons">, subject: string): Promise<boolean> {
  const link = await ctx.db.query("identityLinks").withIndex("by_person_and_provider", (q) => q.eq("personId", person._id).eq("provider", "idn")).unique()
  const proof = await ctx.db.query("idnProofs").withIndex("by_subject", (q) => q.eq("subject", subject)).unique()
  return Boolean(link && link.revokedAt === undefined && link.subject === subject && (link.loa ?? 0) >= 2 && (proof?.loa ?? 0) >= 2)
}

export async function isLiveOperatorSession(ctx: IdentityCtx, person: Doc<"persons">, proof: Doc<"operatorSessionProofs"> | null): Promise<boolean> {
  if (!proof || proof.authUserId !== person.authUserId || proof.loa < 2 || proof.expiresAt <= Date.now() || !await hasCurrentIdnLink(ctx, person, proof.idnSubject)) return false
  const root = await ctx.db.query("networks").withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active")).unique()
  const membership = root ? await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root._id).eq("personId", person._id)).unique() : null
  if (membership?.status === "suspendue" || membership?.status === "partie") return false
  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "_id", value: proof.sessionId }] })
  return Boolean(session && session._id === proof.sessionId && session.userId === person.authUserId && session.expiresAt > Date.now())
}

export async function requireOperatorSession(ctx: QueryCtx | MutationCtx, person: Doc<"persons">): Promise<Doc<"operatorSessionProofs">> {
  const identity = await getActiveIdentity(ctx)
  if (!identity || typeof identity.sessionId !== "string") return fail("operatorRequired")
  const proof = await ctx.db.query("operatorSessionProofs").withIndex("by_session", (q) => q.eq("sessionId", identity.sessionId as string)).unique()
  if (!await isLiveOperatorSession(ctx, person, proof) || !proof) return fail("operatorRequired")
  return proof
}

/** La personne est créée seulement par son geste d'entrée ; la preuve peut la précéder. */
export async function bindOperatorSession(ctx: MutationCtx, sessionId: unknown, person: Doc<"persons">): Promise<void> {
  if (typeof sessionId !== "string") return
  const proof = await ctx.db.query("operatorSessionProofs").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).unique()
  if (proof && proof.authUserId === person.authUserId && proof.personId === undefined) await ctx.db.patch(proof._id, { personId: person._id })
}
