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
import { SHOP_SELECT_CLASS, ShopFrame, ShopLink, useShopAction } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"
import { bookingSchema, contactNameOf, EMPTY_BOOKING, newClientRequestId, serviceDurationMinutes, type BookingValues } from "./service-model"
import { ServiceSlotPicker, type PickedSlot } from "./service-slot-picker"

type Bookable = NonNullable<Extract<ServiceOptionsResult, { outcome: "ready" }>["booking"]>["services"][number]

/** Choisir un créneau : prestation de l'agenda PRO.GA, créneau libre, conséquences, accord. */
export function ServiceBookingScreen({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("services")
  return <ShopFrame title={t("booking.title")} lead={t("booking.lead")}>
    <div className="flex flex-wrap gap-2"><ShopLink href={routes.shopOffer(handle, offerRef)}>{t("common.backToOffer")}</ShopLink><ShopLink href={routes.serviceRequests()}>{t("requests.title")}</ShopLink></div>
    <BookingOptions key={JSON.stringify([networkId, personId, handle, offerRef])} handle={handle} offerRef={offerRef} />
  </ShopFrame>
}

function BookingOptions({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const load = useAction(api.modules.shops.serviceActions.options)
  const action = useShopAction()
  const { run } = action
  const [options, setOptions] = useState<ServiceOptionsResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { void run(() => load({ networkId, handle, offerRef }), setOptions) }, [attempt, handle, load, networkId, offerRef, run])
  if (!options && !action.error) return <p role="status">{t("common.loading")}</p>
  if (!options || options.outcome !== "ready" || !options.booking) {
    return <Card><div className="grid gap-3" role="alert"><p>{action.error ?? t(options?.outcome === "refused" ? "offer.closed" : options?.outcome === "ready" ? "booking.notOffered" : "common.unavailable")}</p><Button variant="outline" pending={action.pending} onClick={() => setAttempt((value) => value + 1)}>{t("offer.retry")}</Button></div></Card>
  }
  return <BookingFlow handle={handle} offerRef={offerRef} services={options.booking.services} />
}

function BookingFlow({ handle, offerRef, services }: { handle: string; offerRef: string; services: Bookable[] }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const id = useId()
  const router = useRouter()
  const book = useAction(api.modules.shops.serviceActions.book)
  const action = useShopAction()
  const [serviceRef, setServiceRef] = useState(services[0]?.serviceRef ?? "")
  const [slot, setSlot] = useState<PickedSlot | null>(null)
  const [clientRequestId, setClientRequestId] = useState(newClientRequestId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<BookingValues>({ resolver: zodResolver(bookingSchema(t)), defaultValues: EMPTY_BOOKING })
  const service = services.find((item) => item.serviceRef === serviceRef) ?? null
  const errors = form.formState.errors
  // Un autre créneau ou une autre prestation est une autre intention : nouvelle clé, nouvel accord.
  const pick = (next: PickedSlot) => { setSlot(next); setClientRequestId(newClientRequestId()); form.setValue("consent", false) }
  const submit = form.handleSubmit((values) => {
    if (!service || !slot) return
    setFailure(null)
    const contactName = contactNameOf(values)
    void action.run(() => book({
      networkId, handle, offerRef, serviceRef: service.serviceRef, serviceLabel: service.label, resourceRef: slot.resourceRef, startAt: slot.startAt, endAt: slot.endAt,
      consentTextVersion: COMMERCE_SERVICE_CONSENTS.booking.textVersion, clientRequestId, ...(values.note ? { note: values.note } : {}), ...(contactName ? { contactName } : {}),
    }), (result) => {
      if (result.outcome === "request") router.push(routes.serviceRequest(result.requestRowId))
      else setFailure(result.outcome === "refused" ? "booking.refused" : "common.unavailable")
    })
  })
  return <div className="grid gap-5">
    <Card><div className="grid gap-3">
      <Field id={`${id}-service`} label={t("booking.service")}><select id={`${id}-service`} className={SHOP_SELECT_CLASS} value={serviceRef} onChange={(event) => { setServiceRef(event.target.value); setSlot(null); setClientRequestId(newClientRequestId()) }}>{services.map((item) => <option key={item.serviceRef} value={item.serviceRef}>{t("booking.serviceOption", { label: item.label, duration: serviceDurationMinutes(item.durationMinutes, t) })}</option>)}</select></Field>
      {service?.description ? <p className="text-sm text-muted-foreground">{service.description}</p> : null}
      {service ? <ul className="grid gap-1 text-sm">
        <li>{service.autoConfirm ? t("booking.autoConfirm") : t("booking.hold", { duration: serviceDurationMinutes(service.holdMinutes, t) })}</li>
        <li>{service.minNoticeMinutes > 0 ? t("booking.changeNotice", { duration: serviceDurationMinutes(service.minNoticeMinutes, t) }) : t("booking.changeUntilStart")}</li>
        <li>{t("booking.cancelUntilStart")}</li>
        <li>{t("booking.noDeposit")}</li>
      </ul> : null}
    </div></Card>
    {service ? <Card><ServiceSlotPicker key={service.serviceRef} handle={handle} offerRef={offerRef} serviceRef={service.serviceRef} selected={slot} onPick={pick} /></Card> : null}
    {service && slot ? <Card><form noValidate className="grid gap-4" onSubmit={submit} aria-busy={action.pending || undefined}>
      <Field id={`${id}-note`} label={t("booking.note")} hint={t("booking.noteHint", { max: COMMERCE_SERVICE_LIMITS.noteMax })} error={errors.note?.message}><TextArea id={`${id}-note`} aria-invalid={errors.note ? true : undefined} {...form.register("note")} /></Field>
      <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="text-sm font-medium sm:col-span-2">{t("contact.legend")}</legend>
        <Field id={`${id}-first`} label={t("contact.firstName")} error={errors.firstName?.message}><TextInput id={`${id}-first`} autoComplete="given-name" {...form.register("firstName")} /></Field>
        <Field id={`${id}-last`} label={t("contact.lastName")} hint={t("contact.lastNameHint")} error={errors.lastName?.message}><TextInput id={`${id}-last`} autoComplete="family-name" {...form.register("lastName")} /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">{t("contact.hint")}</p>
      </fieldset>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4" aria-invalid={errors.consent ? true : undefined} {...form.register("consent")} /><span>{t("consents.booking")}</span></label>
      {errors.consent?.message ? <p role="alert" className="text-sm text-destructive">{errors.consent.message}</p> : null}
      <Button type="submit" pending={action.pending}>{t("booking.submit")}</Button>
      {failure ? <p role="alert">{t(failure)}</p> : null}
      {action.error ? <p role="alert">{action.error}</p> : null}
    </form></Card> : null}
  </div>
}
