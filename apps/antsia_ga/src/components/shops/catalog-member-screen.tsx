"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Button } from "@/components/shared/controls"
import { CATALOG_PAGE_SIZE, catalogFilters, catalogSearchFromParams, type CatalogSearch } from "@/lib/catalog-search"
import { routes } from "@/lib/routes"
import type { OfferInitialSelection } from "@/lib/offer-variant-selection"
import { CatalogFiltersForm } from "./catalog-filters"
import { CatalogGrid, CatalogPagination } from "./catalog-grid"
import type { CatalogPage } from "./catalog-model"
import { OfferDetails } from "./offer-card"
import { CheckoutPrepareLink } from "../checkout/checkout-prepare-link"
import { OfferCartActions, OfferShareButton } from "../cart/offer-cart-actions"
import { ServiceOfferActions } from "../services/service-offer-actions"
import { ShopFrame, ShopLink, ShopQueryFailure } from "./shop-ui"

export function MemberCatalogScreen({ handle, search, provider = false }: { handle: string; search: CatalogSearch | null; provider?: boolean }) {
  const { t } = useTranslation("shops")
  const { t: providerT } = useTranslation("provider")
  return <ShopFrame title={provider ? providerT("catalog.title") : t("catalog.title")}><ShopLink href={provider ? routes.provider(handle) : routes.storefront(handle)}>{provider ? providerT("catalog.backToProvider") : t("catalog.backToShop")}</ShopLink><Suspense fallback={<p role="status">{t("catalog.loading")}</p>}><MemberCatalogSelection handle={handle} initialSearch={search} provider={provider} /></Suspense></ShopFrame>
}

/** L'URL courante pilote aussi les transitions SPA, sans attendre un nouveau snapshot serveur. */
function MemberCatalogSelection({ handle, initialSearch, provider }: { handle: string; initialSearch: CatalogSearch | null; provider: boolean }) {
  const params = useSearchParams()
  const { networkId, personId } = useNetwork()
  const parsed = params === null ? initialSearch : catalogSearchFromParams(params)
  const search = parsed && (!provider || parsed.kind !== "product") ? { ...parsed, ...(provider ? { kind: "service" as const } : {}) } : null
  return search ? <MemberCatalogWindow key={JSON.stringify([networkId, personId, handle, search])} handle={handle} search={search} provider={provider} /> : <ShopQueryFailure href={provider ? routes.providerCatalog(handle) : routes.shopCatalog(handle)} />
}

function MemberCatalogWindow({ handle, search, preview = false, provider = false }: { handle: string; search: CatalogSearch; preview?: boolean; provider?: boolean }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("shops")
  const filters = catalogFilters(search)
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.list, { networkId, handle, ...filters, paginationOpts: { cursor: search.cursor, numItems: CATALOG_PAGE_SIZE } })
  if (query.isError) return <div role="alert" className="grid gap-3 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-4 "><p>{t("catalog.unavailable")}</p><Button variant="outline" pending={query.isFetching} onClick={() => { void query.refetch() }}>{t("common.retry")}</Button></div>
  if (query.isPending || !query.data) return <p role="status" className="text-sm text-muted-foreground">{t("catalog.loading")}</p>
  const page: CatalogPage = query.data
  const translate = (key: string, options?: Record<string, unknown>) => t(key, options)
  return <div className="mp-page" aria-busy={query.isFetching || undefined}>
    {!preview ? <CatalogFiltersForm handle={handle} filters={filters} collections={page.collections} audience="member" provider={provider} /> : null}
    {page.indexStatus === "building" ? <p role="status" className="text-sm text-muted-foreground">{t("catalog.indexBuilding")}</p> : null}
    {page.indexStatus !== "building" || page.page.length ? <CatalogGrid page={page} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={translate} /> : null}
    {page.page.length === 0 && page.indexStatus !== "building" ? <p className="text-sm text-muted-foreground">{t("catalog.publicConsentHint")}</p> : null}
    {preview ? <ShopLink href={provider ? routes.providerCatalog(handle, filters) : routes.shopCatalog(handle, filters)}>{t("catalog.openCatalog")}</ShopLink> : <CatalogPagination page={page} handle={handle} audience="member" filters={filters} cursor={search.cursor} t={translate} provider={provider} />}
  </div>
}

export function MemberCatalogPreview({ handle, kind }: { handle: string; kind?: "product" | "service" }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("shops")
  return <section aria-labelledby={`member-shop-catalog-${kind ?? "all"}`} className="grid gap-4"><h2 id={`member-shop-catalog-${kind ?? "all"}`} className="mp-subtitle">{t(kind === "service" ? "blocks.services" : "catalog.title")}</h2><MemberCatalogWindow key={JSON.stringify([networkId, personId, handle])} handle={handle} search={{ cursor: null, ...(kind ? { kind } : {}) }} preview /></section>
}

export function MemberOfferScreen({ handle, offerRef, initialSelection, provider = false }: { handle: string; offerRef: string; initialSelection?: OfferInitialSelection; provider?: boolean }) {
  const { networkId, personId } = useNetwork()
  return <MemberOfferQuery key={JSON.stringify([networkId, personId, handle, offerRef, initialSelection])} handle={handle} offerRef={offerRef} initialSelection={initialSelection} provider={provider} />
}
function MemberOfferQuery({ handle, offerRef, initialSelection, provider }: { handle: string; offerRef: string; initialSelection?: OfferInitialSelection; provider: boolean }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("shops")
  const { t: providerT } = useTranslation("provider")
  const catalogHref = provider ? routes.providerCatalog(handle) : routes.shopCatalog(handle)
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.offer, { networkId, handle, offerRef })
  const candidate = !query.isError && !query.isPending ? query.data : null
  const offer = provider && candidate?.kind !== "service" ? null : candidate
  const demo = offer?.offerRef.startsWith("demo:offer:") === true
  return <ShopFrame title={provider ? providerT("detail.title") : t("catalog.offerTitle")}><ShopLink href={catalogHref}>{provider ? providerT("actions.catalog") : t("catalog.backToCatalog")}</ShopLink>{query.isError ? <ShopQueryFailure href={catalogHref} retry={() => { void query.refetch() }} /> : query.isPending || query.data === undefined ? <p role="status">{t("catalog.loading")}</p> : !offer ? <ShopQueryFailure href={catalogHref} /> : <OfferDetails offer={offer} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => t(key, options)} providerT={(key, options) => providerT(key, options)} actionSlot={<div className="grid w-full gap-4">{demo ? <p className="text-sm text-muted-foreground">{t("publicActions.demoNotice")}</p> : offer.kind === "service" ? <ServiceOfferActions offer={offer} /> : <OfferCartActions offer={offer} initialSelection={initialSelection} />}<div className="flex flex-wrap gap-3">{!demo && offer.actions.contact ? <ShopLink variant="message" href={routes.shopContact(offer.shopHandle, offer.offerRef)}>{t("contact.ask")}</ShopLink> : null}{!demo && offer.kind !== "service" ? <CheckoutPrepareLink handle={offer.shopHandle} offerRef={offer.offerRef} /> : null}<OfferShareButton handle={offer.shopHandle} offerRef={offer.offerRef} kind={offer.kind} /></div></div>} />}</ShopFrame>
}
