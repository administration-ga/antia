/** P15 : SSR des offres d'emploi sous projection publique explicite, sans repli de session. */
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import { query } from "../../_generated/server"
import { jobByHandle, jobDtoValidator, jobListValidator, listShopJobs } from "../shops/jobRead"
import { publicContext } from "./access"

/** @publicProjection Offre allowlistée JOBS-V1 (lien connu, clôture affichée), vitrine consentie, modération relue. */
export const job = query({
  args: { networkId: v.id("networks"), handle: v.string(), jobRef: v.string() }, returns: v.union(jobDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const context = await publicContext(ctx, args.networkId)
    return await jobByHandle(ctx, { root: context.root, readerPersonId: context.reader?.personId }, args.handle, args.jobRef)
  },
})

/** @publicProjection Offres ouvertes d'une vitrine consentie, fenêtre bornée, aucun candidat ni contact. */
export const listForShop = query({
  args: { networkId: v.id("networks"), handle: v.string(), paginationOpts: paginationOptsValidator }, returns: jobListValidator,
  handler: async (ctx, args) => {
    const context = await publicContext(ctx, args.networkId)
    return await listShopJobs(ctx, { root: context.root, readerPersonId: context.reader?.personId }, args.handle, args.paginationOpts)
  },
})
