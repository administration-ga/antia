"use client"

import { api, type Id } from "@antsia/api/engine"
import { Button } from "@antsia/ui"
import { useMutation, useQuery } from "convex/react"
import { Activity, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { ConsoleDate, controlStyle, LoadingRows, OperationFailure, panelClass, useOperation } from "./console-operation-controls"

const metricKeys = ["members", "openReports", "openAppeals", "pendingFiles", "deadLetters"] as const
export function HealthPanel({ networkId }: { networkId: Id<"networks"> }) {
  const { t, i18n } = useTranslation("operations")
  const metrics = useQuery(api.modules.platform.console.getMetrics, { networkId })
  const refresh = useMutation(api.modules.platform.console.refreshMetrics)
  const operation = useOperation()
  const number = new Intl.NumberFormat(i18n.language)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-5`}>
    <h2 className="flex items-center gap-2 text-xl font-semibold"><Activity size={22} aria-hidden="true" />{t("health.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("health.lead")}</p>
    {metrics === undefined ? <LoadingRows /> : metrics === null ? <p role="status">{t("health.notGenerated")}</p> : metrics.status === "building" ? <p role="status" className="rounded-lg bg-muted p-4">{t("health.building")}</p> : <>
      {metrics.generatedAt !== null ? <p className="text-sm text-muted-foreground">{t("health.generated")} <ConsoleDate at={metrics.generatedAt} /></p> : <p role="status">{t("health.dateMissing")}</p>}
      <dl className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{metricKeys.map((key) => <div key={key} className="rounded-lg border border-border p-4"><dt className="text-sm text-muted-foreground">{t(`health.metrics.${key}`)}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{number.format(metrics.counts[key])}</dd></div>)}</dl>
    </>}
    <OperationFailure message={operation.error} />
    <Button type="button" style={controlStyle} disabled={operation.pending || metrics === undefined || metrics?.status === "building"} onClick={() => { void operation.run(() => refresh({ networkId }), "health.queued") }}><RefreshCw size={16} aria-hidden="true" />{t(operation.pending ? "common.saving" : "health.refresh")}</Button>
    <p className="text-xs text-muted-foreground">{t("health.snapshotHint")}</p>
  </section>
}
