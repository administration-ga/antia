"use client"

import { api, type Id } from "@antsia/api/engine"
import { Button, Field, Select, TextArea, TextInput } from "@antsia/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Link2 } from "lucide-react"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { ConsoleDate, controlStyle, EmptyRows, inputStyle, LoadingRows, MotiveAction, OperationFailure, panelClass, reasonSchema, useOperation, useOperationDraft, useOperationDraftGuard, useWindowCursor, WindowPagination } from "./console-operation-controls"

type Emitter = FunctionReturnType<typeof api.modules.federation.emitters.paginate>["page"][number]
type EmitterValues = { slug: string; environment: "sandbox" | "production"; keyEnvName: string; contracts: string; enabled: boolean; reason: string }
const blankEmitter: EmitterValues = { slug: "", environment: "sandbox", keyEnvName: "", contracts: "", enabled: false, reason: "" }
export function parseContracts(value: string): string[] { return value.split(/[\s,]+/u).filter(Boolean) }
export function validContractsInput(value: string): boolean {
  const values = parseContracts(value)
  return values.length <= 32 && new Set(values).size === values.length && values.every((item) => item.length <= 100 && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-V[1-9][0-9]*$/u.test(item))
}

function EmitterConfiguration({ networkId, selected, canAdmin }: { networkId: Id<"networks">; selected: Emitter | null; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const id = useId()
  const operation = useOperation()
  const configure = useMutation(api.modules.federation.emitters.configure)
  const form = useForm<EmitterValues>({
    resolver: zodResolver(z.object({
      slug: z.string().trim().regex(/^[a-z][a-z0-9-]{1,63}$/u, t("federation.slugInvalid")),
      environment: z.enum(["sandbox", "production"]),
      keyEnvName: z.string().trim().max(160, t("federation.keyInvalid")).regex(/^ANTSIA_FEDERATION_[A-Z0-9_]+_KEY$/u, t("federation.keyInvalid")),
      contracts: z.string().max(3300, t("federation.contractsInvalid")).refine(validContractsInput, t("federation.contractsInvalid")),
      enabled: z.boolean(),
      reason: reasonSchema(t("common.reasonInvalid", { min: 10 }), 10),
    })),
    defaultValues: selected ? { slug: selected.slug, environment: selected.environment, keyEnvName: selected.keyEnvName, contracts: selected.allowedContracts.join("\n"), enabled: selected.enabled, reason: "" } : blankEmitter,
  })
  useOperationDraft(form.formState.isDirty || form.formState.isSubmitting || operation.pending)
  const submit = async (values: EmitterValues) => {
    if (!canAdmin) return
    const saved = await operation.run(() => configure({ networkId, slug: values.slug, environment: values.environment, keyEnvName: values.keyEnvName, allowedContracts: parseContracts(values.contracts), enabled: values.enabled, reason: values.reason }))
    if (saved) form.reset({ ...values, reason: "" })
  }
  return <form className={`${panelClass} flex min-w-0 flex-col gap-4`} noValidate aria-busy={operation.pending || undefined} onSubmit={(event) => { void form.handleSubmit(submit)(event) }}>
    <h3 className="font-semibold">{t(selected ? "federation.editEmitter" : "federation.configureEmitter")}</h3>
    <p className="text-sm text-muted-foreground">{t("federation.keyHint")}</p>
    <fieldset disabled={operation.pending || !canAdmin} className="flex min-w-0 flex-col gap-4">
      <Field htmlFor={`${id}-slug`} label={t("federation.slug")} required error={form.formState.errors.slug?.message}><TextInput id={`${id}-slug`} style={inputStyle} autoComplete="off" autoCapitalize="none" spellCheck={false} readOnly={selected !== null} maxLength={64} {...form.register("slug")} /></Field>
      {selected ? <div><p className="text-sm font-medium">{t("federation.environment")}</p><p>{t(`federation.${selected.environment}`)}</p><input type="hidden" {...form.register("environment")} /></div> : <Field htmlFor={`${id}-environment`} label={t("federation.environment")}><Select id={`${id}-environment`} style={inputStyle} {...form.register("environment")}><option value="sandbox">{t("federation.sandbox")}</option><option value="production">{t("federation.production")}</option></Select></Field>}
      <Field htmlFor={`${id}-key`} label={t("federation.keyReference")} required error={form.formState.errors.keyEnvName?.message}><TextInput id={`${id}-key`} style={inputStyle} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={160} {...form.register("keyEnvName")} /></Field>
      <Field htmlFor={`${id}-contracts`} label={t("federation.contracts")} hint={t("federation.contractsHint")} error={form.formState.errors.contracts?.message}><TextArea id={`${id}-contracts`} maxLength={3300} {...form.register("contracts")} /></Field>
      <label className="flex min-h-11 items-center gap-3" htmlFor={`${id}-enabled`}><input id={`${id}-enabled`} type="checkbox" className="h-5 w-5" {...form.register("enabled")} />{t("federation.enabled")}</label>
      <Field htmlFor={`${id}-reason`} label={t("common.reason")} required error={form.formState.errors.reason?.message}><TextArea id={`${id}-reason`} maxLength={500} {...form.register("reason")} /></Field>
    </fieldset>
    <OperationFailure message={operation.error} />
    <Button type="submit" style={controlStyle} disabled={operation.pending || !canAdmin}>{t(operation.pending ? "common.saving" : "federation.saveEmitter")}</Button>
  </form>
}

function Emitters({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const emitters = useQuery(api.modules.federation.emitters.paginate, { networkId, paginationOpts: { cursor: window.cursor, numItems: 20, maximumRowsRead: 25, maximumBytesRead: 262_144 } })
  const [selected, setSelected] = useState<Emitter | null>(null)
  const canChange = useOperationDraftGuard()
  return <div className="grid min-w-0 gap-5 lg:grid-cols-2">
    <section className={`${panelClass} flex flex-col gap-4`}>
      <h3 className="font-semibold">{t("federation.emitters")}</h3>
      {emitters === undefined ? <LoadingRows /> : emitters.page.length === 0 ? <EmptyRows done={emitters.isDone} /> : <ul className="flex flex-col gap-4">{emitters.page.map((row) => <li key={row._id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-4">
        <h4 className="break-words font-semibold">{row.slug}</h4>
        <p className="text-sm">{t(`federation.${row.environment}`)} · {t(row.enabled ? "common.active" : "common.inactive")}</p>
        <p className="text-xs text-muted-foreground">{t("federation.revision", { revision: row.revision })} · <ConsoleDate at={row.updatedAt} /></p>
        <p className="break-words text-sm">{row.allowedContracts.length ? row.allowedContracts.join(", ") : t("federation.noContracts")}</p>
        {canAdmin ? <Button variant="outline" style={controlStyle} onClick={() => { if (row._id !== selected?._id && canChange()) setSelected(row) }}>{t("federation.editEmitter")}</Button> : null}
      </li>)}</ul>}
      <WindowPagination window={window} result={emitters} />
      {canAdmin && selected ? <Button variant="ghost" style={controlStyle} onClick={() => { if (canChange()) setSelected(null) }}>{t("federation.newEmitter")}</Button> : null}
    </section>
    {canAdmin ? <EmitterConfiguration key={selected?._id ?? "new"} networkId={networkId} selected={selected} canAdmin={canAdmin} /> : <p className={`${panelClass} text-sm text-muted-foreground`}>{t("common.adminRequired")}</p>}
  </div>
}

function FederationReceipts({ networkId }: { networkId: Id<"networks"> }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const result = useQuery(api.modules.federation.replay.paginateReceipts, { networkId, paginationOpts: { cursor: window.cursor, numItems: 20, maximumRowsRead: 50, maximumBytesRead: 262_144 } })
  return <section className={`${panelClass} flex min-w-0 flex-col gap-4`}>
    <h3 className="font-semibold">{t("federation.receipts")}</h3>
    {result === undefined ? <LoadingRows /> : result.page.length === 0 ? <EmptyRows done={result.isDone} /> : <ul className="flex flex-col gap-4">{result.page.map((row) => <li key={row._id} className="flex min-w-0 flex-col gap-2 border-b border-border pb-4">
      <p className="break-words font-medium">{row.contract}</p>
      <p className="text-sm">{t(`federation.receiptStatus.${row.status}`)} · {t(`federation.${row.environment}`)}</p>
      <p className="text-xs text-muted-foreground"><ConsoleDate at={row.receivedAt} /></p>
    </li>)}</ul>}
    <WindowPagination window={window} result={result} />
  </section>
}

function MediaTransfers({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const result = useQuery(api.modules.federation.mediaOperations.paginate, { networkId, paginationOpts: { cursor: window.cursor, numItems: 20, maximumRowsRead: 25, maximumBytesRead: 524_288 } })
  const retry = useMutation(api.modules.federation.mediaOperations.retry)
  return <section className={`${panelClass} flex min-w-0 flex-col gap-4`}>
    <h3 className="font-semibold">{t("federation.mediaTransfers")}</h3>
    <p className="text-sm text-muted-foreground">{t("federation.mediaTransfersHint")}</p>
    {result === undefined ? <LoadingRows /> : result.page.length === 0 ? <EmptyRows done={result.isDone} /> : <ul className="flex flex-col gap-4">{result.page.map((row) => <li key={row.mirrorId} className="flex min-w-0 flex-col gap-2 border-b border-border pb-4">
      <p className="break-words font-medium">{t("federation.mediaReference", { kind: t(`federation.mediaKind.${row.localTable}`), reference: row.objectRef })}</p>
      <p className="text-sm">{t(`federation.mediaStatus.${row.status}`)}</p>
      {row.reason ? <p className="text-sm text-muted-foreground">{t(`federation.mediaFailure.${row.reason}`)}</p> : null}
      <p className="text-xs text-muted-foreground">{t("federation.attempts", { count: row.attempts })} · <ConsoleDate at={row.updatedAt} /></p>
      {canAdmin && row.status === "failed" ? <MotiveAction label={t("federation.mediaRetry")} minLength={10} successKey="federation.mediaRetryQueued" onDecision={(reason) => retry({ mirrorId: row.mirrorId, reason })} /> : null}
    </li>)}</ul>}
    <WindowPagination window={window} result={result} />
  </section>
}

function DeadLetters({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const result = useQuery(api.modules.federation.replay.paginateDeadLetters, { networkId, status: "dead_letter", paginationOpts: { cursor: window.cursor, numItems: 10, maximumRowsRead: 20, maximumBytesRead: 1_572_864 } })
  const replay = useMutation(api.modules.federation.replay.replay)
  const [outcomes, setOutcomes] = useState<Record<string, "deduplicated" | "still_failing" | "applied" | "discarded">>({})
  return <section className={`${panelClass} flex min-w-0 flex-col gap-4`}>
    <h3 className="font-semibold">{t("federation.deadLetters")}</h3>
    <p className="text-sm text-muted-foreground">{t("federation.replayHint")}</p>
    {result === undefined ? <LoadingRows /> : result.page.length === 0 ? <EmptyRows done={result.isDone} /> : <ul className="flex flex-col gap-4">{result.page.map((row) => <li key={row._id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <p className="break-words font-medium">{row.contract}</p>
      <p className="text-sm">{t(`federation.failure.${row.reason}`)} · {t(`federation.${row.environment}`)}</p>
      <p className="text-xs text-muted-foreground">{t("federation.attempts", { count: row.attempts })} · <ConsoleDate at={row.lastAttemptAt} /></p>
      {outcomes[row._id] ? <p role="status" className="rounded-lg bg-muted p-3 text-sm">{t(`federation.outcome.${outcomes[row._id]}`)}</p> : null}
      {canAdmin ? <MotiveAction label={t("federation.replay")} minLength={10} successKey={null} onDecision={(reason) => replay({ deadLetterId: row._id, reason })} onSuccess={(response) => {
        setOutcomes((previous) => ({ ...previous, [row._id]: response.outcome }))
        if (response.outcome === "still_failing") toast.warning(t("federation.outcome.still_failing"))
        else toast.success(t(`federation.outcome.${response.outcome}`))
      }} /> : null}
    </li>)}</ul>}
    <WindowPagination window={window} result={result} />
  </section>
}

export function FederationPanel({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  return <div className="flex min-w-0 flex-col gap-5">
    <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Link2 size={22} aria-hidden="true" />{t("federation.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("federation.lead")}</p></div>
    <section className={`${panelClass} flex min-w-0 flex-col gap-2`} aria-label={t("federation.pageSyncTitle")}>
      <h3 className="font-semibold">{t("federation.pageSyncTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("federation.pageSyncHint")}</p>
    </section>
    <Emitters networkId={networkId} canAdmin={canAdmin} />
    <div className="grid min-w-0 gap-5 lg:grid-cols-2"><FederationReceipts networkId={networkId} /><DeadLetters networkId={networkId} canAdmin={canAdmin} /></div>
    <MediaTransfers networkId={networkId} canAdmin={canAdmin} />
  </div>
}
