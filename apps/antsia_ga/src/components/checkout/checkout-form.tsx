"use client"

import type { CommerceCheckoutLineInput, CommerceFulfillment } from "@antsia/social-domain/commerce/command"
import { COMMERCE_MAX_AMOUNT_XAF } from "@antsia/social-domain/commerce/primitives"
import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import type { CheckoutActionResult, CheckoutOptionsResult } from "@convex/modules/shops/checkoutRules"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button, Card, Field, TextInput } from "@/components/shared/controls"
import { FORM_FIELDS, SCREEN_SECTIONS } from "@/components/shared/screen-layout"
import { SHOP_SELECT_CLASS, useShopAction } from "@/components/shops/shop-ui"
import { useCartConnectivity } from "@/components/cart/use-cart-draft"
import { checkoutAmount, checkoutCartLines, checkoutFormSchema, checkoutUnitAmount, EMPTY_CHECKOUT_FORM, type CheckoutFormValues } from "./checkout-model"

export type CheckoutOptions = Extract<CheckoutOptionsResult, { outcome: "ready" }>
export type CheckoutPrepareInput = { lines: CommerceCheckoutLineInput[]; fulfillment: CommerceFulfillment; consentTextVersion: string; clientRequestId: string; expectedPolicyVersion: number }
export type CheckoutCartLine = { offer: CatalogOffer; variantRef?: string; quantity: number }

/**
 * P18b (A16, WCAG 1.3.5) : la finalité de chaque champ d'adresse, pour le
 * remplissage du NAVIGATEUR de la personne (jetons `shipping …`). Rien n'est
 * relu du profil social ni envoyé avant l'envoi explicite du formulaire ; les
 * instructions de remise, propres à cette commande, restent sans jeton.
 */
export const CHECKOUT_ADDRESS_AUTOCOMPLETE = {
  country: "shipping country",
  locality: "shipping address-level2",
  line1: "shipping address-line1",
  line2: "shipping address-line2",
  instructions: "off",
} as const

