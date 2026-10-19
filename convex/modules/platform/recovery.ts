/** PA10 : assertion de restauration en lecture seule, sur backend LOCAL jetable uniquement. */
import { v } from "convex/values"

import { internalQuery } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { isLocalDeployment } from "../../lib/devTools"
import { fail } from "../../lib/errors"
import { getScanStatus } from "../files/storageGuard"
import { canSeePostDoc } from "../posts/access"

/**
 * Les identifiants attendus sont ceux du relevé AVANT sauvegarde. Aucun nom,
 * corps, URL de fichier, contact ou secret ne sort de cette assertion.
 * L'origine doit être confirmée à nouveau : pas de cible implicite depuis .env.
 */
export const assertRestoredFixture = internalQuery({
  args: {
    confirmDisposable: v.literal("ANTSIA_LOCAL_DISPOSABLE_RESTORE"),
    expectedOrigin: v.string(),
    cases: v.array(v.object({
      networkId: v.id("networks"), personId: v.id("persons"), postId: v.id("posts"),
      expectedVisible: v.boolean(),
    })),
    files: v.array(v.object({ storageId: v.id("_storage"), expectedSha256: v.string() })),
  },
  returns: v.object({ checkedCases: v.number(), checkedFiles: v.number(), isolationCases: v.number(), passed: v.literal(true) }),
  handler: async (ctx, args) => {
    if (!isLocalDeployment() || args.expectedOrigin !== process.env.CONVEX_CLOUD_URL) return fail("policyRefused")
    if (args.cases.length < 2 || args.cases.length > 20 || args.files.length < 1 || args.files.length > 10) return fail("invalidArgument", { field: "fixture" })
    let isolationCases = 0, visibleCases = 0
    const networks = new Set<string>()
    for (const item of args.cases) {
      const network = await ctx.db.get(item.networkId), post = await ctx.db.get(item.postId)
      const person = await ctx.db.get(item.personId)
      if (!network || network.status !== "active" || !person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined
        || !post || !await isActiveMember(ctx, network._id, person._id)) return fail("policyRefused")
      networks.add(network._id)
      const visible = await canSeePostDoc(ctx, { network, personId: person._id }, post)
      if (visible !== item.expectedVisible) return fail("policyRefused")
      if (visible) visibleCases += 1
      if (!visible && post.networkId !== network._id && post.visibility === "network") isolationCases += 1
    }
    if (networks.size < 2 || isolationCases < 1 || visibleCases < 1) return fail("invalidArgument", { field: "isolationFixture" })
    for (const item of args.files) {
      const stored = await ctx.db.system.get("_storage", item.storageId)
      if (!stored || stored.sha256 !== item.expectedSha256 || !await getScanStatus(ctx, item.storageId)) return fail("policyRefused")
    }
    return { checkedCases: args.cases.length, checkedFiles: args.files.length, isolationCases, passed: true as const }
  },
})
