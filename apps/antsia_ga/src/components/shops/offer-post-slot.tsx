"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useTranslation } from "react-i18next"
import { OfferCard } from "./offer-card"

/** Le serveur relit le post, son auteur, sa page et la diffusion de l'offre. */
export function OfferPostSlot({ networkId, postId }: { networkId: Id<"networks">; postId: Id<"posts"> }) {
  return <OfferPostQuery key={`${networkId}:${postId}`} networkId={networkId} postId={postId} />
}
function OfferPostQuery({ networkId, postId }: { networkId: Id<"networks">; postId: Id<"posts"> }) {
  const { t, i18n } = useTranslation("shops")
  const query = useAuthenticatedConvexQuery(api.modules.shops.catalog.postOffer, { networkId, postId })
  if (query.isError) return <p role="status" className="px-4 py-3 text-sm text-muted-foreground">{t("catalog.offerUnavailable")}</p>
  if (query.isPending || !query.data) return null
  return <aside aria-label={t("catalog.attachedOffer")} className="px-3 pb-3 sm:px-4 sm:pb-4"><OfferCard offer={query.data} audience="member" locale={i18n.resolvedLanguage ?? "fr"} t={(key, options) => t(key, options)} compact /></aside>
}
