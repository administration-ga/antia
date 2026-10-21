import { parseCommerceStorefrontTerms } from "@antsia/social-domain/commerce/storefrontTerms"
import type { PublicStorefront } from "@convex/modules/shops/validators"
import { api } from "@convex/_generated/api"
import { BADGES } from "@antsia/social-domain/badges"
import { cache } from "react"
import { z } from "zod"

import { projected } from "./public-data"
import { activityConfigurationSchema } from "./activity-configuration-schema"

/** Projection allowlistée ; aucune session, signature ou donnée commerciale privée. */
const assetUrl = z.string().url().max(8192).refine((value) => {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
})
const shortText = z.string().max(500)

export const publicStorefrontSchema: z.ZodType<PublicStorefront> = z.object({
  storefrontTerms: z.custom<NonNullable<PublicStorefront["storefrontTerms"]>>(value => parseCommerceStorefrontTerms(value) !== null).optional(),
  handle: shortText.min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).nullable(),
  logoUrl: assetUrl.nullable(),
  bannerUrl: assetUrl.nullable(),
  model: z.enum(["products", "quote_services"]),
  activityConfiguration: activityConfigurationSchema.optional(),
  specialty: z.string().max(80).nullable(),
  serviceArea: z.string().max(120).nullable(),
  hours: z.string().max(200).nullable(),
  badge: z.enum(BADGES),
  blocks: z.array(z.enum(["catalog", "services", "publications", "about"])).max(4),
  publishedAt: z.number().finite().nonnegative().max(8_640_000_000_000_000),
  origin: z.object({ slug: shortText.min(1), name: shortText.min(1) }).strict(),
}).strict()

export type { PublicStorefront }

/** La porte partagée conserve OTT, sujet et refus de session ; aucun repli anonyme. */
export const loadPublicStorefront = cache((handle: string, handoff = false) =>
  projected(api.modules.public.shops.getStorefront, { handle }, publicStorefrontSchema.nullable(), handoff),
)
