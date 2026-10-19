import Link from "next/link"

import type { CatalogFilters } from "@/lib/catalog-search"
import { routes } from "@/lib/routes"
import type { CatalogAudience, CatalogPage, CatalogTranslate } from "./catalog-model"
import { OfferCard } from "./offer-card"

export function CatalogGrid({ page, audience, locale, t }: { page: CatalogPage; audience: CatalogAudience; locale: string; t: CatalogTranslate }) {
  return page.page.length ? <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">{page.page.map((offer) => <li key={offer.offerRef} className="min-w-0"><OfferCard offer={offer} audience={audience} locale={locale} t={t} /></li>)}</ul> : <p role="status" className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">{t(page.filteredWindow || !page.isDone ? "catalog.filteredWindow" : "catalog.empty")}</p>
}

export function CatalogPagination({ page, handle, audience, filters, cursor, t }: { page: CatalogPage; handle: string; audience: CatalogAudience; filters: CatalogFilters; cursor: string | null; t: CatalogTranslate }) {
  const href = (next?: string) => audience === "public" ? routes.publicShopCatalog(handle, filters, next) : routes.shopCatalog(handle, filters, next)
  const linkClass = "inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return cursor || (!page.isDone && page.continueCursor) ? <nav aria-label={t("catalog.pagination")} className="flex flex-wrap justify-between gap-3">{cursor ? <Link href={href()} prefetch={false} className={linkClass}>{t("catalog.firstPage")}</Link> : <span />}{!page.isDone && page.continueCursor && page.continueCursor !== cursor ? <Link href={href(page.continueCursor)} prefetch={false} className={linkClass}>{t("catalog.nextPage")}</Link> : null}</nav> : null
}
