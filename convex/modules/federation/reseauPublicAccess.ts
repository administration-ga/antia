/** Autorité actuelle de la source administrative, partagée par entrée et jobs. */
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"
import type { Doc } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"

export async function reseauPublicNetwork(ctx: Pick<QueryCtx, "db">, emitter: Doc<"federationEmitters">): Promise<Doc<"networks"> | null> {
  const network = await ctx.db.get(emitter.networkId)
  const root = network?.parentId ? await ctx.db.get(network.parentId) : null
  if (!emitter.enabled || emitter.slug !== RESEAU_PUBLIC_EMITTER || !emitter.allowedContracts.includes(RESEAU_PUBLIC_CONTRACT)
    || !network || network.slug !== "administration" || network.kind !== "closed" || network.membershipPolicy !== "mirror" || network.status !== "active"
    || !root || root.kind !== "root" || root.slug !== ROOT_NETWORK_SLUG || root.status !== "active") return null
  return network
}
