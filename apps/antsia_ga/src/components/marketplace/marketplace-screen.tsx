"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useId, useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

import { MemberPage } from "@/components/member-chrome"
import { Button } from "@/components/shared/controls"
import { DirectoryCard } from "@/components/shops/member-shop-directory"
import { OfferCard } from "@/components/shops/offer-card"
import { SHOP_ACTION_CLASS } from "@/components/shops/offer-experience-styles"
import { MARKETPLACE_FACETS, MARKETPLACE_PAGE_SIZE, marketplaceSearchParams, marketplaceSearchFromParams, type MarketplaceSearch } from "@/lib/marketplace-search"
import { routes } from "@/lib/routes"
import { MarketplaceFilters } from "./marketplace-filters"

const gridClass = "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
const wideQuery = "(min-width: 1024px)"
function subscribeWidth(callback: () => void) {
  const media = window.matchMedia(wideQuery)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}
const wideSnapshot = () => window.matchMedia(wideQuery).matches

export function MarketplaceScreen({ search }: { search: MarketplaceSearch | null }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("marketplace")
  return <MemberPage><Suspense fallback={<p role="status">{t("results.loading")}</p>}><MarketplaceContent key={JSON.stringify([networkId, personId])} search={search} /></Suspense></MemberPage>
}

function MarketplaceContent({ search: initialSearch }: { search: MarketplaceSearch | null }) {
  const params = useSearchParams()
  const search = params === null ? initialSearch : marketplaceSearchFromParams(params)
  const { t } = useTranslation("marketplace")
  const { networkId, personId } = useNetwork()
  const heading = useRef<HTMLHeadingElement>(null)
  const router = useRouter()
  const apply = (next: MarketplaceSearch) => { router.push(routes.marketplace(next), { scroll: false }); heading.current?.focus() }
  return <div className="antsia-page mx-auto w-full min-w-0 max-w-7xl [overflow-wrap:anywhere]" data-marketplace>
    <header className="antsia-page-header min-w-0"><h1 ref={heading} tabIndex={-1} className="antsia-title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("lead")}</p><div className="flex min-w-0 flex-wrap gap-2"><Link href={routes.myShops()} className={SHOP_ACTION_CLASS}>{t("manageActivity")}</Link><Link href={routes.cart()} className={SHOP_ACTION_CLASS}>{t("carts")}</Link></div></header>
    {search ? <>
      <nav aria-label={t("views.label")} className="flex min-w-0 flex-wrap gap-2">{(["products", "shops", "services"] as const).map(view => <Link key={view} href={routes.marketplace(view === search.view ? search : { view, ...(search.query ? { query: search.query } : {}), cursor: null })} prefetch={false} aria-current={view === search.view ? "page" : undefined} className={`${SHOP_ACTION_CLASS} aria-[current=page]:border-primary aria-[current=page]:bg-muted`}>{t(`views.${view}`)}</Link>)}</nav>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <FilterPanel key={marketplaceSearchParams(search).toString()} search={search} onApply={apply} />
        <section className="grid min-w-0 gap-6" aria-label={t("results.title")}><AppliedFilters search={search} onApply={apply} /><MarketplaceWindow key={JSON.stringify(["catalog", networkId, personId, search])} search={search} />{search.view !== "shops" ? <DemoSelection key={JSON.stringify(["demo", networkId, personId, { ...search, cursor: null }])} search={search} /> : null}</section>
      </div>
    </> : <div role="alert" className="grid gap-3"><p>{t("results.invalid")}</p><Link href={routes.marketplace()} prefetch={false} className={`${SHOP_ACTION_CLASS} justify-self-start`}>{t("results.restart")}</Link></div>}
  </div>
}

