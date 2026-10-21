import { browserAppPath } from "@/lib/app-path"
import { ArrowUpRight, ImageOff, Store } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { routes } from "@/lib/routes"
import { catalogAvailability, catalogDate, catalogPrice, catalogVariantPrice, type CatalogAudience, type CatalogOffer, type CatalogTranslate } from "./catalog-model"

import { OFFER_CARD_CSS, SHOP_ACTION_CLASS } from "./offer-experience-styles"

const linkClass = "inline-flex min-h-11 items-center rounded-[var(--esp-social-action-radius,var(--ui2-button-radius))] text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function OfferMedia({ media, title, t, className = "aspect-square" }: { media: CatalogOffer["media"][number] | undefined; title: string; t: CatalogTranslate; className?: string }) {
  if (!media || media.withheld !== null || !media.url) return <div className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground ${className}`} role="img" aria-label={t(media?.withheld ? "catalog.mediaWithheld" : "catalog.noPhoto")}><ImageOff className="size-6" aria-hidden /><span>{t(media?.withheld ? "catalog.mediaWithheld" : "catalog.noPhoto")}</span></div>
  return <Image unoptimized src={media.url.startsWith("/") && !media.url.startsWith("//") ? browserAppPath(media.url) : media.url} alt={media.altText ?? title} width={media.width ?? 800} height={media.height ?? 800} loading="lazy" className={`w-full rounded-xl bg-muted object-contain ${className}`} />
}

/** Présentation commune SSR/membre : aucun hook ni fournisseur de compte requis. */
export function OfferCard({ offer, audience, locale, t, compact = false }: { offer: CatalogOffer; audience: CatalogAudience; locale: string; t: CatalogTranslate; compact?: boolean }) {
  const href = audience === "public" ? routes.publicShopOffer(offer.shopHandle, offer.offerRef) : routes.shopOffer(offer.shopHandle, offer.offerRef)
  const storefront = audience === "public" ? routes.publicStorefront(offer.shopHandle) : routes.storefront(offer.shopHandle)
  return <article data-offer-card data-offer-compact={compact || undefined} className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
    <style>{OFFER_CARD_CSS}</style>
    <Link href={href} prefetch={false} className="block min-w-0 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={t("catalog.openOfferNamed", { title: offer.title })}><OfferMedia media={offer.media[0]} title={offer.title} t={t} className={compact ? "aspect-[16/10]" : "aspect-[4/3]"} /></Link>
    {offer.media.length > 1 ? <ul aria-label={t("catalog.offerPhotos")} className="flex min-w-0 snap-x gap-2 overflow-x-auto overscroll-x-contain px-2 pb-2">{offer.media.slice(1).map((media, index) => <li key={index} className="w-24 shrink-0 snap-start"><Link href={href} prefetch={false} aria-label={t("catalog.openOfferPhoto", { title: offer.title, index: index + 2 })} className="block min-h-11 rounded-[var(--esp-media-radius)] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><OfferMedia media={media} title={offer.title} t={t} /></Link></li>)}</ul> : null}
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Link href={storefront} prefetch={false} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Store className="size-4 shrink-0 text-[color:var(--role-commerce-ink,var(--primary))]" aria-hidden /><span className="break-words">{t("catalog.soldBy", { handle: offer.shopHandle })}</span></Link>
        <span className="rounded-[var(--esp-social-action-radius,var(--ui2-button-radius))] bg-muted px-2 py-1 text-xs font-semibold">{t(`catalog.kinds.${offer.kind}`)}</span>
      </div>
      <div className="grid min-w-0 gap-2">
        <p className="break-words text-lg font-semibold text-[color:var(--role-commerce-ink,var(--foreground))]">{catalogPrice(offer.price, locale, t)}</p>
        {offer.variants.length ? <p className="text-xs text-muted-foreground">{t("catalog.hasVariants", { count: offer.variants.length })}</p> : null}
        <p className="text-xs font-medium text-muted-foreground">{t("catalog.availability.title")}</p>
        <p className="text-sm text-muted-foreground">{catalogAvailability(offer.availability, t)}</p>
        {offer.availability.updatedAt !== null ? <p className="text-xs text-muted-foreground">{t("catalog.availability.updated", { date: catalogDate(offer.availability.updatedAt, locale) })}</p> : null}
      </div>
    </div>
    <div className="offer-card-band mt-auto border-t border-border bg-muted p-4">
      <div className="grid min-w-0 gap-1">
        <h3 className="break-words font-semibold"><Link href={href} prefetch={false} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{offer.title}</Link></h3>
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{offer.description || t("catalog.noDescription")}</p>
      </div>
      <Link href={href} prefetch={false} className={`${SHOP_ACTION_CLASS} offer-card-action`}>{t("catalog.openOffer")}<ArrowUpRight className="size-4 shrink-0" aria-hidden /></Link>
    </div>
  </article>
}

/** Toutes les variantes actives restent dans le HTML, avec leur montant exact. */
export function OfferDetails({ offer, audience, locale, t, actionSlot }: { offer: CatalogOffer; audience: CatalogAudience; locale: string; t: CatalogTranslate; actionSlot?: ReactNode }) {
  const storefront = audience === "public" ? routes.publicStorefront(offer.shopHandle) : routes.storefront(offer.shopHandle)
  const Heading = audience === "public" ? "h1" : "h2"
  return <article className="grid gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-7">
    <header className="grid gap-3">
      <p className="text-sm font-medium text-muted-foreground">{t(`catalog.kinds.${offer.kind}`)}</p>
      <Heading className="break-words text-3xl font-semibold tracking-tight">{offer.title}</Heading>
      <Link href={storefront} prefetch={false} className={`${linkClass} justify-self-start`}>{t("catalog.soldBy", { handle: offer.shopHandle })}</Link>
      <p className="break-words text-2xl font-semibold">{catalogPrice(offer.price, locale, t)}</p>
      <p className="text-sm text-muted-foreground">{t("catalog.displayedPriceHint")}</p>
      {actionSlot}
    </header>
    <div className="grid gap-3 sm:grid-cols-2">{offer.media.length ? offer.media.map((media, index) => <OfferMedia key={index} media={media} title={offer.title} t={t} />) : <OfferMedia media={undefined} title={offer.title} t={t} />}</div>
    <section className="grid gap-3"><h2 className="text-lg font-semibold">{t("catalog.description")}</h2><p className="whitespace-pre-wrap break-words leading-relaxed">{offer.description || t("catalog.noDescription")}</p></section>
    {offer.variants.length ? <details className="rounded-xl border border-border p-4" open={offer.variants.length <= 6}><summary className="min-h-11 cursor-pointer font-semibold">{t("catalog.variants", { count: offer.variants.length })}</summary><ul className="mt-3 grid gap-3 sm:grid-cols-2">{offer.variants.map((variant) => <li key={variant.variantRef} className="grid gap-1 rounded-lg bg-background p-3"><h3 className="break-words font-medium">{variant.label}</h3>{variant.options.length ? <p className="break-words text-sm text-muted-foreground">{variant.options.map((option, index) => offer.variantAxes[index] ? `${offer.variantAxes[index]} : ${option}` : option).join(" · ")}</p> : null}<p className="font-semibold">{catalogVariantPrice(offer.price, variant, locale, t)}</p><p className="text-xs text-muted-foreground">{catalogAvailability(offer.availability, t, variant.availability)}</p></li>)}</ul></details> : null}
    <section className="grid gap-3 rounded-xl bg-background p-4"><h2 className="font-semibold">{t("catalog.availability.title")}</h2><p>{catalogAvailability(offer.availability, t)}</p><p className="text-sm text-muted-foreground">{t("catalog.availability.indicative")}</p>{offer.availability.updatedAt !== null ? <p className="text-xs text-muted-foreground">{t("catalog.availability.updated", { date: catalogDate(offer.availability.updatedAt, locale) })}</p> : null}</section>
    {offer.zone || offer.leadTimeDays !== null || offer.collections.length ? <dl className="grid gap-4 sm:grid-cols-2">{offer.zone ? <div><dt className="text-sm font-medium text-muted-foreground">{t("catalog.zone")}</dt><dd className="break-words">{offer.zone}</dd></div> : null}{offer.leadTimeDays !== null ? <div><dt className="text-sm font-medium text-muted-foreground">{t("catalog.leadTime")}</dt><dd>{t("catalog.leadTimeDays", { count: offer.leadTimeDays })}</dd></div> : null}{offer.collections.length ? <div><dt className="text-sm font-medium text-muted-foreground">{t("catalog.collections")}</dt><dd className="break-words">{offer.collections.map((collection) => collection.label).join(" · ")}</dd></div> : null}</dl> : null}
    <p className="text-xs text-muted-foreground">{t("catalog.updated", { date: catalogDate(offer.changedAt, locale) })}</p>
  </article>
}
