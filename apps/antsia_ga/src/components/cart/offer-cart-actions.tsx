"use client"

import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button, Field, TextInput } from "@/components/shared/controls"
import { SHOP_SELECT_CLASS, ShopLink } from "@/components/shops/shop-ui"
import { addCartItem } from "@/lib/cart-draft"
import { routes } from "@/lib/routes"
import { useCartDraft } from "./use-cart-draft"

export function OfferCartActions({ offer }: { offer: CatalogOffer }) {
  const { networkId, personId } = useCartDraft()
  return <OfferCartSelection key={JSON.stringify([networkId, personId, offer.offerRef, offer.revision])} offer={offer} />
}
function OfferCartSelection({ offer }: { offer: CatalogOffer }) {
  const { t } = useTranslation("cart")
  const cart = useCartDraft()
  const id = useId()
  const [message, setMessage] = useState<string | null>(null)
  const schema = z.object({ variantRef: z.string(), quantity: z.string().regex(/^[1-9]\d{0,2}$/, t("quantityError")) })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { variantRef: "", quantity: "1" } })
  if (offer.price.mode === "quote" || !offer.variants.length && !["fixed", "unit"].includes(offer.price.mode)) return <p className="text-sm text-muted-foreground">{t("quoteClosed")}</p>
  return <form className="grid w-full gap-3 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-background p-[var(--esp-card-padding,16px)]" onSubmit={form.handleSubmit((values) => {
    if (!cart.ready) return
    if (offer.variants.length && !offer.variants.some((variant) => variant.variantRef === values.variantRef)) { form.setError("variantRef", { message: t("variantError") }); return }
    const result = addCartItem(cart.draft, { networkId: String(cart.networkId), personId: String(cart.personId) }, offer.shopHandle, { offerRef: offer.offerRef, ...(values.variantRef ? { variantRef: values.variantRef } : {}), quantity: Number(values.quantity) }, Date.now())
    setMessage(result.ok ? cart.save(result.draft) ? "added" : "draftUnavailable" : result.reason)
  })}>
    {offer.variants.length ? <Field id={`${id}-variant`} label={t("variant")} error={form.formState.errors.variantRef?.message}><select id={`${id}-variant`} className={SHOP_SELECT_CLASS} {...form.register("variantRef")}><option value="">{t("choose")}</option>{offer.variants.map((variant) => <option key={variant.variantRef} value={variant.variantRef}>{variant.label}</option>)}</select></Field> : null}
    <Field id={`${id}-quantity`} label={t("quantity")} error={form.formState.errors.quantity?.message}><TextInput id={`${id}-quantity`} inputMode="numeric" autoComplete="off" {...form.register("quantity")} /></Field>
    {/* Ajouter au panier : couleur du commerce (ADR-0027). */}
    <div className="flex flex-wrap gap-2"><Button type="submit" variant="commerce" disabled={!cart.ready || !!cart.draft?.submitted}>{t("add")}</Button><ShopLink href={routes.cart()}>{t("open")}</ShopLink></div>
    {message ? <p role="status" className="text-sm">{t(message)}</p> : null}
  </form>
}

export function OfferShareButton({ handle, offerRef }: { handle: string; offerRef: string }) {
  const { t } = useTranslation("cart")
  const [message, setMessage] = useState<string | null>(null)
  return <div className="grid gap-2"><Button variant="outline" onClick={async () => {
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL
      if (!origin) { setMessage("shareUnavailable"); return }
      const parsed = new URL(origin)
      if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && parsed.hostname === "localhost")) { setMessage("shareUnavailable"); return }
      const url = new URL(routes.publicShopOffer(handle, offerRef), parsed.origin).href
      if (navigator.share) await navigator.share({ url })
      else { await navigator.clipboard.writeText(url); setMessage("copied") }
    } catch { setMessage("shareUnavailable") }
  }}>{t("shareOffer")}</Button><p className="text-xs text-muted-foreground">{message ? t(message) : t("shareNotice")}</p></div>
}
