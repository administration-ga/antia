/**
 * La garde de réseau d'une ACTION (`networkAction`, `lib/functions.ts`).
 *
 * Une action n'a pas de base : elle ne peut pas lire l'adhésion elle-même. Le
 * constructeur demande donc `requireMembership` à cette query interne, qui
 * court avec l'IDENTITÉ de l'action (Convex la transmet à `ctx.runQuery`) :
 * même résolution, mêmes refus (`unauthenticated`, `notFound` indistinct,
 * suspension, statut insuffisant) que pour une query ou une mutation.
 */
import { v } from "convex/values"

import { internalQuery } from "../_generated/server"
import { requireMembership } from "./access"
import { activeMembershipStatusValidator } from "./validators"

export const membershipForAction = internalQuery({
  args: { networkId: v.id("networks"), minStatus: activeMembershipStatusValidator },
  returns: v.object({ personId: v.id("persons"), networkId: v.id("networks") }),
  handler: async (ctx, args) => {
    const access = await requireMembership(ctx, args.networkId, args.minStatus)
    return { personId: access.person._id, networkId: access.network._id }
  },
})
