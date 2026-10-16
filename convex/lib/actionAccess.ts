/**
 * La garde de réseau d'une ACTION (`networkAction`, `lib/functions.ts`).
 *
 * Une action n'a pas de base : elle ne peut pas lire l'adhésion elle-même. Le
 * constructeur passe par une mutation d'admission (écriture) ou cette query
 * (lecture seule nominative), avec l'IDENTITÉ de l'action transmise par Convex :
 * même résolution, mêmes refus (`unauthenticated`, `notFound` indistinct,
 * suspension, statut insuffisant) que pour une query ou une mutation.
 */
import { v } from "convex/values"

import { internalMutation, internalQuery } from "../_generated/server"
import { assertSocialWriteAllowed } from "../modules/moderation/policy"
import { requireMembership } from "./access"
import { ACTION_WRITE_BUCKETS, enforceRateLimit } from "./rateLimit"
import { activeMembershipStatusValidator, literals } from "./validators"

export const membershipForAction = internalQuery({
  args: { networkId: v.id("networks"), minStatus: activeMembershipStatusValidator },
  returns: v.object({ personId: v.id("persons"), networkId: v.id("networks") }),
  handler: async (ctx, args) => {
    const access = await requireMembership(ctx, args.networkId, args.minStatus)
    return { personId: access.person._id, networkId: access.network._id }
  },
})

/**
 * Admission transactionnelle d'une action publique, AVANT stockage, jeton,
 * réveil ou autre effet externe. La clé vient de la même session, jamais de
 * l'action ni du client. L'admission ne remplace pas les droits sur la cible,
 * que chaque surface rejuge avant ses effets.
 */
export const admitActionWrite = internalMutation({
  args: {
    networkId: v.id("networks"),
    minStatus: activeMembershipStatusValidator,
    bucket: v.optional(literals(ACTION_WRITE_BUCKETS)),
  },
  returns: v.object({ personId: v.id("persons"), networkId: v.id("networks") }),
  handler: async (ctx, args) => {
    const access = await requireMembership(ctx, args.networkId, args.minStatus)
    await assertSocialWriteAllowed(ctx, args.networkId, access.person._id)
    const scoped = { ...ctx, ...access, networkId: args.networkId }
    await enforceRateLimit(scoped, "social.write", access.person._id)
    await enforceRateLimit(scoped, "action.write", access.person._id)
    if (args.bucket) await enforceRateLimit(scoped, args.bucket, access.person._id)
    return { personId: access.person._id, networkId: access.network._id }
  },
})
