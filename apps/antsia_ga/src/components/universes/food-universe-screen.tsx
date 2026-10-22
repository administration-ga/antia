"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import Link from "next/link"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { OfferCards, SHOWCASE_GRID } from "@/components/marketplace/marketplace-home"
import { ShopShowcaseCard, type ShowcaseStorefront } from "@/components/marketplace/shop-showcase-card"
import { Button } from "@/components/shared/controls"
import { SHOP_ACTION_CLASS } from "@/components/shops/offer-experience-styles"
import { MARKETPLACE_PAGE_SIZE } from "@/lib/marketplace-search"
import { routes } from "@/lib/routes"

/** Les vitrines de l'univers : celles dont le gabarit d'activité est « Alimentation et restauration ». */
export function foodStorefronts(page: readonly ShowcaseStorefront[]): ShowcaseStorefront[] {
  return page.filter(storefront => storefront.template === "food")
}

/**
 * Les vitrines de l'univers, lues dans la même fenêtre que l'accueil de la marketplace : l'univers n'existe pour
 * Découvrir que lorsqu'il compte au moins une adresse (aucune tuile vide, ADR-0034).
 */
export function useFoodStorefronts() {
  const { networkId } = useNetwork()
  const query = useAuthenticatedConvexQuery(api.modules.shops.marketplaceShops.search, { networkId, paginationOpts: { cursor: null, numItems: MARKETPLACE_PAGE_SIZE } })
  return { query, storefronts: query.data ? foodStorefronts(query.data.page) : [] }
}

/**
 * L'univers « Alimentation et restauration » (étude des sept univers, § 5.4) : restaurants, traiteurs et épiceries,
 * séparés de la mode. Ses adresses en grandes cartes, puis ce qu'on y commande ; la commande passe par le panier de
 * la boutique et « Demander la préparation », sans paiement en ligne : on règle à la remise. Les offres de la
 * démonstration restent à part, avec leur mention.
 */
export function FoodUniverseScreen() {
  const { t } = useTranslation("marketplace")
  const { networkId } = useNetwork()
  const titleId = useId()
  const shopsId = useId()
  const { query, storefronts } = useFoodStorefronts()
  const handles = new Set(storefronts.map(storefront => storefront.handle))
  const indexed = useAuthenticatedConvexQuery(api.modules.shops.marketplace.search, { networkId, kind: "product", category: ["food"], paginationOpts: { cursor: null, numItems: MARKETPLACE_PAGE_SIZE } })
  const demo = useAuthenticatedConvexQuery(api.modules.shops.marketplace.demoSelection, { networkId, kind: "product" })
  const offers = indexed.data?.indexStatus === "ready" ? indexed.data.page : []
  const demoOffers = (demo.data ?? []).filter(offer => handles.has(offer.shopHandle))
  return <div className="@container grid w-full min-w-0 gap-8 pb-24 [overflow-wrap:anywhere]" data-universe="food">
    <header className="grid min-w-0 gap-2" aria-labelledby={titleId}>
      <h1 id={titleId} className="text-2xl font-semibold tracking-tight">{t("food.title")}</h1>
      <p className="text-base text-muted-foreground">{t("food.lead")}</p>
      <Link href={routes.marketplaceHome()} prefetch={false} className={`${SHOP_ACTION_CLASS} justify-self-start`}>{t("food.allMarketplace")}</Link>
    </header>
    {query.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t("home.sectionFailed")}</p><Button variant="outline" pending={query.isFetching} onClick={() => { void query.refetch() }}>{t("food.retry")}</Button></div>
      : query.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("results.loading")}</p>
      : storefronts.length === 0 ? <div className="grid justify-items-start gap-3 rounded-[var(--ui2-card-radius)] bg-card p-4"><p role="status" className="text-sm text-muted-foreground">{t("food.empty")}</p><Link href={routes.myShops()} prefetch={false} className={SHOP_ACTION_CLASS}>{t("food.openActivity")}</Link></div>
      : <section aria-labelledby={shopsId} className="grid min-w-0 gap-3" data-universe-shops>
        <h2 id={shopsId} className="mp-subtitle">{t("food.shops")}</h2>
        <ul className={SHOWCASE_GRID}>{storefronts.map((storefront, index) => <li key={storefront.handle} className="min-w-0"><ShopShowcaseCard storefront={storefront} eager={index < 2} /></li>)}</ul>
      </section>}
    {offers.length ? <OfferCards title={t("food.offers")} offers={offers} /> : null}
    {demoOffers.length ? <section className="grid min-w-0 gap-2" data-universe-demo>
      <p className="text-sm text-muted-foreground">{t("demo.notice")}</p>
      <OfferCards title={t("food.demoOffers")} offers={demoOffers} />
    </section> : null}
  </div>
}
