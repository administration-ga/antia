"use client"

import Link from "next/link"
import { useState } from "react"

import type { CatalogOffer, CatalogTranslate } from "./catalog-model"
import { OfferMedia } from "./offer-media"

/**
 * Les photos d'une offre en galerie qui défile, avec ses points (modèle des ventes privées, 22/10/2026). La
 * première case porte le lien principal de la carte, même sans photo ; une photo retenue par la garde reste un
 * repli sans source ni lien. Sans fournisseur ni compte : rendue aussi au serveur (catalogue public).
 */
export function OfferMediaCarousel({ media, title, href, t, eager = false }: { media: CatalogOffer["media"]; title: string; href: string; t: CatalogTranslate; eager?: boolean }) {
  const [active, setActive] = useState(0)
  const slides = media.length ? media : [undefined]
  return <div className="grid min-w-0 gap-2">
    <ul aria-label={t("catalog.offerPhotos")} onScroll={event => { const node = event.currentTarget; setActive(Math.round(node.scrollLeft / Math.max(node.clientWidth, 1))) }} className="flex min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[var(--esp-media-radius)] bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {slides.map((item, index) => {
        const servable = item !== undefined && item.withheld === null && item.url !== null
        const image = <OfferMedia media={item} title={title} t={t} eager={eager && index === 0} className="aspect-square bg-background" />
        return <li key={index} className="w-full shrink-0 snap-start">
          {index === 0 || servable ? <Link href={href} prefetch={false} tabIndex={index === 0 ? undefined : -1} aria-label={index === 0 ? t("catalog.openOfferNamed", { title }) : t("catalog.openOfferPhoto", { title, index: index + 1 })} className="block rounded-[var(--esp-media-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{image}</Link> : image}
        </li>
      })}
    </ul>
    {slides.length > 1 ? <div aria-hidden="true" className="flex justify-center gap-1.5" data-offer-dots>{slides.map((_, index) => <span key={index} className={`size-1.5 rounded-full ${index === active ? "bg-foreground" : "bg-muted-foreground/40"}`} />)}</div> : null}
  </div>
}
