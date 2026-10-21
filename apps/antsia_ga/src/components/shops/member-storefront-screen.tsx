"use client"

import { StorefrontTerms } from "./storefront-terms"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useMutation } from "convex/react"
import { effectiveActivityConfiguration } from "@antsia/social-domain/activityConfiguration"
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
  const directory = routes.marketplace({ view: "shops" })
  return <ShopFrame title={query.isError ? t("storefront.title") : query.data?.name ?? t("storefront.title")}>
    <ShopLink href={directory}>{t("directory.title")}</ShopLink>
    {query.isError ? <ShopQueryFailure href={directory} retry={() => void query.refetch()} /> : query.data === undefined ? <CenteredStatus label={t("common.loading")} /> : query.data === null ? <ShopQueryFailure href={directory} /> : <MemberStorefront shop={query.data} />}
  </ShopFrame>
}

export function MemberStorefront({ shop }: { shop: StorefrontData }) {
  const { t, i18n } = useTranslation("shops")
  const { t: ux } = useTranslation("commerceExperience")
  const { networkId } = useNetwork()
  const follow = useMutation(api.modules.pages.pages.follow)
  const unfollow = useMutation(api.modules.pages.pages.unfollow)
  const action = useShopAction()
  const configuration = effectiveActivityConfiguration(shop.activityConfiguration, shop.model)
  const hasCatalog = shop.blocks.includes("catalog") || shop.blocks.includes("services")
  return <div className="antsia-page" data-activity-template={configuration.template}>
    <Card><div className="grid min-w-0 gap-4 [overflow-wrap:anywhere]">{shop.bannerUrl ? <Image unoptimized src={shop.bannerUrl} width={1200} height={400} alt="" loading="eager" className="max-h-64 w-full rounded-[var(--esp-media-radius)] object-cover" /> : null}<div className="flex min-w-0 items-start gap-4"><ShopLogo url={shop.logoUrl} name={shop.name} /><div className="grid min-w-0 gap-2"><p className="antsia-subtitle">{shop.name}</p><p className="text-sm text-muted-foreground">@{shop.handle}</p><p className="text-sm">{t(`badges.${shop.badge}`)} · {configuration.capabilities.map(capability => t(`activityConfiguration:capabilities.${capability}`)).join(" · ")}</p></div></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{hasCatalog ? <ShopLink variant="commerce" href={routes.shopCatalog(shop.handle)}>{ux("storefront.offers")}</ShopLink> : null}<Button type="button" variant="outline" className="aria-[pressed=false]:border-transparent aria-[pressed=false]:bg-[var(--role-social-fill)] aria-[pressed=false]:text-[color:var(--role-social-on)]" pending={action.pending} aria-pressed={shop.viewer.following} onClick={() => void action.run(async (): Promise<{ following: boolean }> => shop.viewer.following ? await unfollow({ networkId, pageId: shop.pageId }) : await follow({ networkId, handle: shop.handle }))}>{t(shop.viewer.following ? "storefront.unfollow" : "storefront.follow")}</Button><StorefrontExistingContact handle={shop.handle} />{shop.viewer.manages ? <ShopLink href={routes.myShops()}>{t("storefront.manage")}</ShopLink> : null}{shop.publicListing ? <ShopLink href={routes.publicStorefront(shop.handle)}>{t("storefront.publicVersion")}</ShopLink> : null}</div>
      {shop.viewer.manages ? <p className="text-sm text-muted-foreground">{ux("storefront.manageHint")}</p> : null}
      {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
    </div></Card>
    {shop.blocks.map((block) => block === "catalog" || block === "services" ? <MemberCatalogPreview key={block} handle={shop.handle} kind={block === "catalog" ? "product" : "service"} /> : block === "about" ? <Card key={block}><div className="grid gap-4"><h2 className="antsia-subtitle">{t("storefront.about")}</h2>{shop.description ? <p className="whitespace-pre-wrap">{shop.description}</p> : null}<dl className="grid gap-4 sm:grid-cols-2">{(["specialty", "serviceArea", "hours"] as const).map((field) => shop[field] ? <div key={field}><dt className="text-sm font-medium text-muted-foreground">{t(`storefront.${field}`)}</dt><dd className="whitespace-pre-wrap">{shop[field]}</dd></div> : null)}</dl></div></Card> : block === "publications" ? <Card key={block}><div className="grid gap-3"><h2 className="antsia-subtitle">{t("blocks.publications")}</h2><p className="text-sm text-muted-foreground">{t("storefront.publicationsHint")}</p><ShopLink href={routes.page(shop.handle)}>{t("storefront.socialPage")}</ShopLink></div></Card> : null)}
    <StorefrontTerms value={shop.storefrontTerms} locale={i18n.resolvedLanguage === "en" ? "en" : "fr"} t={t} />
    <MemberShopJobsPreview handle={shop.handle} />
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
