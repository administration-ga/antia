"use client"

import { api, type Id } from "@antsia/api/engine"
import { Button } from "@antsia/ui"
import { useQuery } from "convex/react"
import { Download } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConsoleDate, controlStyle, EmptyRows, LoadingRows, OperationFailure, panelClass } from "./console-operation-controls"

export type AggregateExportDto = {
  threshold: number
  periods: { periodStart: number; periodEnd: number; cases: number | null; actioned: number | null; dismissed: number | null; suppressed: boolean }[]
}

/** Construction fermée : même un objet enrichi ne peut exporter d'identité ni de texte libre. */
export function closedAggregateExport(dto: AggregateExportDto): AggregateExportDto {
  if (!Number.isSafeInteger(dto.threshold) || dto.threshold < 5 || dto.periods.length > 12) throw new Error("invalid aggregate")
  return { threshold: dto.threshold, periods: dto.periods.map((row) => {
    if (!Number.isFinite(row.periodStart) || !Number.isFinite(row.periodEnd) || row.periodStart >= row.periodEnd || Number.isNaN(new Date(row.periodStart).getTime()) || Number.isNaN(new Date(row.periodEnd).getTime())) throw new Error("invalid period")
    const suppressed = row.suppressed || row.cases === null || !Number.isSafeInteger(row.cases) || row.cases < dto.threshold
    const cases = suppressed ? null : row.cases
    const counter = (value: number | null) => cases !== null && value !== null && Number.isSafeInteger(value) && value >= dto.threshold && cases - value >= dto.threshold ? value : null
    return { periodStart: row.periodStart, periodEnd: row.periodEnd, cases, actioned: counter(row.actioned), dismissed: counter(row.dismissed), suppressed }
  }) }
}

export function aggregateExportText(dto: AggregateExportDto, format: "json" | "csv"): string {
  const closed = closedAggregateExport(dto)
  if (format === "json") return JSON.stringify(closed, null, 2)
  const rows = closed.periods.map((row) => [new Date(row.periodStart).toISOString(), new Date(row.periodEnd).toISOString(), row.cases ?? "", row.actioned ?? "", row.dismissed ?? "", row.suppressed, closed.threshold].join(","))
  return ["periodStart,periodEnd,cases,actioned,dismissed,suppressed,threshold", ...rows].join("\r\n")
}

/** Pas de requête lors du clic : le téléchargement utilise la projection déjà autorisée. */
export function downloadAggregateExport(dto: AggregateExportDto, format: "json" | "csv") {
  const blob = new Blob([aggregateExportText(dto, format)], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  try {
    anchor.href = url
    anchor.download = `antsia-aggregate.${format}`
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}

export function ExportPanel({ networkId }: { networkId: Id<"networks"> }) {
  const { t, i18n } = useTranslation("operations")
  const result = useQuery(api.modules.platform.console.aggregateExport, { networkId })
  const [error, setError] = useState<string | null>(null)
  const number = new Intl.NumberFormat(i18n.language)
  let snapshot: AggregateExportDto | null = null
  let invalid = false
  if (result !== undefined) {
    try { snapshot = closedAggregateExport(result) } catch { invalid = true }
  }
  const download = (format: "json" | "csv") => {
    if (!snapshot) return
    setError(null)
    try { downloadAggregateExport(snapshot, format); toast.success(t("export.downloaded")) }
    catch { setError(t("export.failed")); toast.error(t("export.failed")) }
  }
  const cell = (value: number | null) => value === null ? t("export.suppressed") : number.format(value)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-5`}>
    <h2 className="flex items-center gap-2 text-xl font-semibold"><Download size={22} aria-hidden="true" />{t("export.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("export.lead", { threshold: snapshot?.threshold ?? 5 })}</p>
    <p className="rounded-lg bg-muted p-3 text-sm">{t("export.suppressionHint")}</p>
    {result === undefined ? <LoadingRows /> : invalid ? <OperationFailure message={t("export.invalid")} /> : snapshot?.periods.length === 0 ? <EmptyRows /> : snapshot ? <ul className="grid min-w-0 gap-4 lg:grid-cols-2">{snapshot.periods.map((row) => <li key={row.periodStart} className="flex min-w-0 flex-col gap-4 rounded-lg border border-border p-4">
      <p className="text-sm"><ConsoleDate at={row.periodStart} /> · <ConsoleDate at={row.periodEnd} /></p>
      <dl className="grid grid-cols-3 gap-3">{(["cases", "actioned", "dismissed"] as const).map((key) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{t(`export.columns.${key}`)}</dt><dd className="mt-1 break-words font-medium tabular-nums">{cell(row[key])}</dd></div>)}</dl>
    </li>)}</ul> : null}
    <OperationFailure message={error} />
    <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" style={controlStyle} disabled={!snapshot} onClick={() => download("json")}>{t("export.json")}</Button><Button type="button" variant="outline" style={controlStyle} disabled={!snapshot} onClick={() => download("csv")}>{t("export.csv")}</Button></div>
  </section>
}
