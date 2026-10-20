"use client"

import { api } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import { isMimeAllowedForUsage, UPLOAD_USAGES } from "@antsia/social-domain/uploadPolicy"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useEffect, useId, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button, Field, TextArea, TextInput } from "@/components/shared/controls"
import { presentationSchema, presentationValues, SHOP_FORM_LIMITS, type PresentationValues, type ShopEditorData } from "./shop-model"
import { ShopLogo, useShopAction } from "./shop-ui"

export function ShopPresentationForm({ shop, onDirty }: { shop: ShopEditorData; onDirty: (dirty: boolean) => void }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const action = useShopAction()
  const update = useMutation(api.modules.shops.shops.updateShop)
  const id = useId()
  const form = useForm<PresentationValues>({ resolver: zodResolver(presentationSchema(t)), defaultValues: presentationValues(shop) })
  const receivedVersion = useRef(shop.updatedAt)
  const [saved, setSaved] = useState(false)
  const [logoDirty, setLogoDirty] = useState(false)
  const preview = useWatch({ control: form.control })
  useEffect(() => { onDirty(form.formState.isDirty || logoDirty) }, [form.formState.isDirty, logoDirty, onDirty])
  useEffect(() => {
    if (receivedVersion.current === shop.updatedAt) return
    receivedVersion.current = shop.updatedAt
    if (!form.formState.isDirty) form.reset(presentationValues(shop))
  }, [form, shop])
  return <div className="grid min-w-0 gap-6 xl:grid-cols-2">
    <form noValidate className="antsia-form-grid" aria-labelledby={`${id}-title`} onSubmit={form.handleSubmit(async (values) => {
      setSaved(false)
      await action.run(() => update({ networkId, shopId: shop.shopId, ...values }), () => { form.reset(values); setSaved(true) })
    })}>
      <h2 id={`${id}-title`} className="antsia-subtitle">{t("steps.presentation")}</h2>
      <p className="text-sm text-muted-foreground">{t(shop.page ? "presentation.pageIdentity" : "presentation.lead")}</p>
      {(["name", "description", "specialty", "serviceArea", "hours"] as const).map((field) => {
        const error = form.formState.errors[field]?.message
        const maximum = field === "name" ? SHOP_FORM_LIMITS.nameMax : field === "description" ? SHOP_FORM_LIMITS.descriptionMax : field === "specialty" ? SHOP_FORM_LIMITS.specialtyMax : field === "serviceArea" ? SHOP_FORM_LIMITS.serviceAreaMax : SHOP_FORM_LIMITS.hoursMax
        return <Field key={field} id={`${id}-${field}`} label={t(`fields.${field}`)} hint={field === "description" || field === "serviceArea" ? t(`presentation.${field}Hint`) : undefined} error={error}>{field === "description" ? <TextArea id={`${id}-${field}`} maxLength={maximum} disabled={action.pending} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-${field}-error` : `${id}-${field}-hint`} {...form.register(field)} /> : <TextInput id={`${id}-${field}`} maxLength={maximum} disabled={action.pending} autoComplete={field === "name" ? "organization" : "off"} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-${field}-error` : field === "serviceArea" ? `${id}-${field}-hint` : undefined} {...form.register(field)} />}</Field>
      })}
      {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
      {saved && !form.formState.isDirty ? <p role="status" className="text-sm">{t("common.saved")}</p> : null}
      <Button type="submit" pending={action.pending} disabled={!form.formState.isDirty} className="w-full sm:w-auto sm:justify-self-start">{t("common.save")}</Button>
    </form>
    <PresentationPreview values={{ ...presentationValues(shop), ...preview }} logoUrl={shop.logo.url} />
    <ShopLogoForm shop={shop} onDirty={setLogoDirty} />
  </div>
}

