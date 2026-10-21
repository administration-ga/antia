"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import Link from "next/link"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shared/controls"
import { routes } from "@/lib/routes"

const PAGE_SHOPS = 8

/** L'onglet « Services » n'existe que si le moteur confirme au moins une vraie offre de service publiée. */
export function useServicesDiscoverable(): boolean {
  const { networkId } = useNetwork()
  const query = useAuthenticatedConvexQuery(api.modules.shops.services.discoverAvailability, { networkId })
  return query.data?.available === true
}

/**
 * Rubrique Services de Découvrir : offres de SERVICE publiées et consenties (projection P09),
 * vitrine par vitrine. Rien n'est rendu tant qu'aucune offre réelle n'existe.
 */
export function MemberServiceDirectory() {
  const { networkId, personId } = useNetwork()
  const available = useServicesDiscoverable()
  if (!available) return null
  return <ServiceWindows key={`${networkId}:${personId}`} />
}

function ServiceWindows() {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const titleId = useId()
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const query = useAuthenticatedConvexQuery(api.modules.shops.services.discoverServices, { networkId, paginationOpts: { cursor: cursors.at(-1) ?? null, numItems: PAGE_SHOPS } })
  const result = query.data
  return <section id="services" aria-labelledby={titleId} className="scroll-mt-24 flex flex-col gap-4">
    <div className="flex flex-col gap-2"><h2 id={titleId} className="antsia-subtitle">{t("discover.title")}</h2><p className="text-sm text-muted-foreground">{t("discover.lead")}</p></div>
    {query.isError ? <p role="alert" className="text-sm">{t("discover.unavailable")}</p> : !result ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : <>
      {result.page.length ? <ul className="grid gap-3 sm:grid-cols-2">{result.page.map((offer) => <li key={`${offer.shopHandle}:${offer.offerRef}`} className="min-w-0">
        <Link href={routes.shopOffer(offer.shopHandle, offer.offerRef)} className="flex min-h-11 flex-col gap-1 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] text-card-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="break-words font-semibold">{offer.title}</span>
          {offer.zone ? <span className="text-sm text-muted-foreground">{offer.zone}</span> : null}
          <span className="text-xs text-muted-foreground">{t("discover.byShop", { handle: offer.shopHandle })}</span>
        </Link>
      </li>)}</ul> : <p role="status" className="rounded-[var(--ui2-card-radius)] border border-dashed border-border p-[var(--esp-card-padding,16px)] text-sm text-muted-foreground">{t("discover.filteredWindow")}</p>}
      {cursors.length > 1 || (!result.isDone && result.continueCursor) ? <nav aria-label={t("discover.title")} className="flex flex-wrap gap-3">
        {cursors.length > 1 ? <Button variant="outline" onClick={() => setCursors((items) => items.slice(0, -1))}>{t("common.previous")}</Button> : null}
        {!result.isDone && result.continueCursor ? <Button variant="outline" onClick={() => setCursors((items) => [...items, result.continueCursor])}>{t("common.next")}</Button> : null}
      </nav> : null}
    </>}
  </section>
}
