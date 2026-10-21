"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shared/controls"
import { CATALOG_PAGE_SIZE, catalogFilters, type CatalogSearch } from "@/lib/catalog-search"
import { routes } from "@/lib/routes"
import { CatalogFiltersForm } from "./catalog-filters"
import { CatalogGrid, CatalogPagination } from "./catalog-grid"
import type { CatalogPage } from "./catalog-model"
import { OfferDetails } from "./offer-card"
import { CheckoutPrepareLink } from "../checkout/checkout-prepare-link"
import { OfferCartActions, OfferShareButton } from "../cart/offer-cart-actions"
import { ServiceOfferActions } from "../services/service-offer-actions"
import { ShopFrame, ShopLink, ShopQueryFailure } from "./shop-ui"

export function MemberCatalogScreen({ handle, search }: { handle: string; search: CatalogSearch | null }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("shops")
  return <ShopFrame title={t("catalog.title")}><ShopLink href={routes.storefront(handle)}>{t("catalog.backToShop")}</ShopLink>{search ? <MemberCatalogWindow key={JSON.stringify([networkId, personId, handle, search])} handle={handle} search={search} /> : <ShopQueryFailure href={routes.shopCatalog(handle)} />}</ShopFrame>
}

function MemberCatalogWindow({ handle, search, preview = false }: { handle: string; search: CatalogSearch; preview?: boolean }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("shops")
  const filters = catalogFilters(search)
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.list, { networkId, handle, ...filters, paginationOpts: { cursor: search.cursor, numItems: CATALOG_PAGE_SIZE } })
  if (query.isError) return <div role="alert" className="grid gap-3 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] "><p>{t("catalog.unavailable")}</p><Button variant="outline" pending={query.isFetching} onClick={() => { void query.refetch() }}>{t("common.retry")}</Button></div>
  if (query.isPending || !query.data) return <p role="status" className="text-sm text-muted-foreground">{t("catalog.loading")}</p>
  const page: CatalogPage = query.data
  const translate = (key: string, options?: Record<string, unknown>) => t(key, options)
  return <div className="antsia-page" aria-busy={query.isFetching || undefined}>
    {!preview ? <CatalogFiltersForm handle={handle} filters={filters} collections={page.collections} audience="member" /> : null}
    <CatalogGrid page={page} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={translate} />
    {page.page.length === 0 ? <p className="text-sm text-muted-foreground">{t("catalog.publicConsentHint")}</p> : null}
    {preview ? <ShopLink href={routes.shopCatalog(handle)}>{t("catalog.openCatalog")}</ShopLink> : <CatalogPagination page={page} handle={handle} audience="member" filters={filters} cursor={search.cursor} t={translate} />}
  </div>
}

export function MemberCatalogPreview({ handle }: { handle: string }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("shops")
  return <section aria-labelledby="member-shop-catalog" className="grid gap-4"><h2 id="member-shop-catalog" className="antsia-subtitle">{t("catalog.title")}</h2><MemberCatalogWindow key={JSON.stringify([networkId, personId, handle])} handle={handle} search={{ cursor: null }} preview /></section>
}

export function MemberOfferScreen({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId, personId } = useNetwork()
  return <MemberOfferQuery key={JSON.stringify([networkId, personId, handle, offerRef])} handle={handle} offerRef={offerRef} />
}
function MemberOfferQuery({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("shops")
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.offer, { networkId, handle, offerRef })
  return <ShopFrame title={t("catalog.offerTitle")}><ShopLink href={routes.shopCatalog(handle)}>{t("catalog.backToCatalog")}</ShopLink>{query.isError ? <ShopQueryFailure href={routes.shopCatalog(handle)} retry={() => { void query.refetch() }} /> : query.isPending || query.data === undefined ? <p role="status">{t("catalog.loading")}</p> : query.data === null ? <ShopQueryFailure href={routes.shopCatalog(handle)} /> : <OfferDetails key={`${query.data.offerRef}:${query.data.revision}`} offer={query.data} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => t(key, options)} actionSlot={<div className="grid w-full gap-4">{query.data.kind === "service" ? <ServiceOfferActions offer={query.data} /> : <OfferCartActions offer={query.data} />}<div className="flex flex-wrap gap-3">{query.data.actions.contact ? <ShopLink variant="message" href={routes.shopContact(query.data.shopHandle, query.data.offerRef)}>{t("contact.ask")}</ShopLink> : null}{query.data.kind === "service" ? null : <CheckoutPrepareLink handle={query.data.shopHandle} offerRef={query.data.offerRef} />}<OfferShareButton handle={query.data.shopHandle} offerRef={query.data.offerRef} /></div></div>} />}</ShopFrame>
}