function AppliedFilters({ search, onApply }: { search: MarketplaceSearch; onApply: (search: MarketplaceSearch) => void }) {
  const { t } = useTranslation("marketplace")
  const { t: shopT } = useTranslation("shops")
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (search.query) chips.push({ key: "query", label: search.query, remove: () => onApply({ ...search, query: undefined, sort: search.sort === "relevance" ? undefined : search.sort, cursor: null }) })
  for (const facet of MARKETPLACE_FACETS) for (const value of search[facet] ?? []) {
    const label = facet === "category" ? shopT(`catalog.facets.categories.${value}.label`) : facet === "audience" || facet === "serviceMode" ? shopT(`catalog.facets.choices.${facet}.${value}`) : facet === "commercialMode" ? t(`commercialModes.${value}`) : value
    chips.push({ key: `${facet}:${value}`, label, remove: () => onApply({ ...search, [facet]: search[facet]?.filter(current => current !== value), cursor: null }) })
  }
  for (const field of ["minPrice", "maxPrice", "minDurationMinutes", "maxDurationMinutes"] as const) if (search[field] !== undefined) chips.push({ key: field, label: `${t(`filters.${field}`)} : ${search[field]}`, remove: () => onApply({ ...search, [field]: undefined, cursor: null }) })
  if (!chips.length) return null
  return <ul aria-label={t("filters.active")} className="flex min-w-0 flex-wrap gap-2">{chips.map(chip => <li key={chip.key} className="min-w-0"><button type="button" className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-muted px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("filters.remove", { value: chip.label })} onClick={chip.remove}><span className="break-words">{chip.label}</span><span aria-hidden>×</span></button></li>)}</ul>
}

function FilterPanel({ search, onApply }: { search: MarketplaceSearch; onApply: (search: MarketplaceSearch) => void }) {
  const { t } = useTranslation("marketplace")
  const wide = useSyncExternalStore(subscribeWidth, wideSnapshot, () => false)
  const [expanded, setExpanded] = useState(false)
  return <aside aria-label={t("filters.title")} className="min-w-0 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] text-card-foreground"><details open={wide || expanded} onToggle={event => { if (!wide) setExpanded(event.currentTarget.open) }} data-marketplace-filter-panel><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">{t("filters.open")}</summary><div className="min-w-0 pt-3 lg:pt-0"><MarketplaceFilters search={search} onApply={onApply} /></div></details></aside>
}

function QueryFailure({ retry, pending }: { retry: () => void; pending: boolean }) {
  const { t } = useTranslation("marketplace")
  return <div role="alert" className="grid min-w-0 gap-3"><p>{t("results.failed")}</p><Button variant="outline" className="justify-self-start" pending={pending} onClick={retry}>{t("results.retry")}</Button></div>
}

function MarketplaceWindow({ search }: { search: MarketplaceSearch }) {
  return search.view === "shops" ? <ShopWindow search={search} /> : <OfferWindow search={search} />
}

function offerFilters(search: MarketplaceSearch) {
  return {
    kind: search.view === "services" ? "service" as const : "product" as const,
    ...(search.query !== undefined ? { query: search.query } : {}),
    ...(search.category !== undefined ? { category: search.category } : {}),
    ...(search.brand !== undefined ? { brand: search.brand } : {}),
    ...(search.material !== undefined ? { material: search.material } : {}),
    ...(search.color !== undefined ? { color: search.color } : {}),
    ...(search.audience !== undefined ? { audience: search.audience } : {}),
    ...(search.serviceMode !== undefined ? { serviceMode: search.serviceMode } : {}),
    ...(search.commercialMode !== undefined ? { commercialMode: search.commercialMode } : {}),
    ...(search.languageCode !== undefined ? { languageCode: search.languageCode } : {}),
    ...(search.serviceZone !== undefined ? { serviceZone: search.serviceZone } : {}),
    ...(search.minDurationMinutes !== undefined ? { minDurationMinutes: search.minDurationMinutes } : {}),
    ...(search.maxDurationMinutes !== undefined ? { maxDurationMinutes: search.maxDurationMinutes } : {}),
    ...(search.minPrice !== undefined ? { minPrice: search.minPrice } : {}),
    ...(search.maxPrice !== undefined ? { maxPrice: search.maxPrice } : {}),
    ...(search.sort !== undefined ? { sort: search.sort } : {}),
  }
}

