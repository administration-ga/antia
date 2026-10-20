"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useMutation } from "convex/react"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import { Button, Card, CenteredStatus } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import type { StorefrontData } from "./shop-model"
import { ShopFrame, ShopLink, ShopLogo, ShopQueryFailure, useShopAction } from "./shop-ui"
import { MemberCatalogPreview } from "./catalog-member-screen"
import { MemberShopJobsPreview } from "@/components/jobs/member-shop-jobs-screen"

export function MemberStorefrontScreen({ handle }: { handle: string }) {
  const { networkId, personId } = useNetwork()
  return <StorefrontQuery key={`${networkId}:${personId}:${handle}`} handle={handle} />
}
function StorefrontQuery({ handle }: { handle: string }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const query = useAuthenticatedConvexQuery(api.modules.shops.shops.storefront, { networkId, handle })
  return <ShopFrame title={query.isError ? t("storefront.title") : query.data?.name ?? t("storefront.title")}>
    <ShopLink href={routes.shopDirectory()}>{t("directory.title")}</ShopLink>
    {query.isError ? <ShopQueryFailure href={routes.shopDirectory()} retry={() => void query.refetch()} /> : query.data === undefined ? <CenteredStatus label={t("common.loading")} /> : query.data === null ? <ShopQueryFailure href={routes.shopDirectory()} /> : <MemberStorefront shop={query.data} />}
  </ShopFrame>
}

export function MemberStorefront({ shop }: { shop: StorefrontData }) {
  const { t } = useTranslation("shops")
  const { t: ux } = useTranslation("commerceExperience")
  const { networkId } = useNetwork()
  const follow = useMutation(api.modules.pages.pages.follow)
  const unfollow = useMutation(api.modules.pages.pages.unfollow)
  const action = useShopAction()
  const hasCatalog = shop.blocks.includes("catalog") || shop.blocks.includes("services")
  return <div className="grid gap-5">
    <Card><div className="grid min-w-0 gap-4 [overflow-wrap:anywhere]">{shop.bannerUrl ? <Image unoptimized src={shop.bannerUrl} width={1200} height={400} alt="" loading="lazy" className="max-h-64 w-full rounded-[var(--esp-media-radius)] object-cover" /> : null}<div className="flex min-w-0 items-start gap-4"><ShopLogo url={shop.logoUrl} name={shop.name} /><div className="grid min-w-0 gap-2"><p className="font-semibold">{shop.name}</p><p className="text-sm text-muted-foreground">@{shop.handle}</p><p className="text-sm">{t(`badges.${shop.badge}`)} · {t(`models.${shop.model}`)}</p></div></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{hasCatalog ? <ShopLink variant="commerce" href={routes.shopCatalog(shop.handle)}>{ux("storefront.offers")}</ShopLink> : null}<Button type="button" variant="outline" pending={action.pending} aria-pressed={shop.viewer.following} onClick={() => void action.run(async (): Promise<{ following: boolean }> => shop.viewer.following ? await unfollow({ networkId, pageId: shop.pageId }) : await follow({ networkId, handle: shop.handle }))}>{t(shop.viewer.following ? "storefront.unfollow" : "storefront.follow")}</Button><StorefrontExistingContact handle={shop.handle} />{shop.viewer.manages ? <ShopLink href={routes.myShops()}>{t("storefront.manage")}</ShopLink> : null}{shop.publicListing ? <ShopLink href={routes.publicStorefront(shop.handle)}>{t("storefront.publicVersion")}</ShopLink> : null}</div>
      {shop.viewer.manages ? <p className="text-sm text-muted-foreground">{ux("storefront.manageHint")}</p> : null}
      {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
    </div></Card>
    {hasCatalog ? <MemberCatalogPreview handle={shop.handle} /> : null}
    {/* P15 : offres d'emploi reçues de PRO.GA, rendues seulement si l'employeur en a d'ouvertes. */}
    <MemberShopJobsPreview handle={shop.handle} />
    {shop.blocks.includes("about") ? <Card><div className="grid gap-4"><h2 className="text-lg font-semibold">{t("storefront.about")}</h2>{shop.description ? <p className="whitespace-pre-wrap">{shop.description}</p> : null}<dl className="grid gap-3">{(["specialty", "serviceArea", "hours"] as const).map((field) => shop[field] ? <div key={field}><dt className="text-sm font-medium text-muted-foreground">{t(`storefront.${field}`)}</dt><dd className="whitespace-pre-wrap">{shop[field]}</dd></div> : null)}</dl></div></Card> : null}
    {shop.blocks.includes("publications") ? <Card><div className="grid gap-3"><h2 className="text-lg font-semibold">{t("blocks.publications")}</h2><p className="text-sm text-muted-foreground">{t("storefront.publicationsHint")}</p><ShopLink href={routes.page(shop.handle)}>{t("storefront.socialPage")}</ShopLink></div></Card> : null}
  </div>
}

/** Sans readiness de contact général, seule une conversation déjà autorisée est proposée. */
function StorefrontExistingContact({ handle }: { handle: string }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("commerceExperience")
  const thread = useAuthenticatedConvexQuery(api.modules.commercialMessaging.threads.findMyThread, { networkId, shopHandle: handle })
  if (thread.isError || thread.isPending || !thread.data) return null
  return <ShopLink variant="message" href={routes.commercialConversation(thread.data.threadId)}>{t("storefront.existingConversation")}</ShopLink>
}
