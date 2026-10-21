"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useEffect, useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button, Card, CenteredStatus } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import { EDITOR_STEPS, SHOP_MODELS, type EditorStep, type ShopEditorData } from "./shop-model"
import { ShopPresentationForm } from "./shop-presentation-form"
import { ShopCommerceLink } from "./shop-commerce-link"
import { CatalogReconcilePanel } from "./catalog-reconcile-panel"
import { CatalogPostLinker } from "./catalog-post-linker"
import { ContactTeamPanel } from "./contact-team-panel"
import { ShopPublicationForm } from "./shop-publication-form"
import { ShopFrame, ShopLink, ShopQueryFailure, useShopAction, useShopDirtyGuard } from "./shop-ui"

export function ShopEditorScreen({ shopId }: { shopId: string }) {
  const { networkId, personId } = useNetwork()
  return <ShopEditorQuery key={`${networkId}:${personId}:${shopId}`} shopId={shopId} />
}
function ShopEditorQuery({ shopId }: { shopId: string }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const query = useAuthenticatedConvexQuery(api.modules.shops.shops.getMyShop, { networkId, shopId: shopId as Id<"shops"> })
  return <ShopFrame title={t("editor.title")} lead={t("editor.lead")}><ShopLink href={routes.myShops()}>{t("list.title")}</ShopLink>{query.isError ? <ShopQueryFailure href={routes.myShops()} retry={() => void query.refetch()} /> : query.data === undefined ? <CenteredStatus label={t("common.loading")} /> : query.data === null ? <ShopQueryFailure href={routes.myShops()} /> : <ShopEditor shop={query.data} />}</ShopFrame>
}

export function ShopEditor({ shop }: { shop: ShopEditorData }) {
  const { t } = useTranslation("shops")
  const id = useId()
  const [step, setStep] = useState<EditorStep>("activity")
  const [presentationDirty, setPresentationDirty] = useState(false)
  const [activityDirty, setActivityDirty] = useState(false)
  const [audienceDirty, setAudienceDirty] = useState(false)
  const dirty = presentationDirty || activityDirty || audienceDirty
  useShopDirtyGuard(dirty)
  /**
   * P18b (A14, WCAG 2.4.3) : changer d'étape DEPUIS un panneau masquait le
   * bouton qui avait le focus, et le focus tombait sur `<body>`. Le titre du
   * panneau ouvert le reçoit désormais ; tout changement d'étape s'annonce
   * (« Étape 2 sur 4 : … ») par une région polie persistante.
   */
  const panels = useRef<Partial<Record<EditorStep, HTMLDivElement | null>>>({})
  const focusHeading = useRef(false)
  const [stepAnnouncement, setStepAnnouncement] = useState("")
  const goTo = (next: EditorStep, moveFocus: boolean) => {
    focusHeading.current = moveFocus
    setStep(next)
    setStepAnnouncement(t("editor.stepPosition", { current: EDITOR_STEPS.indexOf(next) + 1, total: EDITOR_STEPS.length, name: t(`steps.${next}`) }))
  }
  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    const heading = panels.current[step]?.querySelector<HTMLElement>("h2, h3")
    if (!heading) return
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
    heading.focus()
  }, [step])
  const panel = (item: EditorStep) => ({ id: `${id}-${item}`, hidden: step !== item, ref: (node: HTMLDivElement | null) => { panels.current[item] = node } })
  return <div className="antsia-page">
    <div className="flex flex-wrap items-center gap-3"><h2 className="antsia-subtitle">{shop.name ?? t("list.untitled")}</h2><span className="rounded-[var(--ui2-badge-radius)] bg-muted px-3 py-1 text-sm">{t(`states.${shop.storefront.state}`)}</span></div>
    <nav aria-label={t("editor.steps")} className="overflow-x-auto"><ol className="flex w-max min-w-full gap-2">{EDITOR_STEPS.map((item, index) => <li key={item} className="flex-1"><Button type="button" variant={step === item ? "primary" : "outline"} className="w-full aria-[current=step]:bg-[var(--esp-tab-active-bg)] aria-[current=step]:text-[color:var(--esp-tab-active-fg)] aria-[current=step]:hover:bg-[var(--esp-tab-active-bg)]" aria-current={step === item ? "step" : undefined} aria-controls={`${id}-${item}`} onClick={() => goTo(item, false)}>{index + 1}. {t(`steps.${item}`)}</Button></li>)}</ol></nav>
    <Card><div {...panel("activity")}><ShopActivityForm shop={shop} onDirty={setActivityDirty} onNext={() => goTo("presentation", true)} /></div><div {...panel("presentation")}><ShopPresentationForm shop={shop} onDirty={setPresentationDirty} /></div><div {...panel("offers")}><ShopOffers shop={shop} dirty={dirty} onPrepare={() => goTo("presentation", true)} /></div><div {...panel("publish")}><ShopPublicationForm shop={shop} dirty={presentationDirty || activityDirty} onDirty={setAudienceDirty} onPrepare={() => goTo("presentation", true)} /></div></Card>
    <p role="status" className="sr-only">{stepAnnouncement}</p>
    {dirty ? <p role="status" className="text-sm text-muted-foreground">{t("editor.unsaved")}</p> : null}
    <ContactTeamPanel shopId={shop.shopId} />
  </div>
}

