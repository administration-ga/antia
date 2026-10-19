"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useTranslation } from "react-i18next"
import { ShopLink } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"

/** Entrée membre seulement ; une readiness locale ne confirme ni prix ni stock PRO.GA. */
export function CheckoutPrepareLink({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("checkout")
  const query = useAuthenticatedConvexQuery(api.modules.shops.checkout.context, { networkId, handle, offerRef })
  if (query.isError || query.isPending || !query.data?.available || !query.data.offer) return null
  if (query.data.pending) return <ShopLink href={routes.checkoutAttempt(query.data.pending.attemptId)}>{t("openAttempt")}</ShopLink>
  const offer = query.data.offer
  if (!offer.variants.length && offer.price.mode !== "fixed" && offer.price.mode !== "unit") return null
  return <ShopLink href={routes.checkoutPrepare(handle, offerRef)}>{t("title")}</ShopLink>
}
