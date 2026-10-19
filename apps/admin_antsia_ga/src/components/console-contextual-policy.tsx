"use client"

import { api, type Id } from "@antsia/api/engine"
import { useMutation, useQuery } from "convex/react"
import { useTranslation } from "react-i18next"

import { ConsoleDate, LoadingRows, MotiveAction, panelClass } from "./console-operation-controls"

/**
 * CC-2b (ADR-0025) — politique des conversations contextuelles d'un réseau, une ligne par nature,
 * FERMÉE par défaut. Lecture pour toute la console ; décision réservée à l'administration de la
 * plateforme, avec un motif d'au moins dix caractères, inscrite au journal (`contextual.policy_set`).
 */
export function ContextualConversationPolicy({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const policies = useQuery(api.modules.contextualMessaging.operator.policies, { networkId })
  const setPolicy = useMutation(api.modules.contextualMessaging.operator.setPolicy)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-3`}>
    <h3 className="font-semibold">{t("contextualPolicy.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("contextualPolicy.lead")}</p>
    <p className="text-sm text-muted-foreground">{t("contextualPolicy.existingHint")}</p>
    {policies === undefined ? <LoadingRows /> : <ul className="flex min-w-0 flex-col gap-3">{policies.map((policy) => <li key={policy.kind} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
      <h4 className="break-words text-sm font-semibold">{t(`contextualPolicy.kinds.${policy.kind}`)}</h4>
      <p role="status" className="text-sm">{t(policy.enabled ? "contextualPolicy.enabled" : "contextualPolicy.disabled")}</p>
      {policy.updatedAt !== null ? <p className="text-xs text-muted-foreground">{t("contextualPolicy.updated")} <ConsoleDate at={policy.updatedAt} /></p> : null}
      {canAdmin ? <MotiveAction key={`${networkId}:${policy.kind}:${policy.enabled}`} label={t(policy.enabled ? "contextualPolicy.disable" : "contextualPolicy.enable")} minLength={10} danger={policy.enabled} onDecision={(reason) => setPolicy({ networkId, kind: policy.kind, enabled: !policy.enabled, reason })} /> : null}
    </li>)}</ul>}
  </section>
}