export function CheckoutPreparationForm({ offer, cartLines, options, consentTextVersion, prepare, onAttempt, onIntent, beforeResume, suspended = false, consentEpoch = "", recoveredRequestId }: { offer: CatalogOffer; cartLines?: readonly CheckoutCartLine[]; options: CheckoutOptions; consentTextVersion: string; prepare: (input: CheckoutPrepareInput) => Promise<CheckoutActionResult>; onAttempt: (attemptId: string) => void; onIntent?: (input: CheckoutPrepareInput) => boolean | Promise<boolean>; beforeResume?: (input: CheckoutPrepareInput) => Promise<CheckoutActionResult | { outcome: "absent" }>; suspended?: boolean; consentEpoch?: string; recoveredRequestId?: string }) {
  const { t, i18n } = useTranslation("checkout")
  const locale = i18n.resolvedLanguage ?? "fr"
  const id = useId()
  const action = useShopAction()
  const connectivity = useCartConnectivity()
  const [intent, setIntent] = useState<CheckoutPrepareInput | null>(null)
  const intentRef = useRef<CheckoutPrepareInput | null>(null)
  const [refused, setRefused] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [savingIntent, setSavingIntent] = useState(false)
  const form = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutFormSchema(t)), defaultValues: EMPTY_CHECKOUT_FORM })
  const { setValue } = form
  useEffect(() => { if (!intentRef.current) setValue("consent", false) }, [consentTextVersion, consentEpoch, connectivity.generation, setValue])
  const values = form.watch()
  // Le prix unitaire d'une offre SEULE. Un panier porte celui de CHAQUE ligne,
  // variante comprise : la sélection de variante de ce formulaire ne le concerne pas.
  const amount = cartLines ? undefined : intent?.lines[0]?.expectedUnitAmount.amount ?? checkoutUnitAmount(offer, values.variantRef)
  const quantity = intent?.lines[0]?.quantity ?? (/^[1-9]\d{0,2}$/.test(values.quantity) ? Number(values.quantity) : null)
  // `null` dès qu'une ligne n'a pas de prix exact : rien n'est alors préparable.
  const cartPrepared = cartLines ? checkoutCartLines(cartLines) : null
  const preparedLines = intent?.lines ?? cartPrepared
  const lineAmount = preparedLines ? preparedLines.reduce((sum, line) => sum + line.expectedUnitAmount.amount * line.quantity, 0) : amount !== undefined && quantity !== null ? amount * quantity : null
  const fees = [...options.fees, ...(values.fulfillmentMode === "seller_delivery" && options.sellerDelivery ? [{ amount: options.sellerDelivery.fee, label: options.sellerDelivery.label, kind: "delivery" as const }] : [])]
  const total = lineAmount === null ? null : lineAmount + fees.reduce((sum, fee) => sum + fee.amount.amount, 0)
  const validTotal = total !== null && Number.isSafeInteger(total) && total >= 0 && total <= COMMERCE_MAX_AMOUNT_XAF
  const locked = action.pending || savingIntent || intent !== null || refused
  const send = (input: CheckoutPrepareInput, resume = false) => {
    void action.run(async () => {
      if (!connectivity.online || !navigator.onLine || suspended) throw new Error("checkoutSuspended")
      if (resume && beforeResume) { const found = await beforeResume(input); if (found.outcome !== "absent") return found }
      if (!action.current() || !navigator.onLine || suspended) throw new Error("checkoutSuspended")
      return await prepare(input)
    }, (result) => { if (result.outcome === "attempt") onAttempt(result.attemptId); else if (result.outcome === "refused") setRefused(true); else setUncertain(true) })
  }
  const submit = form.handleSubmit(async (input) => {
    if (locked || intentRef.current || suspended || !connectivity.online || !navigator.onLine || !validTotal) return
    const selected = offer.variants.find((candidate) => candidate.variantRef === input.variantRef)
    if (!cartLines && offer.variants.length && !selected) { form.setError("variantRef", { message: t("validation.choiceChanged") }); return }
    const unitAmount = selected?.amount ?? (offer.price.mode === "fixed" || offer.price.mode === "unit" ? offer.price.amount : undefined)
    if (!cartLines && unitAmount === undefined) { form.setError("variantRef", { message: t("notPurchasable") }); return }
    if (cartLines && (cartLines.length < 1 || cartLines.length > 10 || cartLines.some((line) => line.offer.shopHandle !== offer.shopHandle || line.offer.price.mode === "quote" || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999 || (line.variantRef ? !line.offer.variants.some((variant) => variant.variantRef === line.variantRef) : line.offer.variants.length > 0 || !["fixed", "unit"].includes(line.offer.price.mode))))) { form.setError("variantRef", { message: t("validation.choiceChanged") }); return }
    if (input.fulfillmentMode === "pickup" && !options.pickup.some((entry) => entry.establishmentRef === input.establishmentRef)) { form.setError("establishmentRef", { message: t("validation.choiceChanged") }); return }
    if (input.fulfillmentMode === "seller_delivery" && !options.sellerDelivery) { form.setError("fulfillmentMode", { message: t("validation.choiceChanged") }); return }
    const fulfillment: CommerceFulfillment = input.fulfillmentMode === "pickup"
      ? { mode: "pickup", establishmentRef: input.establishmentRef }
      : { mode: "seller_delivery", address: { country: input.country, locality: input.locality, line1: input.line1, ...(input.line2 ? { line2: input.line2 } : {}) }, ...(input.instructions ? { instructions: input.instructions } : {}) }
    const next: CheckoutPrepareInput = { lines: preparedLines ?? [{ offerRef: offer.offerRef, ...(selected ? { variantRef: selected.variantRef } : {}), quantity: Number(input.quantity), expectedCatalogRevision: offer.revision, expectedUnitAmount: { amount: unitAmount!, currency: "XAF" } }], fulfillment, consentTextVersion, clientRequestId: recoveredRequestId ?? crypto.randomUUID(), expectedPolicyVersion: options.policyVersion }
    intentRef.current = next
    if (onIntent) {
      setSavingIntent(true)
      let admitted = false
      try { admitted = await onIntent(next) } catch { admitted = false }
      if (!action.current()) return
      setSavingIntent(false)
      if (!admitted) { setRefused(true); return }
    }
    setIntent(next)
    send(next, recoveredRequestId !== undefined)
  })
  const errorFor = (name: keyof CheckoutFormValues) => form.formState.errors[name]?.message
  return <Card><form onSubmit={submit} noValidate className="grid gap-5">
    <h2 className="text-xl font-semibold">{cartLines ? t("cart:prepareTitle") : offer.title}</h2>{cartLines ? <ul className="grid gap-2 text-sm">{cartLines.map((line, index) => <li key={index}>{line.offer.title} × {line.quantity}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("revision", { revision: intent?.lines[0]?.expectedCatalogRevision ?? offer.revision })}</p>}
    <div className={`${SCREEN_SECTIONS} gap-y-5`}>
      <fieldset disabled={locked || suspended || !connectivity.online} className="grid min-w-0 gap-5">
        <div className={`${FORM_FIELDS} gap-y-5 empty:hidden`}>
          {!cartLines && offer.variants.length ? <Field id={`${id}-variant`} label={t("variant")} error={errorFor("variantRef")}><select id={`${id}-variant`} className={SHOP_SELECT_CLASS} aria-invalid={!!errorFor("variantRef")} {...form.register("variantRef")}><option value="">{t("choose")}</option>{offer.variants.map((entry) => <option key={entry.variantRef} value={entry.variantRef}>{entry.label} — {checkoutAmount(entry.amount, locale)}</option>)}</select></Field> : null}
          {!cartLines ? <Field id={`${id}-quantity`} label={t("quantity")} hint={t("quantityHint")} error={errorFor("quantity")}><TextInput id={`${id}-quantity`} inputMode="numeric" type="text" autoComplete="off" aria-invalid={!!errorFor("quantity")} aria-describedby={`${id}-quantity-hint`} {...form.register("quantity")} /></Field> : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("optionsLead")}</p>
        <div className={`${FORM_FIELDS} gap-y-5`}>
          <Field id={`${id}-mode`} label={t("fulfillment")} error={errorFor("fulfillmentMode")}><select id={`${id}-mode`} className={SHOP_SELECT_CLASS} aria-invalid={!!errorFor("fulfillmentMode")} {...form.register("fulfillmentMode")}><option value="">{t("choose")}</option>{options.pickup.length ? <option value="pickup">{t("pickup")}</option> : null}{options.sellerDelivery ? <option value="seller_delivery">{t("seller_delivery")}</option> : null}</select></Field>
          {values.fulfillmentMode === "pickup" ? <Field id={`${id}-establishment`} label={t("establishment")} error={errorFor("establishmentRef")}><select id={`${id}-establishment`} className={SHOP_SELECT_CLASS} aria-invalid={!!errorFor("establishmentRef")} {...form.register("establishmentRef")}><option value="">{t("choose")}</option>{options.pickup.map((entry) => <option key={entry.establishmentRef} value={entry.establishmentRef}>{entry.label}</option>)}</select></Field> : null}
        </div>
        {values.fulfillmentMode === "seller_delivery" ? <div className={`${FORM_FIELDS} gap-y-4`}><p className="col-span-full text-sm text-muted-foreground">{t("addressHint")}</p><Field id={`${id}-country`} label={t("country")} error={errorFor("country")}><select id={`${id}-country`} className={SHOP_SELECT_CLASS} autoComplete={CHECKOUT_ADDRESS_AUTOCOMPLETE.country} {...form.register("country")}><option value="">{t("choose")}</option><option value="GA">{t("gabon")}</option></select></Field>{(["locality", "line1", "line2", "instructions"] as const).map((name) => <Field key={name} id={`${id}-${name}`} label={t(name)} error={errorFor(name)}><TextInput id={`${id}-${name}`} autoComplete={CHECKOUT_ADDRESS_AUTOCOMPLETE[name]} aria-invalid={!!errorFor(name)} {...form.register(name)} /></Field>)}</div> : null}
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" {...form.register("consent")} />{t("consent")}</label>{errorFor("consent") ? <p role="alert" className="text-sm text-destructive">{errorFor("consent")}</p> : null}<p className="text-xs text-muted-foreground">{t("consentVersion", { version: intent?.consentTextVersion ?? consentTextVersion })}</p>
      </fieldset>
      <section aria-labelledby={`${id}-summary`} className="grid gap-3 rounded-xl border border-border bg-background p-4"><h3 id={`${id}-summary`} className="font-semibold">{t("estimated")}</h3>{cartLines ? (preparedLines ? null : <p>{t("cart:notExact")}</p>) : amount !== undefined ? <p>{t("unitAmount")} : {checkoutAmount(amount, locale)}</p> : <p>{t("notPurchasable")}</p>}{lineAmount !== null ? <p>{cartLines ? t("cart:itemsAmount") : t("lineAmount")} : {checkoutAmount(lineAmount, locale)}</p> : null}<h4 className="font-medium">{t("fees")}</h4>{fees.length ? <ul className="grid gap-1">{fees.map((fee, index) => <li key={index}>{fee.label} : {checkoutAmount(fee.amount.amount, locale)}</li>)}</ul> : <p className="text-sm">{t("noFees")}</p>}{total !== null && values.fulfillmentMode ? <p className="font-semibold">{t("total")} : {checkoutAmount(total, locale)}</p> : null}<p className="text-sm text-muted-foreground">{t("unconfirmedTotal")}</p></section>
    </div>
    {!connectivity.online ? <p role="status">{t("cart:offline")}</p> : null}{suspended && connectivity.online ? <p role="status">{t("cart:refreshRequired")}</p> : null}
    {/* Un panier n'a pas de champ de variante : son refus d'envoi se dit ici, jamais en silence. */}
    {cartLines && errorFor("variantRef") ? <p role="alert" className="text-sm text-destructive">{errorFor("variantRef")}</p> : null}
    {/* Demander la préparation, et sa reprise : couleur du commerce (ADR-0027). */}
    {!intent ? <Button type="submit" variant="commerce" pending={action.pending} disabled={refused || (cartLines ? cartPrepared === null : amount === undefined) || !validTotal || suspended || !connectivity.online}>{t("prepare")}</Button> : <><p role="status" className="text-sm">{t("uncertainIntent")}</p>{(action.error || uncertain) && !refused ? <Button type="button" variant="commerce" pending={action.pending} disabled={suspended || !connectivity.online} onClick={() => send(intent, true)}>{t("retryIntent")}</Button> : null}</>}
    {action.error ? <p role="alert" className="text-sm text-destructive">{t("failed")}</p> : null}{refused ? <p role="alert" className="text-sm">{t("refused")}</p> : null}
  </form></Card>
}
