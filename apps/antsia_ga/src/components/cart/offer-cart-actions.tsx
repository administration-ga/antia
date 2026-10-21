"use client"

import { browserAppPath } from "@/lib/app-path"

import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useId, useState } from "react"
import { useForm, useWatch, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button, Field, TextInput } from "@/components/shared/controls"
import { SHOP_SELECT_CLASS, ShopLink } from "@/components/shops/shop-ui"
import { catalogAmount, catalogAvailability, catalogDate } from "@/components/shops/catalog-model"
import { addCartItem } from "@/lib/cart-draft"
import { isDemoCatalogOfferRef } from "@/lib/demo-catalog-projection"
import { initialOfferVariantSelection, offerSelectionMode, offerVariantChoices, resolveOfferVariantSelection, updateOfferOptionSelection, type OfferInitialSelection, type OfferSelectionResult } from "@/lib/offer-variant-selection"
import { routes, specializedDestinationPath } from "@/lib/routes"
import { parseSpecializedDestination } from "@/lib/specialized-navigation"
import { useCartDraft } from "./use-cart-draft"

const demoOffer = (offer: CatalogOffer) => isDemoCatalogOfferRef(offer.offerRef) || offer.offerRef.startsWith("demo:offer:")
type SelectionValues = { options: string[]; variantRef: string; quantity: string }

export function OfferCartActions({ offer, initialSelection }: { offer: CatalogOffer; initialSelection?: OfferInitialSelection }) {
  const { t } = useTranslation("shops")
  if (demoOffer(offer)) return <p className="text-sm text-muted-foreground">{t("publicActions.demoNotice")}</p>
  return <OwnedOfferCartActions offer={offer} initialSelection={initialSelection} />
}

function OwnedOfferCartActions({ offer, initialSelection }: { offer: CatalogOffer; initialSelection?: OfferInitialSelection }) {
  const { networkId, personId } = useCartDraft(offer.shopHandle)
  const stamp = JSON.stringify([networkId, personId, offer.offerRef, offer.revision])
  const [firstStamp] = useState(stamp)
  return <OfferCartSelection key={JSON.stringify([stamp, initialSelection])} offer={offer} initialSelection={stamp === firstStamp ? initialSelection : undefined} />
}

function useOfferSelection(offer: CatalogOffer, initialSelection?: OfferInitialSelection) {
  const { t } = useTranslation("cart")
  const schema = z.object({ options: z.array(z.string()).max(2), variantRef: z.string(), quantity: z.string().regex(/^[1-9]\d{0,2}$/, t("quantityError")) })
  const defaults = initialOfferVariantSelection(offer, initialSelection)
  const form = useForm<SelectionValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const watched = useWatch({ control: form.control, defaultValue: defaults })
  const values: SelectionValues = { options: watched.options ?? defaults.options, variantRef: watched.variantRef ?? defaults.variantRef, quantity: watched.quantity ?? defaults.quantity }
  const selection = resolveOfferVariantSelection(offer, values)
  return { form, values, selection }
}

function OfferCartSelection({ offer, initialSelection }: { offer: CatalogOffer; initialSelection?: OfferInitialSelection }) {
  const { t } = useTranslation("cart")
  const { t: shopT } = useTranslation("shops")
  const cart = useCartDraft(offer.shopHandle)
  const [message, setMessage] = useState<string | null>(null)
  const { form, values, selection } = useOfferSelection(offer, initialSelection)
  if (offer.price.mode === "quote" || !offer.variants.length && !["fixed", "unit"].includes(offer.price.mode)) return <p className="text-sm text-muted-foreground">{t("quoteClosed")}</p>
  return <form className="grid w-full gap-3 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-background p-[var(--esp-card-padding,16px)]" onSubmit={form.handleSubmit((values) => {
    if (!cart.ready) return
    const current = resolveOfferVariantSelection(offer, values)
    if (!current.canAdd) { form.setError("variantRef", { message: shopT(`variantSelection.states.${current.status}`) }); return }
    const result = addCartItem(cart.draft, { networkId: String(cart.networkId), personId: String(cart.personId) }, offer.shopHandle, { offerRef: offer.offerRef, ...(current.variant ? { variantRef: current.variant.variantRef } : {}), quantity: Number(values.quantity) }, Date.now())
    setMessage(result.ok ? cart.save(result.draft) ? "added" : cart.getSaveError() === "drafts_full" ? "drafts_full" : "draftUnavailable" : result.reason)
  })}>
    <OfferSelectionInputs offer={offer} form={form} values={values} selection={selection} />
    {/* Ajouter au panier : couleur du commerce (ADR-0027). */}
    <div className="flex flex-wrap gap-2"><Button type="submit" variant="commerce" disabled={!cart.ready || !!cart.draft?.submitted || !selection.canAdd || !/^[1-9]\d{0,2}$/u.test(values.quantity)}>{t("add")}</Button><ShopLink href={routes.cart()}>{t("open")}</ShopLink></div>
    {message ? <p role="status" className="text-sm">{t(message)}</p> : null}
  </form>
}

/** Consultation seule : aucun fournisseur réseau, stockage de panier ou appel métier privé. */
export function PublicOfferSelection({ offer, viewer, initialSelection }: { offer: CatalogOffer; viewer: "anonymous" | "authenticated"; initialSelection?: OfferInitialSelection }) {
  const { t } = useTranslation("shops")
  if (demoOffer(offer)) return <p className="text-sm text-muted-foreground">{t("publicActions.demoNotice")}</p>
  if (offer.kind !== "product" || offer.price.mode === "quote") return null
  return <PublicOfferSelectionForm key={JSON.stringify([offer.offerRef, offer.revision, initialSelection])} offer={offer} viewer={viewer} initialSelection={initialSelection} />
}