export function PresentationPreview({ values, logoUrl }: { values: PresentationValues; logoUrl: string | null }) {
  const { t } = useTranslation("shops")
  const [mode, setMode] = useState<"phone" | "desktop">("phone")
  return <section className="grid min-w-0 gap-3 self-start" aria-label={t("preview.title")}><h3 className="font-display text-base font-bold leading-snug">{t("preview.title")}</h3><p className="text-sm text-muted-foreground">{t("preview.draft")}</p><div role="group" aria-label={t("preview.width")} className="flex flex-wrap gap-2">{(["phone", "desktop"] as const).map((item) => <Button key={item} type="button" variant={mode === item ? "primary" : "outline"} className="aria-pressed:bg-[var(--esp-tab-active-bg)] aria-pressed:text-[color:var(--esp-tab-active-fg)] aria-pressed:hover:bg-[var(--esp-tab-active-bg)]" aria-pressed={mode === item} onClick={() => setMode(item)}>{t(`preview.${item}`)}</Button>)}</div><div data-shop-preview={mode} className="mx-auto w-full rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-background p-[var(--esp-card-padding,16px)] [overflow-wrap:anywhere]" style={{ maxWidth: mode === "phone" ? 360 : undefined }}><div className="grid gap-4 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] text-card-foreground"><div className="flex items-start gap-3"><ShopLogo url={logoUrl} name={values.name} /><h4 className="min-w-0 text-lg font-semibold">{values.name || t("list.untitled")}</h4></div>{values.description ? <p className="whitespace-pre-wrap">{values.description}</p> : null}<dl className="grid gap-3">{(["specialty", "serviceArea", "hours"] as const).map((field) => values[field] ? <div key={field}><dt className="text-sm font-medium text-muted-foreground">{t(`fields.${field}`)}</dt><dd className="whitespace-pre-wrap">{values[field]}</dd></div> : null)}</dl></div></div></section>
}

function ShopLogoForm({ shop, onDirty }: { shop: ShopEditorData; onDirty: (dirty: boolean) => void }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const action = useShopAction()
  const generate = useMutation(api.modules.shops.shops.generateShopLogoUploadUrl)
  const attach = useMutation(api.modules.shops.shops.setShopLogo)
  const [file, setFile] = useState<File | null>(null)
  const [resultNote, setResultNote] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  useEffect(() => { onDirty(file !== null) }, [file, onDirty])
  const upload = async () => {
    if (!file) return
    await action.run(async () => {
      const url = await generate({ networkId })
      if (!action.current()) return
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })
      if (!response.ok) throw new Error("upload")
      const data: unknown = await response.json()
      if (!action.current()) return
      if (!data || typeof data !== "object" || !("storageId" in data) || typeof data.storageId !== "string") throw new Error("upload")
      return await attach({ networkId, shopId: shop.shopId, storageId: data.storageId as import("@antsia/api/engine").Id<"_storage">, mimeType: file.type })
    }, (result) => {
      if (!result) return
      setFile(null)
      if (input.current) input.current.value = ""
      setResultNote(result.withheld ? t(`errors:${result.withheld}`) : t("presentation.logoSaved"))
    })
  }
  return <section aria-labelledby={`${id}-title`} className="grid min-w-0 gap-3 border-t border-border pt-4 xl:col-span-2">
    <h3 id={`${id}-title`} className="font-display text-base font-bold leading-snug">{t("presentation.logo")}</h3>
    <ShopLogo url={shop.logo.url} name={shop.name ?? ""} />
    {shop.logo.withheld ? <p role="status" className="text-sm">{t(`errors:${shop.logo.withheld}`)}</p> : shop.logo.present && !shop.logo.url ? <p className="text-sm">{t("presentation.logoUnavailable")}</p> : null}
    <Field id={id} label={t("presentation.pickLogo")} hint={t("presentation.logoHint")}>
      <input id={id} ref={input} type="file" accept={UPLOAD_USAGES.page_logo.mimeTypes.join(",")} disabled={action.pending} className="min-h-11 w-full rounded-[var(--esp-field-radius)] border border-input bg-muted px-3 py-2 text-base" aria-describedby={`${id}-hint`} onChange={(event) => {
        const chosen = event.currentTarget.files?.[0] ?? null
        setResultNote(null)
        if (chosen && (!isMimeAllowedForUsage("page_logo", chosen.type) || chosen.size <= 0 || chosen.size > UPLOAD_USAGES.page_logo.maxBytes)) { action.setError(t("presentation.logoInvalid")); setFile(null); return }
        action.setError(null)
        setFile(chosen)
      }} />
    </Field>
    {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
    {resultNote ? <p role="status" className="text-sm">{resultNote}</p> : null}
    <Button type="button" variant="outline" pending={action.pending} disabled={!file} onClick={() => void upload()} className="w-full sm:w-auto sm:justify-self-start">{t("presentation.uploadLogo")}</Button>
  </section>
}
