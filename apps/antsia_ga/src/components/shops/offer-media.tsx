import { ImageOff } from "lucide-react"
import Image from "next/image"

import { browserAppPath } from "@/lib/app-path"
import type { CatalogOffer, CatalogTranslate } from "./catalog-model"

/**
 * Une photo d'offre admise par la garde, ou son repli (aucune photo, photo retenue) : jamais de source inventée.
 * `fit` : `contain` (défaut) montre la photo entière, jamais rognée ; `cover` remplit le cadre. Le fond (`className`)
 * comble les bords d'une photo entière.
 */
export function OfferMedia({ media, title, t, className = "aspect-square bg-muted", eager = false, fit = "contain" }: { media: CatalogOffer["media"][number] | undefined; title: string; t: CatalogTranslate; className?: string; eager?: boolean; fit?: "contain" | "cover" }) {
  // Le repli garde son fond neutre : seul le cadre (rapport, coins) vient de l'appelant.
  if (!media || media.withheld !== null || !media.url) return <div className={`flex flex-col items-center justify-center gap-2 rounded-[var(--esp-media-radius)] bg-muted p-4 text-center text-sm text-muted-foreground ${className.split(" ").filter(token => !token.startsWith("bg-")).join(" ")}`} role="img" aria-label={t(media?.withheld ? "catalog.mediaWithheld" : "catalog.noPhoto")}><ImageOff className="size-6" aria-hidden /><span>{t(media?.withheld ? "catalog.mediaWithheld" : "catalog.noPhoto")}</span></div>
  return <Image unoptimized src={media.url.startsWith("/") && !media.url.startsWith("//") ? browserAppPath(media.url) : media.url} alt={media.altText ?? title} width={media.width ?? 800} height={media.height ?? 800} loading={eager ? "eager" : "lazy"} className={`w-full rounded-[var(--esp-media-radius)] ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`} />
}
