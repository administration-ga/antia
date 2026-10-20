import Link from "next/link"

import type { CatalogFilters } from "@/lib/catalog-search"
import { routes } from "@/lib/routes"
import { buttonClassName } from "@/components/shared/button-class"
import type { CatalogAudience, CatalogPage, CatalogTranslate } from "./catalog-model"
import { OfferCard } from "./offer-card"

export function CatalogGrid({ page, audience, locale, t }: { page: CatalogPage; audience: CatalogAudience; locale: string; t: CatalogTranslate }) {
  return page.page.length ? <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{page.page.map((offer) => <li key={offer.offerRef} className="min-w-0"><OfferCard offer={offer} audience={audience} locale={locale} t={t} /></li>)}</ul> : <p role="status" className="rounded-[var(--ui2-card-radius)] border border-dashed border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] text-sm text-muted-foreground">{t(page.filteredWindow || !page.isDone ? "catalog.filteredWindow" : "catalog.empty")}</p>
}

export function CatalogPagination({ page, handle, audience, filters, cursor, t }: { page: CatalogPage; handle: string; audience: CatalogAudience; filters: CatalogFilters; cursor: string | null; t: CatalogTranslate }) {
  const href = (next?: string) => audience === "public" ? routes.publicShopCatalog(handle, filters, next) : routes.shopCatalog(handle, filters, next)
  const linkClass = buttonClassName("outline")
  return cursor || (!page.isDone && page.continueCursor) ? <nav aria-label={t("catalog.pagination")} className="flex flex-wrap justify-between gap-3">{cursor ? <Link href={href()} prefetch={false} className={linkClass}>{t("catalog.firstPage")}</Link> : <span />}{!page.isDone && page.continueCursor && page.continueCursor !== cursor ? <Link href={href(page.continueCursor)} prefetch={false} className={linkClass}>{t("catalog.nextPage")}</Link> : null}</nav> : null
}
