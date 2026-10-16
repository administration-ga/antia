/**
 * Une identité JWT n'autorise le moteur que tant que sa session Better Auth
 * est vivante. La révocation serveur prend effet avant l'expiration du JWT,
 * pour les lectures comme pour les écritures (PA4).
 *
 * Aucun import du réglage Better Auth ici : cette garde est aussi utilisée
 * pendant l'onboarding et ne doit pas former de cycle avec son émetteur.
 */
import type { UserIdentity } from "convex/server"

import { components } from "../_generated/api"
import type { MutationCtx, QueryCtx } from "../_generated/server"

/** L'adaptateur peut rejeter un identifiant malformé avant de rendre `null`. */
function isInvalidSessionId(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /Invalid argument `id`, expected ID/i.test(error.message)
    || /(?:Invalid|not a valid|is not a valid) (?:Convex )?(?:document )?ID\b/i.test(error.message)
}

/**
 * Identité authentifiée ET session encore active, sans exception locale.
 * Une panne de composant est relancée : elle ne devient jamais un succès
 * public ou une autorisation fondée sur le seul JWT.
 */
export async function getActiveIdentity(ctx: QueryCtx | MutationCtx): Promise<UserIdentity | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity || typeof identity.sessionId !== "string" || !identity.sessionId) return null

  let session: unknown
  try {
    session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "_id", value: identity.sessionId }],
    })
  } catch (error) {
    if (isInvalidSessionId(error)) return null
    throw error
  }
  if (typeof session !== "object" || session === null) return null
  if (!("_id" in session) || session._id !== identity.sessionId) return null
  if (!("userId" in session) || session.userId !== identity.subject) return null
  if (!("expiresAt" in session) || typeof session.expiresAt !== "number" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null
  return identity
}
