"use client"

import { api } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import type { ServiceOptionsResult } from "@convex/modules/shops/serviceRules"
import { useAction } from "convex/react"
import { CalendarClock, FileText, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, buttonClassName } from "@/components/shared/controls"
import { ShopLink, useShopAction } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"
import { serviceAmount } from "./service-model"

// Devis, créneau, prestation : couleur du commerce (ADR-0027), sur la facture commune des boutons.
const ACTION_LINK = buttonClassName("commerce")

/**
 * Les parcours d'une offre de SERVICE, tels que PRO.GA les sert pour cette personne : devis,
 * créneau, prestation à tarif fixe. Aucun bouton n'est montré sans réponse corrélée ; aucun
 * paiement ni acompte n'est proposé.
 */
export function ServiceOfferActions({ offer }: { offer: CatalogOffer }) {
  const { networkId, personId } = useNetwork()
  return <ServiceOfferOptions key={JSON.stringify([networkId, personId, offer.shopHandle, offer.offerRef, offer.revision])} offer={offer} />
}

function ServiceOfferOptions({ offer }: { offer: CatalogOffer }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("services")
  const load = useAction(api.modules.shops.serviceActions.options)
  const action = useShopAction()
  const { run } = action
  const [options, setOptions] = useState<ServiceOptionsResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    void run(() => load({ networkId, handle: offer.shopHandle, offerRef: offer.offerRef }), setOptions)
  }, [attempt, load, networkId, offer.offerRef, offer.shopHandle, run])
  const locale = i18n.resolvedLanguage ?? "fr"
  if (!options && !action.error) return <p role="status" className="text-sm text-muted-foreground">{t("offer.loading")}</p>
  if (!options || options.outcome !== "ready") {
    return <div className="grid gap-2" role="status">
      <p className="text-sm text-muted-foreground">{t(options?.outcome === "refused" ? "offer.closed" : "offer.unavailable")}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" pending={action.pending} onClick={() => setAttempt((value) => value + 1)}>{t("offer.retry")}</Button><ShopLink href={routes.serviceRequests()}>{t("requests.title")}</ShopLink></div>
    </div>
  }
  const modes = [options.quote.available, options.booking !== null, options.fixedOrder !== null].filter(Boolean).length
  return <section aria-label={t("offer.title")} className="grid w-full gap-3 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-background p-[var(--esp-card-padding,16px)]">
    <h2 className="antsia-subtitle">{t("offer.title")}</h2>
    {modes === 0 ? <p className="text-sm text-muted-foreground">{t("offer.none")}</p> : <div className="flex flex-wrap gap-3">
      {options.quote.available ? <Link className={ACTION_LINK} href={routes.serviceQuote(offer.shopHandle, offer.offerRef)}><FileText aria-hidden="true" className="size-4" />{t("offer.quote")}</Link> : null}
      {options.booking ? <Link className={ACTION_LINK} href={routes.serviceBooking(offer.shopHandle, offer.offerRef)}><CalendarClock aria-hidden="true" className="size-4" />{t("offer.booking")}</Link> : null}
      {options.fixedOrder ? <Link className={ACTION_LINK} href={routes.serviceOrder(offer.shopHandle, offer.offerRef)}><ShoppingBag aria-hidden="true" className="size-4" />{t("offer.order")}</Link> : null}
    </div>}
    {options.fixedOrder ? <p className="text-sm">{options.fixedOrder.unit ? t("offer.fixedPriceUnit", { amount: serviceAmount(options.fixedOrder.unitAmount.amount, locale), unit: options.fixedOrder.unit }) : t("offer.fixedPrice", { amount: serviceAmount(options.fixedOrder.unitAmount.amount, locale) })}</p> : null}
    <p className="text-xs text-muted-foreground">{t("offer.noPayment")}</p>
    <ShopLink href={routes.serviceRequests()}>{t("requests.title")}</ShopLink>
  </section>
}