const activitySchema = z.object({ model: z.enum(SHOP_MODELS) })
function ShopActivityForm({ shop, onDirty, onNext }: { shop: ShopEditorData; onDirty: (value: boolean) => void; onNext: () => void }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const action = useShopAction()
  const update = useMutation(api.modules.shops.shops.updateShop)
  const form = useForm<z.infer<typeof activitySchema>>({ resolver: zodResolver(activitySchema), defaultValues: { model: shop.model } })
  useEffect(() => { onDirty(form.formState.isDirty) }, [form.formState.isDirty, onDirty])
  useEffect(() => { if (!form.formState.isDirty) form.reset({ model: shop.model }) }, [form, shop.model])
  const [saved, setSaved] = useState(false)
  return <form noValidate className="antsia-form-grid" onChange={() => setSaved(false)} onSubmit={form.handleSubmit(async (values) => {
    await action.run(() => update({ networkId, shopId: shop.shopId, model: values.model }), () => { form.reset(values); onDirty(false); setSaved(true) })
  })}>
    <h2 className="antsia-subtitle">{t("steps.activity")}</h2><p>{t("activity.lead")}</p>
    <fieldset disabled={action.pending} className="grid gap-3"><legend className="mb-2 font-medium">{t("activity.model")}</legend>{SHOP_MODELS.map((model) => <label key={model} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--ui2-card-radius)] border border-border p-[var(--esp-card-padding,16px)]"><input type="radio" value={model} className="mt-1 size-4 accent-primary" {...form.register("model")} /><span><span className="block font-medium">{t(`models.${model}`)}</span><span className="text-sm text-muted-foreground">{t(`modelDescriptions.${model}`)}</span></span></label>)}</fieldset>
    <p className="text-sm text-muted-foreground">{shop.page ? t("activity.existingPage", { handle: shop.page.handle }) : t("activity.draftPage")}</p>
    {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}{saved ? <p role="status">{t("common.saved")}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="submit" pending={action.pending} disabled={!form.formState.isDirty}>{t("activity.save")}</Button><Button type="button" variant="outline" onClick={onNext}>{t("steps.presentation")}</Button></div>
  </form>
}

function ShopOffers({ shop, dirty, onPrepare }: { shop: ShopEditorData; dirty: boolean; onPrepare: () => void }) {
  const { t } = useTranslation("shops")
  return <section className="grid gap-4"><h2 className="antsia-subtitle">{t("steps.offers")}</h2><p>{t(shop.model === "products" ? "offers.products" : "offers.services")}</p><p className="text-sm text-muted-foreground">{t("offers.authority")}</p><ShopCommerceLink shopId={shop.shopId} dirty={dirty} /><CatalogReconcilePanel shopId={shop.shopId} dirty={dirty} />{shop.page ? <CatalogPostLinker shopId={shop.shopId} handle={shop.page.handle} dirty={dirty} /> : null}<ul className="grid gap-2">{shop.blocks.map((block) => <li key={block.id} className="rounded-[var(--ui2-card-radius)] border border-border p-[var(--esp-card-padding,16px)]"><span className="font-medium">{t(`blocks.${block.id}`)}</span><p className="text-sm text-muted-foreground">{t(`blockStates.${block.state}`)}</p></li>)}</ul><p>{t("offers.checkoutTitle")}</p><ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">{shop.checkout.missing.map((missing) => <li key={missing}>{t(`checkout.${missing}`)}</li>)}</ol><Button type="button" variant="outline" onClick={onPrepare} className="w-full sm:w-auto sm:justify-self-start">{t("publication.prepare")}</Button></section>
}