function PublicOfferSelectionForm({ offer, viewer, initialSelection }: { offer: CatalogOffer; viewer: "anonymous" | "authenticated"; initialSelection?: OfferInitialSelection }) {
  const { t } = useTranslation("shops")
  const { form, values, selection } = useOfferSelection(offer, initialSelection)
  const quantity = /^[1-9]\d{0,2}$/u.test(values.quantity) ? Number(values.quantity) : undefined
  const destination = quantity === undefined ? undefined : parseSpecializedDestination({ kind: "offer", handle: offer.shopHandle, offerRef: offer.offerRef, ...(selection.canAdd && selection.variant ? { variantRef: selection.variant.variantRef } : {}), quantity })
  const href = destination ? viewer === "authenticated" ? specializedDestinationPath(destination) : routes.signIn(undefined, undefined, undefined, undefined, destination) : undefined
  return <form className="grid min-w-0 gap-3" onSubmit={event => event.preventDefault()}>
    <OfferSelectionInputs offer={offer} form={form} values={values} selection={selection} />
    {href ? <Link href={href} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-[var(--ui2-button-radius)] border border-border bg-card px-4 py-2 text-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("publicActions.chooseOptions")}</Link> : null}
    <p className="text-xs text-muted-foreground">{t(viewer === "authenticated" ? "publicActions.memberNotice" : "publicActions.signInNotice")}</p>
  </form>
}

function OfferSelectionInputs({ offer, form, values, selection }: { offer: CatalogOffer; form: UseFormReturn<SelectionValues>; values: SelectionValues; selection: OfferSelectionResult }) {
  const { t } = useTranslation("cart")
  const { t: shopT, i18n } = useTranslation("shops")
  const id = useId()
  const locale = i18n.resolvedLanguage ?? "fr"
  const mode = offerSelectionMode(offer)
  return <>
    {mode === "axes" ? offer.variantAxes.map((axis, index) => <Field key={`${index}:${axis}`} id={`${id}-axis-${index}`} label={axis}><select id={`${id}-axis-${index}`} name={`options.${index}`} className={SHOP_SELECT_CLASS} value={values.options[index] ?? ""} disabled={index > 0 && !values.options.slice(0, index).every(Boolean)} onChange={event => { form.setValue("options", updateOfferOptionSelection(offer, values.options, index, event.target.value), { shouldValidate: true, shouldDirty: true }); form.clearErrors("variantRef") }}><option value="">{t("choose")}</option>{offerVariantChoices(offer, values.options, index).map(choice => <option key={choice.value} value={choice.value} disabled={choice.disabled}>{choice.value}{choice.disabled ? ` — ${shopT("variantSelection.unavailableOption")}` : ""}</option>)}</select></Field>) : mode === "flat" ? <Field id={`${id}-variant`} label={t("variant")}><select id={`${id}-variant`} className={SHOP_SELECT_CLASS} {...form.register("variantRef")}><option value="">{t("choose")}</option>{offer.variants.map((variant, index) => <option key={`${variant.variantRef}:${index}`} value={variant.variantRef} disabled={!resolveOfferVariantSelection(offer, { options: [], variantRef: variant.variantRef }).canAdd}>{variant.label}</option>)}</select></Field> : null}
    <Field id={`${id}-quantity`} label={t("quantity")} error={form.formState.errors.quantity?.message ?? (!/^[1-9]\d{0,2}$/u.test(values.quantity) ? t("quantityError") : undefined)}><TextInput id={`${id}-quantity`} inputMode="numeric" autoComplete="off" aria-invalid={!/^[1-9]\d{0,2}$/u.test(values.quantity) || undefined} {...form.register("quantity")} /></Field>
    <div className="grid gap-1 rounded-[var(--ui2-card-radius)] bg-muted p-3 text-sm" aria-live="polite" data-offer-selection-summary>
      {selection.status !== "selected" ? <p>{shopT(`variantSelection.states.${selection.status}`)}</p> : null}
      {selection.unitAmount !== null ? <p className="font-semibold">{shopT("variantSelection.price")} : {catalogAmount(selection.unitAmount, locale)}{selection.unit ? ` / ${selection.unit}` : ""}</p> : null}
      <p>{catalogAvailability(offer.availability, (key, options) => shopT(key, options), selection.availability)}</p>
      {offer.availability.updatedAt !== null ? <p>{shopT("catalog.availability.updated", { date: catalogDate(offer.availability.updatedAt, locale) })}</p> : null}
      <p className="text-xs text-muted-foreground">{shopT("variantSelection.indicative")}</p>
    </div>
    {form.formState.errors.variantRef?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.variantRef.message}</p> : null}
  </>
}

export function OfferShareButton({ handle, offerRef, kind = "product" }: { handle: string; offerRef: string; kind?: "product" | "service" }) {
  const { t } = useTranslation("cart")
  const [message, setMessage] = useState<string | null>(null)
  return <div className="grid gap-2"><Button variant="outline" onClick={async () => {
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL
      if (!origin) { setMessage("shareUnavailable"); return }
      const parsed = new URL(origin)
      if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && parsed.hostname === "localhost")) { setMessage("shareUnavailable"); return }
      const url = new URL(browserAppPath(kind === "service" ? routes.publicProviderOffer(handle, offerRef) : routes.publicShopOffer(handle, offerRef)), parsed.origin).href
      if (navigator.share) await navigator.share({ url })
      else { await navigator.clipboard.writeText(url); setMessage("copied") }
    } catch { setMessage("shareUnavailable") }
  }}>{t("shareOffer")}</Button><p className="text-xs text-muted-foreground">{message ? t(message) : t("shareNotice")}</p></div>
}
