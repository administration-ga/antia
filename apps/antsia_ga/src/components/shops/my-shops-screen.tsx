"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { useId } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button, Card, CenteredStatus, Field, TextInput } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import { SHOP_FORM_LIMITS, SHOP_MODELS, startShopSchema, type StartShopValues } from "./shop-model"
import { ShopFrame, ShopLink, ShopLogo, ShopQueryFailure, SHOP_SELECT_CLASS, useShopAction, useShopDirtyGuard } from "./shop-ui"

export function MyShopsScreen() {
  const { networkId, personId } = useNetwork()
  return <MyShopsContent key={`${networkId}:${personId}`} />
}

function MyShopsContent() {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const shops = useAuthenticatedConvexQuery(api.modules.shops.shops.myShops, { networkId })
  return <ShopFrame title={t("list.title")} lead={t("list.lead")}>
    <ShopLink href={routes.me()}>{t("common.profile")}</ShopLink>
    {shops.isError ? <ShopQueryFailure href={routes.me()} retry={() => void shops.refetch()} /> : shops.data === undefined ? <CenteredStatus label={t("common.loading")} /> : <>
      {shops.data.items.length === 0 ? <Card><p>{t("list.empty")}</p></Card> : <ul className="grid gap-3">{shops.data.items.map((shop) => <li key={shop.shopId}><Card><div className="flex min-w-0 flex-wrap items-start gap-4"><ShopLogo url={shop.logoUrl} name={shop.name ?? t("list.untitled")} /><div className="grid min-w-0 flex-1 gap-2"><h2 className="text-lg font-semibold">{shop.name ?? t("list.untitled")}</h2><p className="text-sm text-muted-foreground">{t(`models.${shop.model}`)} · {t(`states.${shop.storefront}`)}</p><div className="flex flex-wrap gap-2"><ShopLink href={routes.shopEditor(String(shop.shopId))}>{t("list.manage")}</ShopLink>{shop.pageHandle && shop.storefront === "published" ? <ShopLink href={routes.storefront(shop.pageHandle)}>{t("storefront.viewStorefront")}</ShopLink> : null}</div></div></div></Card></li>)}</ul>}
      {shops.data.truncated ? <p role="status" className="text-sm text-muted-foreground">{t("list.truncated")}</p> : null}
    </>}
    <StartShopForm />
  </ShopFrame>
}

function StartShopForm() {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const router = useRouter()
  const id = useId()
  const action = useShopAction()
  const start = useMutation(api.modules.shops.shops.startShop)
  const pages = useAuthenticatedConvexQuery(api.modules.shops.shops.eligibleShopPages, { networkId })
  const form = useForm<StartShopValues>({ resolver: zodResolver(startShopSchema(t)), defaultValues: { model: "products", name: "", pageId: "" } })
  const pageId = useWatch({ control: form.control, name: "pageId" })
  useShopDirtyGuard(form.formState.isDirty)
  return <Card><form noValidate aria-labelledby={`${id}-title`} className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
    if (values.pageId && (pages.isError || !pages.data?.items.some((page) => page.pageId === values.pageId))) { form.setError("pageId", { message: t("start.pageUnavailable") }); return }
    await action.run(() => start({ networkId, model: values.model, ...(values.pageId ? { pageId: values.pageId as Id<"pages"> } : { name: values.name }) }), (created) => router.push(routes.shopEditor(String(created.shopId))))
  })}>
    <h2 id={`${id}-title`} className="text-lg font-semibold">{t("start.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("start.lead")}</p>
    <fieldset disabled={action.pending} className="grid gap-3"><legend className="mb-2 text-sm font-medium">{t("activity.model")}</legend><div className="grid gap-3 sm:grid-cols-2">{SHOP_MODELS.map((model) => <label key={model} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4"><input type="radio" value={model} className="mt-1 size-4 accent-primary" {...form.register("model")} /><span><span className="block font-medium">{t(`models.${model}`)}</span><span className="text-sm text-muted-foreground">{t(`modelDescriptions.${model}`)}</span></span></label>)}</div></fieldset>
    <Field id={`${id}-page`} label={t("start.page")} hint={t("start.pageHint")} error={form.formState.errors.pageId?.message}>
      <select id={`${id}-page`} className={SHOP_SELECT_CLASS} disabled={action.pending || pages.data === undefined || pages.isError} aria-describedby={`${id}-page-hint`} {...form.register("pageId")}><option value="">{t("start.newDraft")}</option>{!pages.isError ? pages.data?.items.map((page) => <option key={page.pageId} value={page.pageId}>{page.name} · @{page.handle}</option>) : null}</select>
    </Field>
    {pages.isError ? <div role="status"><p>{t("start.pagesError")}</p><Button type="button" variant="ghost" onClick={() => void pages.refetch()}>{t("common.retry")}</Button></div> : pages.data?.truncated ? <p role="status" className="text-sm text-muted-foreground">{t("start.pagesTruncated")}</p> : null}
    {!pageId ? <Field id={`${id}-name`} label={t("fields.name")} error={form.formState.errors.name?.message}><TextInput id={`${id}-name`} autoComplete="organization" maxLength={SHOP_FORM_LIMITS.nameMax} disabled={action.pending} aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} /></Field> : null}
    {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
    <Button type="submit" pending={action.pending} className="justify-self-start">{t(action.pending ? "start.creating" : "start.submit")}</Button>
  </form></Card>
}
