"use client"

import { api, type Id } from "@antsia/api/engine"
import { Badge, Button, Field, Select, TextArea, TextInput } from "@antsia/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { TriangleAlert } from "lucide-react"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { ConsoleDate, controlStyle, EmptyRows, inputStyle, LoadingRows, MotiveAction, OperationFailure, panelClass, reasonSchema, useOperation, useOperationDraft, useWindowCursor, WindowPagination } from "./console-operation-controls"

type IncidentValues = { title: string; severity: "info" | "warning" | "critical"; reason: string }
function CreateIncident({ networkId }: { networkId?: Id<"networks"> }) {
  const { t } = useTranslation("operations")
  const id = useId()
  const operation = useOperation()
  const create = useMutation(api.modules.platform.console.createIncident)
  const form = useForm<IncidentValues>({ resolver: zodResolver(z.object({ title: z.string().trim().min(2, t("incidents.titleInvalid")).max(160, t("incidents.titleInvalid")), severity: z.enum(["info", "warning", "critical"]), reason: reasonSchema(t("common.reasonInvalid", { min: 3 })) })), defaultValues: { title: "", severity: "info", reason: "" } })
  useOperationDraft(form.formState.isDirty || form.formState.isSubmitting || operation.pending)
  const submit = async (values: IncidentValues) => {
    if (await operation.run(() => create({ ...(networkId === undefined ? {} : { networkId }), ...values }))) form.reset()
  }
  return <form className={`${panelClass} flex min-w-0 flex-col gap-4`} noValidate aria-busy={operation.pending || undefined} onSubmit={(event) => { void form.handleSubmit(submit)(event) }}>
    <h3 className="font-semibold">{t("incidents.create")}</h3>
    <p className="text-sm text-muted-foreground">{t(networkId ? "incidents.networkScope" : "incidents.globalScope")}</p>
    <fieldset disabled={operation.pending} className="flex min-w-0 flex-col gap-4">
      <Field htmlFor={`${id}-title`} label={t("incidents.name")} required error={form.formState.errors.title?.message} hint={t("incidents.titleHint")}><TextInput id={`${id}-title`} style={inputStyle} maxLength={160} {...form.register("title")} /></Field>
      <Field htmlFor={`${id}-severity`} label={t("incidents.severity")}><Select id={`${id}-severity`} style={inputStyle} {...form.register("severity")}><option value="info">{t("incidents.level.info")}</option><option value="warning">{t("incidents.level.warning")}</option><option value="critical">{t("incidents.level.critical")}</option></Select></Field>
      <Field htmlFor={`${id}-reason`} label={t("common.reason")} required error={form.formState.errors.reason?.message}><TextArea id={`${id}-reason`} maxLength={500} {...form.register("reason")} /></Field>
    </fieldset>
    <OperationFailure message={operation.error} />
    <Button type="submit" style={controlStyle} disabled={operation.pending}>{t(operation.pending ? "common.saving" : "incidents.create")}</Button>
  </form>
}

export function IncidentsPanel({ networkId }: { networkId?: Id<"networks"> }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const incidents = useQuery(api.modules.platform.console.paginateIncidents, { ...(networkId === undefined ? {} : { networkId }), paginationOpts: { cursor: window.cursor, numItems: 20, maximumRowsRead: 50, maximumBytesRead: 262_144 } })
  const resolve = useMutation(api.modules.platform.console.resolveIncident)
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.6fr)]">
    <section className={`${panelClass} flex min-w-0 flex-col gap-4`}>
      <h2 className="flex items-center gap-2 text-xl font-semibold"><TriangleAlert size={22} aria-hidden="true" />{t("incidents.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("incidents.lead")}</p>
      {incidents === undefined ? <LoadingRows /> : incidents.page.length === 0 ? <EmptyRows done={incidents.isDone} /> : <ul className="flex min-w-0 flex-col gap-4">{incidents.page.map((incident) => <li key={incident.incidentId} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{incident.title}</h3><Badge tone={incident.severity === "critical" ? "danger" : incident.severity === "warning" ? "warning" : "info"}>{t(`incidents.level.${incident.severity}`)}</Badge></div>
        <p className="text-sm">{t(`incidents.status.${incident.status}`)}</p>
        <p className="text-xs text-muted-foreground"><ConsoleDate at={incident.updatedAt} /></p>
        {incident.status === "open" ? <MotiveAction label={t("incidents.resolve")} onDecision={(reason) => resolve({ incidentId: incident.incidentId, reason })} /> : null}
      </li>)}</ul>}
      <WindowPagination window={window} result={incidents} />
    </section>
    <CreateIncident networkId={networkId} />
  </div>
}
