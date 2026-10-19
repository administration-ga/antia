"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { COMMERCE_JOBS_APPLICATION_CONSENT_VERSION, COMMERCE_JOBS_ATTACHMENT_KINDS, COMMERCE_JOBS_LIMITS } from "@antsia/social-domain/commerce-jobs"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { FileUp, Send, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button, Card, Field, TextArea, TextInput } from "@/components/shared/controls"
import { SHOP_SELECT_CLASS, useShopAction } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"
import { JOB_FILE_ACCEPT, JOB_FILE_MAX_BYTES, jobApplicationSchema, jobCivilNamePreview, jobErrorText, jobFileSizeKb, jobIdempotencyKey, selectableJobFiles, type JobApplicationInput, type JobApplicationValues, type JobDto, type JobFileDto } from "./job-model"

const uploadResponse = z.object({ storageId: z.string().min(1).max(200) })

/** Mes pièces : dépôt (PDF, 5 Mo, analyse complète), état d'analyse, retrait. Jamais d'adresse de fichier. */
export function JobFilesManager({ files, onUploaded }: { files: readonly JobFileDto[]; onUploaded?: (fileId: Id<"commerceApplicationFiles">) => void }) {
  const { t } = useTranslation("jobs")
  const { networkId } = useNetwork()
  const generateUploadUrl = useMutation(api.modules.shops.jobFiles.generateUploadUrl)
  const registerFile = useMutation(api.modules.shops.jobFiles.registerFile)
  const retireFile = useMutation(api.modules.shops.jobFiles.retireFile)
  const action = useShopAction()
  const kindId = useId(), fileId = useId()
  const schema = useMemo(() => z.object({
    kind: z.enum(COMMERCE_JOBS_ATTACHMENT_KINDS),
    file: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, t("files.notPdf"))
      .refine((file) => file.type === JOB_FILE_ACCEPT || file.name.toLowerCase().endsWith(".pdf"), t("files.notPdf"))
      .refine((file) => file.size > 0 && file.size <= JOB_FILE_MAX_BYTES, t("files.tooLarge")),
  }), [t])
  type UploadValues = z.infer<typeof schema>
  const form = useForm<UploadValues>({ resolver: zodResolver(schema), defaultValues: { kind: "cv" } })
  const fileError = form.formState.errors.file?.message
  const upload = form.handleSubmit((values) => action.run(async () => {
    const url = await generateUploadUrl({ networkId })
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": JOB_FILE_ACCEPT }, body: values.file })
    if (!response.ok) throw new Error("upload")
    const { storageId } = uploadResponse.parse(await response.json())
    return await registerFile({ networkId, storageId: storageId as Id<"_storage">, kind: values.kind, filename: values.file.name, mimeType: JOB_FILE_ACCEPT })
  }, (result) => { form.reset({ kind: values.kind }); toast.success(t("files.uploaded")); onUploaded?.(result.fileId) }))

  return <section aria-labelledby={`${kindId}-title`} className="grid gap-3">
    <h3 id={`${kindId}-title`} className="text-base font-semibold">{t("files.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("files.pdfOnly")}</p>
    {files.length === 0 ? <p className="text-sm text-muted-foreground">{t("files.empty")}</p> : <ul className="grid gap-2">{files.map((file) => <li key={file.fileId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <span className="grid min-w-0 gap-0.5"><span className="font-medium">{file.filename ?? t("files.unnamed")}</span><span className="text-sm text-muted-foreground">{t(`files.kind.${file.kind}`)} · {t("files.size", { size: jobFileSizeKb(file.byteSize) })} · {t(`files.scan.${file.scan}`)}</span></span>
      <Button type="button" variant="ghost" pending={action.pending} onClick={() => { if (window.confirm(t("files.retireConfirm"))) void action.run(async () => await retireFile({ fileId: file.fileId }), () => { toast.success(t("files.retired")) }) }}><Trash2 aria-hidden="true" className="size-4" />{t("files.retire")}</Button>
    </li>)}</ul>}
    <form noValidate onSubmit={(event) => { void upload(event) }} className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
      <Field id={kindId} label={t("files.kindLabel")}><select id={kindId} className={SHOP_SELECT_CLASS} {...form.register("kind")}>{COMMERCE_JOBS_ATTACHMENT_KINDS.map((kind) => <option key={kind} value={kind}>{t(`files.kind.${kind}`)}</option>)}</select></Field>
      <Field id={fileId} label={t("files.pick")} error={fileError}><input id={fileId} type="file" accept={JOB_FILE_ACCEPT} aria-invalid={fileError ? true : undefined} aria-describedby={fileError ? `${fileId}-error` : undefined} className="min-h-11 w-full text-sm" onChange={(event) => form.setValue("file", event.target.files?.[0] as File, { shouldValidate: true })} /></Field>
      <Button type="submit" variant="outline" pending={action.pending}><FileUp aria-hidden="true" className="size-4" />{action.pending ? t("files.uploading") : t("files.pick")}</Button>
    </form>
    {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
  </section>
}

/**
 * Formulaire de candidature : nom civil (aperçu normalisé tel que transmis),
 * motivation facultative, pièces prêtes choisies, accord versionné. Une clé
 * d'idempotence par formulaire monté : un double envoi rend la même candidature.
 *
 * ⚠️ AUCUN formulaire imbriqué (P18b, A19). Le dépôt de pièce a son propre
 * `<form>` (`JobFilesManager`) : rendu DANS celui de la candidature, son envoi
 * remontait jusqu'à elle — un simple dépôt validait, voire envoyait, la
 * candidature. Le `<form>` de candidature se ferme donc avant le gestionnaire
 * de pièces ; l'accord et le bouton d'envoi, qui suivent visuellement, lui
 * restent rattachés par l'attribut `form` (même ordre à l'écran, même envoi).
 */
export function JobApplicationForm({ job }: { job: JobDto }) {
  const { t } = useTranslation("jobs")
  const { networkId } = useNetwork()
  const router = useRouter()
  const apply = useMutation(api.modules.shops.jobApplications.apply)
  const filesQuery = useAuthenticatedConvexQuery(api.modules.shops.jobFiles.myFiles, {})
  const [idempotencyKey] = useState(jobIdempotencyKey)
  const [error, setError] = useState<string | null>(null)
  const ids = { first: useId(), last: useId(), motivation: useId(), consent: useId(), form: useId() }
  const schema = useMemo(() => jobApplicationSchema({
    nameRequired: t("apply.nameRequired"), nameTooLong: t("apply.nameTooLong"), nameInvalid: t("apply.nameInvalid"),
    motivationTooLong: t("apply.motivationTooLong"), filesTooMany: t("apply.filesTooMany"), consentRequired: t("apply.consentRequired"),
  }), [t])
  const form = useForm<JobApplicationInput, unknown, JobApplicationValues>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", motivation: "", fileIds: [], consent: false } })
  const [firstName, lastName, chosen] = form.watch(["firstName", "lastName", "fileIds"])
  const preview = jobCivilNamePreview(firstName ?? "", lastName ?? "")
  const files = selectableJobFiles(filesQuery.data ?? [])
  const errors = form.formState.errors
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await apply({
        networkId, handle: job.shopHandle, jobRef: job.jobRef, firstName: values.firstName, lastName: values.lastName,
        ...(values.motivation.length > 0 ? { motivation: values.motivation } : {}),
        fileIds: values.fileIds as Id<"commerceApplicationFiles">[], consent: true, consentTextVersion: COMMERCE_JOBS_APPLICATION_CONSENT_VERSION, idempotencyKey,
      })
      toast.success(t("apply.sent"))
      router.push(routes.myApplications())
    } catch (reason) { setError(jobErrorText(reason, (key, options) => t(key, options))) }
  })

  return <Card><section className="grid gap-5" aria-labelledby={`${ids.first}-title`}><form id={ids.form} noValidate onSubmit={(event) => { void submit(event) }} className="grid gap-5">
    <header className="grid gap-1"><h2 id={`${ids.first}-title`} className="text-lg font-semibold">{t("apply.title")}</h2><p className="text-sm text-muted-foreground">{t("apply.lead")}</p></header>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={ids.last} label={t("apply.lastName")} error={errors.lastName?.message}><TextInput id={ids.last} autoComplete="family-name" aria-invalid={errors.lastName ? true : undefined} aria-describedby={errors.lastName ? `${ids.last}-error` : undefined} {...form.register("lastName")} /></Field>
      <Field id={ids.first} label={t("apply.firstName")} error={errors.firstName?.message}><TextInput id={ids.first} autoComplete="given-name" aria-invalid={errors.firstName ? true : undefined} aria-describedby={errors.firstName ? `${ids.first}-error` : undefined} {...form.register("firstName")} /></Field>
    </div>
    <p className="text-sm text-muted-foreground">{t("apply.nameHint")}</p>
    {preview ? <p className="text-sm" aria-live="polite">{t("apply.namePreview", { name: preview })}</p> : null}
    <Field id={ids.motivation} label={t("apply.motivation")} hint={t("apply.motivationHint")} error={errors.motivation?.message}><TextArea id={ids.motivation} aria-invalid={errors.motivation ? true : undefined} aria-describedby={errors.motivation ? `${ids.motivation}-error` : `${ids.motivation}-hint`} {...form.register("motivation")} /></Field>
    <fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("apply.files")}</legend><p className="text-sm text-muted-foreground">{t("apply.filesHint")}</p>
      {files.map((file) => <label key={file.fileId} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3"><input type="checkbox" value={file.fileId} disabled={!(chosen ?? []).includes(file.fileId) && (chosen ?? []).length >= COMMERCE_JOBS_LIMITS.attachmentsMax} {...form.register("fileIds")} /><span>{file.filename ?? t("files.unnamed")} · {t(`files.kind.${file.kind}`)}</span></label>)}
      {errors.fileIds?.message ? <p role="alert" className="text-sm text-destructive">{errors.fileIds.message}</p> : null}
    </fieldset>
  </form>
    {/* HORS du formulaire de candidature : le dépôt de pièce a son propre formulaire (A19). */}
    <JobFilesManager files={filesQuery.data ?? []} />
    <section className="grid gap-2 rounded-lg border border-border p-4"><h3 className="text-base font-semibold">{t("apply.consentTitle")}</h3><p className="text-sm">{t("apply.consentText")}</p>
      <label htmlFor={ids.consent} className="flex min-h-11 items-center gap-3"><input id={ids.consent} form={ids.form} type="checkbox" aria-invalid={errors.consent ? true : undefined} {...form.register("consent")} /><span>{t("apply.consentLabel")}</span></label>
      {errors.consent?.message ? <p role="alert" className="text-sm text-destructive">{errors.consent.message}</p> : null}
    </section>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button type="submit" form={ids.form} variant="commerce" pending={form.formState.isSubmitting} className="justify-self-start"><Send aria-hidden="true" className="size-4" />{t("apply.submit")}</Button>
  </section></Card>
}
