/** P07 : vitrine commerciale publique dédiée, sans élargir les pages officielles. */
import { computePageBadge } from "@antsia/social-domain/badges"
import { v } from "convex/values"

import { query } from "../../_generated/server"
import { servableUrl } from "../files/storageGuard"
import { findPageByHandle } from "../pages/access"
import { publicStorefrontPage, shopOfPage } from "../shops/access"
import { visibleStorefrontBlocks } from "../shops/rules"
import { type PublicStorefront, publicStorefrontValidator } from "../shops/validators"
import { originDto, publicContext } from "./access"
import { catalogStorefrontBlocks } from "../shops/catalogRead"

/** @publicProjection Vitrine consentie, origine/portée/modération/gérants/médias relus, sans identifiant interne ni contact. */
export const getStorefront = query({
  args: { networkId: v.id("networks"), handle: v.string() },
  returns: v.union(publicStorefrontValidator, v.null()),
  handler: async (ctx, args): Promise<PublicStorefront | null> => {
    const context = await publicContext(ctx, args.networkId)
    const page = await findPageByHandle(ctx, args.handle)
    if (!page) return null
    const shop = await shopOfPage(ctx, page._id)
    if (!shop) return null
    const exposed = await publicStorefrontPage(ctx, context.root, shop, context.reader?.personId)
    if (!exposed) return null
    const [logoUrl, bannerUrl] = await Promise.all([
      page.logoStorageId ? servableUrl(ctx, page.logoStorageId) : null,
      page.bannerStorageId ? servableUrl(ctx, page.bannerStorageId) : null,
    ])
    return {
      handle: page.handle,
      name: page.name,
      description: page.description ?? null,
      logoUrl,
      bannerUrl,
      model: shop.model,
      specialty: shop.specialty ?? null,
      serviceArea: shop.serviceArea ?? null,
      hours: shop.hours ?? null,
      badge: computePageBadge(page.trust),
      // Catalogue P09 sous sa porte publique ; les publications community restent fermées.
      blocks: [...await catalogStorefrontBlocks(ctx, context.root, shop, context.reader?.personId), ...visibleStorefrontBlocks(shop.model, true).filter((block) => block === "about")],
      publishedAt: shop.publishedAt ?? shop.updatedAt,
      origin: originDto(exposed.origin),
    }
  },
})
