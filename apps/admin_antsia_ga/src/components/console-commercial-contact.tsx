"use client"

import { api, type Id } from "@antsia/api/engine"
import { useMutation, useQuery } from "convex/react"
import { useTranslation } from "react-i18next"
import { LoadingRows, MotiveAction, panelClass } from "./console-operation-controls"

export function CommercialContactPolicy({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const policy = useQuery(api.modules.commercialMessaging.operator.policy, { networkId })
  const setPolicy = useMutation(api.modules.commercialMessaging.operator.setPolicy)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-3`}>
    <h3 className="font-semibold">{t("commercialContact.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("commercialContact.lead")}</p>
    {policy === undefined ? <LoadingRows /> : <>
      <p role="status" className="text-sm">{t(policy.enabled ? "commercialContact.enabled" : "commercialContact.disabled")}</p>
      {canAdmin ? <MotiveAction label={t(policy.enabled ? "commercialContact.disable" : "commercialContact.enable")} minLength={10} danger={policy.enabled} onDecision={(reason) => setPolicy({ networkId, enabled: !policy.enabled, reason })} /> : null}
    </>}
  </section>
}
