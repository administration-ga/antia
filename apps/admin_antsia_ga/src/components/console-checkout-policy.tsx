"use client"

import { api, type Id } from "@antsia/api/engine"
import { useMutation, useQuery } from "convex/react"
import { useTranslation } from "react-i18next"

import { ConsoleDate, LoadingRows, MotiveAction, panelClass } from "./console-operation-controls"

/**
 * Finitions (DP-37, K-19) — P11, monté uniquement pour canAdmin : la lecture exige l'autorité
 * d'administration de la plateforme. Préparation privée des commandes, FERMÉE par défaut ; chaque
 * décision motivée (dix caractères) et inscrite au journal (`checkout.policy_set`). Aucun paiement
 * n'en découle : la politique de paiement (P12) reste distincte.
 */
export function CheckoutPolicy({ networkId }: { networkId: Id<"networks"> }) {
  const { t } = useTranslation("operations")
  const policy = useQuery(api.modules.shops.checkoutPolicy.getPolicy, { networkId })
  const setPolicy = useMutation(api.modules.shops.checkoutPolicy.setPolicy)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-3`}>
    <h3 className="font-semibold">{t("checkoutPolicy.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("checkoutPolicy.lead")}</p>
    <p className="text-sm text-muted-foreground">{t("checkoutPolicy.linkHint")}</p>
    <p className="text-sm text-muted-foreground">{t("checkoutPolicy.existingHint")}</p>
    {policy === undefined ? <LoadingRows /> : <>
      <p role="status" className="text-sm">{t(policy.enabled ? "checkoutPolicy.enabled" : "checkoutPolicy.disabled")}</p>
      {policy.updatedAt !== null ? <p className="text-xs text-muted-foreground">{t("checkoutPolicy.updated")} <ConsoleDate at={policy.updatedAt} /></p> : null}
      <MotiveAction key={`${networkId}:${policy.enabled}`} label={t(policy.enabled ? "checkoutPolicy.disable" : "checkoutPolicy.enable")} minLength={10} danger={policy.enabled} onDecision={(reason) => setPolicy({ networkId, enabled: !policy.enabled, reason })} />
    </>}
  </section>
}
