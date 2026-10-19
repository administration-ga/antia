"use client"

import { api } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import { COMMERCE_SERVICE_CONSENTS, COMMERCE_SERVICE_LIMITS } from "@antsia/social-domain/commerce-services"
import type { ServiceOptionsResult } from "@convex/modules/shops/serviceRules"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, Card, Field, TextArea, TextInput } from "@/components/shared/controls"
import { ShopFrame, ShopLink, useShopAction } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"
import { contactNameOf, EMPTY_ORDER, newClientRequestId, orderSchema, serviceAmount, serviceToday, type OrderValues } from "./service-model"

type FixedOrder = NonNullable<Extract<ServiceOptionsResult, { outcome: "ready" }>["fixedOrder"]>

/** Commander une prestation à tarif fixe sans créneau : aucune réserve de stock, aucun paiement. */
export function ServiceOrderScreen({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("services")
  return <ShopFrame title={t("order.title")} lead={t("order.lead")}>
    <div className="flex flex-wrap gap-2"><ShopLink href={routes.shopOffer(handle, offerRef)}>{t("common.backToOffer")}</ShopLink><ShopLink href={routes.serviceRequests()}>{t("requests.title")}</ShopLink></div>
    <OrderOptions key={JSON.stringify([networkId, personId, handle, offerRef])} handle={handle} offerRef={offerRef} />
  </ShopFrame>
}

function OrderOptions({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const load = useAction(api.modules.shops.serviceActions.options)
  const action = useShopAction()
  const { run } = action
  const [options, setOptions] = useState<ServiceOptionsResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { void run(() => load({ networkId, handle, offerRef }), setOptions) }, [attempt, handle, load, networkId, offerRef, run])
  if (!options && !action.error) return <p role="status">{t("common.loading")}</p>
  if (!options || options.outcome !== "ready" || !options.fixedOrder) {
    return <Card><div className="grid gap-3" role="alert"><p>{action.error ?? t(options?.outcome === "refused" ? "offer.closed" : options?.outcome === "ready" ? "order.notOffered" : "common.unavailable")}</p><Button variant="outline" pending={action.pending} onClick={() => setAttempt((value) => value + 1)}>{t("offer.retry")}</Button></div></Card>
  }
  return <ServiceOrderForm handle={handle} offerRef={offerRef} fixedOrder={options.fixedOrder} />
}

/** Formulaire partagé avec la reconfirmation d'un nouveau tarif (`existingRequestRowId`). */
export function ServiceOrderForm({ handle, offerRef, fixedOrder, existingRequestRowId, initialQuantity }: { handle: string; offerRef: string; fixedOrder: Pick<FixedOrder, "unitAmount" | "unit" | "catalogRevision" | "quantityMax" | "leadTimeDays">; existingRequestRowId?: string; initialQuantity?: number }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("services")
  const id = useId()
  const router = useRouter()
  const order = useAction(api.modules.shops.serviceActions.orderService)
  const action = useShopAction()
  const [clientRequestId] = useState(newClientRequestId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<OrderValues>({ resolver: zodResolver(orderSchema(t, fixedOrder.quantityMax)), defaultValues: { ...EMPTY_ORDER, quantity: String(initialQuantity ?? 1) } })
  const errors = form.formState.errors
  const locale = i18n.resolvedLanguage ?? "fr"
  const quantity = Number(form.watch("quantity"))
  const total = Number.isSafeInteger(quantity) && quantity > 0 ? quantity * fixedOrder.unitAmount.amount : null
  const submit = form.handleSubmit((values) => {
    setFailure(null)
    const contactName = contactNameOf(values)
    void action.run(() => order({
      networkId, handle, offerRef, quantity: Number(values.quantity), expectedUnitAmount: { ...fixedOrder.unitAmount }, expectedCatalogRevision: fixedOrder.catalogRevision,
      consentTextVersion: COMMERCE_SERVICE_CONSENTS.service_order.textVersion, clientRequestId,
      ...(values.desiredDate ? { desiredDate: values.desiredDate } : {}), ...(values.note ? { note: values.note } : {}), ...(contactName ? { contactName } : {}),
      ...(existingRequestRowId ? { existingRequestRowId } : {}),
    }), (result) => {
      if (result.outcome === "request") router.push(routes.serviceRequest(result.requestRowId))
      else setFailure(result.outcome === "refused" ? "order.refused" : "common.unavailable")
    })
  })
  return <Card><form noValidate className="grid gap-4" onSubmit={submit} aria-busy={action.pending || undefined}>
    <p className="text-lg font-semibold">{fixedOrder.unit ? t("offer.fixedPriceUnit", { amount: serviceAmount(fixedOrder.unitAmount.amount, locale), unit: fixedOrder.unit }) : t("offer.fixedPrice", { amount: serviceAmount(fixedOrder.unitAmount.amount, locale) })}</p>
    {fixedOrder.leadTimeDays !== null ? <p className="text-sm text-muted-foreground">{t("order.leadTime", { count: fixedOrder.leadTimeDays })}</p> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${id}-quantity`} label={t("order.quantity")} hint={t("order.quantityHint", { max: fixedOrder.quantityMax })} error={errors.quantity?.message}><TextInput id={`${id}-quantity`} inputMode="numeric" autoComplete="off" aria-invalid={errors.quantity ? true : undefined} {...form.register("quantity")} /></Field>
      <Field id={`${id}-date`} label={t("order.desiredDate")} hint={t("order.desiredDateHint")} error={errors.desiredDate?.message}><TextInput id={`${id}-date`} type="date" min={serviceToday()} aria-invalid={errors.desiredDate ? true : undefined} {...form.register("desiredDate")} /></Field>
    </div>
    <Field id={`${id}-note`} label={t("order.note")} hint={t("order.noteHint", { max: COMMERCE_SERVICE_LIMITS.noteMax })} error={errors.note?.message}><TextArea id={`${id}-note`} aria-invalid={errors.note ? true : undefined} {...form.register("note")} /></Field>
    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="text-sm font-medium sm:col-span-2">{t("contact.legend")}</legend>
      <Field id={`${id}-first`} label={t("contact.firstName")} error={errors.firstName?.message}><TextInput id={`${id}-first`} autoComplete="given-name" {...form.register("firstName")} /></Field>
      <Field id={`${id}-last`} label={t("contact.lastName")} hint={t("contact.lastNameHint")} error={errors.lastName?.message}><TextInput id={`${id}-last`} autoComplete="family-name" {...form.register("lastName")} /></Field>
      <p className="text-xs text-muted-foreground sm:col-span-2">{t("contact.hint")}</p>
    </fieldset>
    {total !== null ? <p role="status" className="font-medium">{t("order.total", { amount: serviceAmount(total, locale) })}</p> : null}
    <p className="text-xs text-muted-foreground">{t("order.noStock")}</p>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4" aria-invalid={errors.consent ? true : undefined} {...form.register("consent")} /><span>{t("consents.serviceOrder")}</span></label>
    {errors.consent?.message ? <p role="alert" className="text-sm text-destructive">{errors.consent.message}</p> : null}
    <Button type="submit" pending={action.pending}>{t(existingRequestRowId ? "order.reconfirm" : "order.submit")}</Button>
    {failure ? <p role="alert">{t(failure)}</p> : null}
    {action.error ? <p role="alert">{action.error}</p> : null}
  </form></Card>
}
