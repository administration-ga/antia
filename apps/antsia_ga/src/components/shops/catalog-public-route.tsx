import { notFound } from "next/navigation"

import { PublicShell, PUBLIC_LINK } from "@/components/public/public-shell"
import { PublicStatus } from "@/components/public/public-status"
import { buttonClassName } from "@/components/shared/button-class"
import { getAppT } from "@/i18n/server"
import { catalogFilters, catalogSearch } from "@/lib/catalog-search"
import { loadPublicCatalog, loadPublicOffer } from "@/lib/public-catalog-data"
import { publicMetadata, publicSearch } from "@/lib/public-data"
import { loadPublicStorefront } from "@/lib/public-shops-data"
import { decodeRouteSegment } from "@/lib/route-params"
import { routes } from "@/lib/routes"
import { getPublicLocale } from "@/lib/server-session"
import Link from "next/link"
import { CatalogFiltersForm } from "./catalog-filters"
import { CatalogGrid, CatalogPagination } from "./catalog-grid"
import type { CatalogPage } from "./catalog-model"
import { OfferDetails } from "./offer-card"

type Props = { params: Promise<{ handle: string; offerRef?: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }
async function input(props: Props) {
  const params = await props.params
  const search = await props.searchParams ?? {}
  const handle = decodeRouteSegment(params.handle)
  const offerRef = params.offerRef ? decodeRouteSegment(params.offerRef) : null
  return { handle, offerRef, search: catalogSearch(search), handoff: publicSearch(search).handoff }
}

export function PublicCatalogPreview({ page, handle, locale }: { page: CatalogPage; handle: string; locale: "fr" | "en" }) {
  const { t } = getAppT(locale)
  const translate = (key: string, options?: Record<string, unknown>) => t(`shops:${key}`, options)
  return <section aria-labelledby="public-shop-catalog" className="grid gap-4 border-t border-border pt-6"><h2 id="public-shop-catalog" className="text-xl font-semibold">{t("shops:catalog.title")}</h2><CatalogGrid page={page} audience="public" locale={locale} t={translate} />{page.page.length === 0 ? <p className="text-sm text-muted-foreground">{t("shops:catalog.publicConsentHint")}</p> : null}<Link href={routes.publicShopCatalog(handle)} prefetch={false} className={`${PUBLIC_LINK} justify-self-start`}>{t("shops:catalog.openCatalog")}</Link></section>
}

export async function PublicCatalogMetadata(props: Props) {
  const { t } = getAppT(await getPublicLocale())
  const request = await input(props)
  const unavailable = () => publicMetadata(t("shops:catalog.unavailableTitle"), t("shops:catalog.descriptionMeta"), routes.home(), false)
  if (!request.handle || !request.search) return unavailable()
  const shop = await loadPublicStorefront(request.handle, request.handoff)
  if (shop.status !== "ready" || !shop.data) return unavailable()
  const filters = catalogFilters(request.search)
  const catalog = await loadPublicCatalog(request.handle, filters, request.search.cursor, request.handoff)
  if (catalog.status !== "ready") return unavailable()
  return publicMetadata(t("shops:catalog.namedTitle", { name: shop.data.name }), t("shops:catalog.descriptionMeta"), routes.publicShopCatalog(request.handle), !request.search.cursor && Object.keys(filters).length === 0)
}

export async function PublicCatalogScreen(props: Props) {
  const { handle, search, handoff } = await input(props)
  if (!handle || !search) notFound()
  const locale = await getPublicLocale()
  const { t } = getAppT(locale)
  const shop = await loadPublicStorefront(handle, handoff)
  if (shop.status !== "ready") return <PublicShell viewer={shop.status}><PublicStatus status={shop.status} locale={locale} /></PublicShell>
  if (!shop.data) notFound()
  const filters = catalogFilters(search)
  const catalog = await loadPublicCatalog(handle, filters, search.cursor, handoff)
  if (catalog.status !== "ready") return <PublicShell viewer={catalog.status}><PublicStatus status={catalog.status} locale={locale} /></PublicShell>
  const translate = (key: string, options?: Record<string, unknown>) => t(`shops:${key}`, options)
  return <PublicShell viewer={catalog.viewer}><div className="mx-auto grid w-full max-w-3xl gap-5"><header className="grid gap-3"><h1 className="text-3xl font-semibold">{t("shops:catalog.namedTitle", { name: shop.data.name })}</h1><Link href={routes.publicStorefront(handle)} prefetch={false} className={`${PUBLIC_LINK} justify-self-start`}>{t("shops:catalog.backToShop")}</Link></header><CatalogFiltersForm key={JSON.stringify(filters)} handle={handle} filters={filters} collections={catalog.data.collections} audience="public" /><CatalogGrid page={catalog.data} audience="public" locale={locale} t={translate} />{catalog.data.page.length === 0 ? <p className="text-sm text-muted-foreground">{t("shops:catalog.publicConsentHint")}</p> : null}<CatalogPagination page={catalog.data} handle={handle} audience="public" filters={filters} cursor={search.cursor} t={translate} /></div></PublicShell>
}

export async function PublicOfferMetadata(props: Props) {
  const locale = await getPublicLocale()
  const { t } = getAppT(locale)
  const { handle, offerRef, handoff } = await input(props)
  const result = handle && offerRef ? await loadPublicOffer(handle, offerRef, handoff) : null
  if (result?.status !== "ready" || !result.data) return publicMetadata(t("shops:catalog.unavailableTitle"), t("shops:catalog.offerUnavailable"), routes.home(), false)
  return publicMetadata(result.data.title, result.data.description.replace(/\s+/g, " ").slice(0, 180), routes.publicShopOffer(result.data.shopHandle, result.data.offerRef))
}

export async function PublicOfferScreen(props: Props) {
  const { handle, offerRef, handoff } = await input(props)
  if (!handle || !offerRef) notFound()
  const locale = await getPublicLocale()
  const { t } = getAppT(locale)
  const result = await loadPublicOffer(handle, offerRef, handoff)
  if (result.status !== "ready") return <PublicShell viewer={result.status}><PublicStatus status={result.status} locale={locale} /></PublicShell>
  if (!result.data) notFound()
  const contact = { kind: "shop_contact" as const, handle: result.data.shopHandle, offerRef: result.data.offerRef }
  const contactHref = result.viewer === "authenticated" ? routes.shopContact(contact.handle, contact.offerRef) : routes.signIn(undefined, undefined, undefined, contact)
  return <PublicShell viewer={result.viewer}><div className="mx-auto grid w-full max-w-3xl gap-5"><Link href={routes.publicShopCatalog(handle)} prefetch={false} className={`${PUBLIC_LINK} justify-self-start`}>{t("shops:catalog.backToCatalog")}</Link><OfferDetails offer={result.data} audience="public" locale={locale} t={(key, options) => t(`shops:${key}`, options)} actionSlot={result.data.actions.contact ? <Link href={contactHref} prefetch={false} className={buttonClassName("message", "justify-self-start")}>{t("shops:contact.ask")}</Link> : undefined} /></div></PublicShell>
}
