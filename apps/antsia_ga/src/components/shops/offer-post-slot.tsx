"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useTranslation } from "react-i18next"
import { OfferCard } from "./offer-card"

/** Le serveur relit le post, son auteur, sa page et la diffusion de l'offre. */
export function OfferPostSlot({ networkId, postId }: { networkId: Id<"networks">; postId: Id<"posts"> }) {
  const { personId } = useNetwork()
  return <OfferPostQuery key={JSON.stringify([networkId, personId, postId])} networkId={networkId} postId={postId} />
}
function OfferPostQuery({ networkId, postId }: { networkId: Id<"networks">; postId: Id<"posts"> }) {
  const { t, i18n } = useTranslation("shops")
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.postOffer, { networkId, postId })
  if (query.isError) return <p role="status" className="px-4 py-3 text-sm text-muted-foreground">{t("catalog.offerUnavailable")}</p>
  if (query.isPending || !query.data) return null
  return <aside aria-label={t("catalog.attachedOffer")} className="grid min-w-0 gap-2 px-4 pb-4"><p className="text-xs font-semibold text-muted-foreground">{t("catalog.attachedOffer")}</p><OfferCard offer={query.data} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => t(key, options)} compact /></aside>
}