function OfferWindow({ search }: { search: MarketplaceSearch }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("marketplace")
  const { t: shopT, i18n } = useTranslation("shops")
  const query = useAuthenticatedConvexQuery(api.modules.shops.marketplace.search, { networkId, ...offerFilters(search), paginationOpts: { cursor: search.cursor, numItems: MARKETPLACE_PAGE_SIZE } })
  if (query.isError) return <QueryFailure pending={query.isFetching} retry={() => { void query.refetch() }} />
  if (query.isPending || !query.data) return <p role="status">{t("results.loading")}</p>
  const result = query.data
  if (result.indexStatus !== "ready") return <div className="grid gap-3"><p role="status">{t("results.building")}</p><Button variant="outline" className="justify-self-start" pending={query.isFetching} onClick={() => { void query.refetch() }}>{t("results.retry")}</Button></div>
  return <div className="grid min-w-0 gap-4" aria-busy={query.isFetching || undefined}>
    {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">{t("results.refreshing")}</p> : null}
    {result.page.length ? <ul className={gridClass}>{result.page.map((offer, index) => <li key={offer.offerRef} className="min-w-0"><OfferCard offer={offer} eager={index === 0} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => shopT(key, options)} /></li>)}</ul> : <p role="status">{t(result.isDone ? "results.empty" : "results.window")}</p>}
    {result.filteredWindow ? <p className="text-sm text-muted-foreground">{t("results.filtered")}</p> : null}
    <MarketplacePagination search={search} isDone={result.isDone} cursor={result.continueCursor} />
  </div>
}

function ShopWindow({ search }: { search: MarketplaceSearch }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("marketplace")
  const query = useAuthenticatedConvexQuery(api.modules.shops.marketplaceShops.search, { networkId, ...(search.query ? { query: search.query } : {}), paginationOpts: { cursor: search.cursor, numItems: MARKETPLACE_PAGE_SIZE } })
  if (query.isError) return <QueryFailure pending={query.isFetching} retry={() => { void query.refetch() }} />
  if (query.isPending || !query.data) return <p role="status">{t("results.loading")}</p>
  const result = query.data
  return <div className="grid min-w-0 gap-4" aria-busy={query.isFetching || undefined}>
    {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">{t("results.refreshing")}</p> : null}
    {result.page.length ? <ul className={gridClass}>{result.page.map(storefront => <li key={storefront.handle} className="min-w-0"><DirectoryCard storefront={storefront} /></li>)}</ul> : <p role="status">{t(result.isDone ? "results.empty" : "results.window")}</p>}
    {result.filteredWindow ? <p className="text-sm text-muted-foreground">{t("results.filtered")}</p> : null}
    <MarketplacePagination search={search} isDone={result.isDone} cursor={result.continueCursor} />
  </div>
}

function MarketplacePagination({ search, isDone, cursor }: { search: MarketplaceSearch; isDone: boolean; cursor: string }) {
  const { t } = useTranslation("marketplace")
  if (search.cursor === null && (isDone || !cursor)) return null
  return <nav aria-label={t("results.pagination")} className="flex min-w-0 flex-wrap items-center justify-between gap-3">{search.cursor ? <Link href={routes.marketplace({ ...search, cursor: null })} prefetch={false} className={SHOP_ACTION_CLASS}>{t("results.first")}</Link> : <span />}{!isDone && cursor ? <Link href={routes.marketplace({ ...search, cursor })} prefetch={false} className={SHOP_ACTION_CLASS}>{t("results.next")}</Link> : null}</nav>
}

function DemoSelection({ search }: { search: MarketplaceSearch }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("marketplace")
  const { t: shopT, i18n } = useTranslation("shops")
  const id = useId()
  const query = useAuthenticatedConvexQuery(api.modules.shops.marketplace.demoSelection, { networkId, ...offerFilters(search) })
  if (!query.isError && !query.isPending && query.data?.length === 0) return null
  return <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-border pt-6" data-marketplace-demo><h2 id={id} className="antsia-subtitle">{t("demo.title")}</h2><p className="text-sm text-muted-foreground">{t("demo.notice")}</p>{query.isError ? <p role="status">{t("demo.unavailable")}</p> : query.isPending || !query.data ? <p role="status">{t("demo.loading")}</p> : <ul className={gridClass}>{query.data.map((offer, index) => <li key={offer.offerRef} className="min-w-0"><OfferCard offer={offer} eager={index === 0} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => shopT(key, options)} /></li>)}</ul>}</section>
}
