"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import type { CartContext } from "@convex/modules/shops/checkoutRules"
import { useAction, useConvex, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckoutPreparationForm, type CheckoutCartLine, type CheckoutOptions, type CheckoutPrepareInput } from "@/components/checkout/checkout-form"
import { checkoutAmount } from "@/components/checkout/checkout-model"
import { Button, Card, TextInput } from "@/components/shared/controls"
import { ShopFrame, ShopLink, useShopAction } from "@/components/shops/shop-ui"
import { cartIntentDigest, cartItemKey, type CartDraft, type CartItem } from "@/lib/cart-draft"
import { routes } from "@/lib/routes"
import { useCartConnectivity, useCartDraft } from "./use-cart-draft"

export function CartScreen() {
  const { t } = useTranslation("cart")
  const cart = useCartDraft()
  return <ShopFrame title={t("title")} lead={t("lead")}><div className="flex flex-wrap gap-2"><ShopLink href={routes.purchases()}>{t("myPurchases")}</ShopLink></div><p className="text-sm text-muted-foreground">{t("draftNotice")}</p>{!cart.ready ? <p role="status">{t("loading")}</p> : cart.draft ? <CartContents key={JSON.stringify([cart.networkId, cart.personId, cart.draft.handle])} draft={cart.draft} save={cart.save} /> : <Card><p>{t("empty")}</p></Card>}</ShopFrame>
}
function CartContents({ draft, save }: { draft: CartDraft; save: (draft: CartDraft | null) => boolean }) {
  const { t, i18n } = useTranslation("cart")
  const { networkId } = useCartDraft()
  const connectivity = useCartConnectivity()
  const router = useRouter()
  const convex = useConvex()
  const query = useAuthenticatedConvexQuery(api.modules.shops.checkout.cartContext, { networkId, handle: draft.handle, items: draft.items })
  const optionsAction = useAction(api.modules.shops.checkoutActions.options)
  const prepare = useAction(api.modules.shops.checkoutActions.prepare)
  const action = useShopAction()
  const [options, setOptions] = useState<CheckoutOptions | null>(null)
  const [checkedStamp, setCheckedStamp] = useState<string | null>(null)
  const [recover, setRecover] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const liveIntent = useRef<string | null>(null)
  const previousContext = useRef<CartContext | null>(null)
  if (!query.isError && query.data) previousContext.current = query.data
  const stamp = JSON.stringify([draft.items, connectivity.generation])
  const suspended = !connectivity.online || checkedStamp !== stamp || action.pending
  const submitted = draft.submitted
  const edit = (items: CartItem[]) => {
    if (submitted) return
    setOptions(null); setCheckedStamp(null)
    if (!save(items.length ? { ...draft, items, updatedAt: Date.now() } : null)) setMessage("draftUnavailable")
  }
  const refresh = () => {
    if (!connectivity.online || !navigator.onLine) return
    void action.run(async () => {
      const fresh = await query.refetch()
      if (!action.current() || fresh.isError || !fresh.data?.available) return null
      return await optionsAction({ networkId, handle: draft.handle })
    }, (result) => {
      if (result?.outcome !== "ready") { setCheckedStamp(null); setMessage("unavailable"); return }
      setOptions(result); setCheckedStamp(stamp); setMessage(null)
    })
  }
  const beforeResume = async (input: CheckoutPrepareInput) => {
    const result = await convex.query(api.modules.shops.checkout.findByClientRequestId, { networkId, clientRequestId: input.clientRequestId })
    if (!action.current()) throw new Error("cartSessionChanged")
    return result.outcome === "attempt" ? { outcome: "attempt" as const, attemptId: result.attempt.attemptId } : result.outcome === "stopped" ? { outcome: "refused" as const } : { outcome: "absent" as const }
  }
  const persistIntent = async (input: CheckoutPrepareInput) => {
    const digest = await cartIntentDigest({ networkId, handle: draft.handle, ...input })
    if (!action.current()) return false
    if (!digest || submitted && (submitted.clientRequestId !== input.clientRequestId || submitted.digest !== digest)) { setMessage("mismatch"); return false }
    liveIntent.current = input.clientRequestId
    const saved = save({ ...draft, updatedAt: Date.now(), submitted: submitted ?? { clientRequestId: input.clientRequestId, submittedAt: Date.now(), digest, expectedLines: input.lines, expectedPolicyVersion: input.expectedPolicyVersion } })
    if (!saved) { liveIntent.current = null; setMessage("draftUnavailable") }
    return saved
  }
  const stopped = () => { setRecover(false); setOptions(null); setCheckedStamp(null); liveIntent.current = null; setMessage(null) }
  if (submitted && liveIntent.current !== submitted.clientRequestId && !recover) return <SubmittedCart draft={draft} save={save} onRecover={() => setRecover(true)} onStopped={stopped} />
  // Une panne conserve le formulaire en mémoire ; aucune ancienne capacité n'autorise l'envoi.
  const context = query.isError ? previousContext.current : query.data ?? previousContext.current
  const lines: CheckoutCartLine[] = context?.items.flatMap((item) => item.available && item.offer ? [{ offer: item.offer, quantity: item.quantity, ...(item.variantRef ? { variantRef: item.variantRef } : {}) }] : []) ?? []
  const first = lines[0]
  return <div className="grid gap-5">
    <div className="flex flex-wrap gap-3"><p className="self-center font-medium">{t("seller", { handle: draft.handle })}</p><ShopLink href={routes.storefront(draft.handle)}>{t("backToShop")}</ShopLink></div>
    {!connectivity.online ? <p role="status">{t("offline")}</p> : null}
    {recover && submitted ? <Card><p>{t("recoverHint")}</p><SubmittedCart draft={draft} save={save} onRecover={() => setRecover(true)} onStopped={stopped} recovery /></Card> : null}
    {submitted && !recover ? <SubmittedCart draft={draft} save={save} onRecover={() => setRecover(true)} onStopped={stopped} recovery /> : null}
    <ul className="grid gap-3">{draft.items.map((item) => {
      const current = context?.items.find((entry) => entry.offerRef === item.offerRef && (entry.variantRef ?? undefined) === item.variantRef)
      return <li key={cartItemKey(item)}><CartLine item={item} offer={current?.offer ?? null} available={current?.available === true} locked={!!submitted} locale={i18n.resolvedLanguage ?? "fr"} update={(quantity) => edit(draft.items.map((entry) => cartItemKey(entry) === cartItemKey(item) ? { ...entry, quantity } : entry))} remove={() => edit(draft.items.filter((entry) => cartItemKey(entry) !== cartItemKey(item)))} /></li>
    })}</ul>
    {!submitted ? <Button variant="danger" onClick={() => edit([])}>{t("clear")}</Button> : null}
    {query.isPending ? <p role="status">{t("loading")}</p> : null}
    {query.isError || context && !context.available ? <p role="alert">{t("unavailable")}</p> : null}
    <Button variant="outline" pending={action.pending} disabled={!connectivity.online} onClick={refresh}>{t("refresh")}</Button>
    {context?.pending && !submitted ? <Card><p>{t("found")}</p><ShopLink href={routes.checkoutAttempt(context.pending.attemptId)}>{t("openAttempt")}</ShopLink></Card> : null}
    {options && first && lines.length === draft.items.length && context && (!context.pending || !!submitted) ? <CheckoutPreparationForm offer={first.offer} cartLines={lines} options={options} consentTextVersion={context.consentTextVersion} consentEpoch={JSON.stringify([stamp, options.policyVersion, lines.map((line) => [line.offer.revision, line.offer.price, line.offer.variants])])} suspended={suspended || !context.available || context.reason !== null || query.isError} recoveredRequestId={recover ? submitted?.clientRequestId : undefined} beforeResume={beforeResume} onIntent={persistIntent} prepare={(input) => prepare({ networkId, handle: draft.handle, ...input })} onAttempt={(attemptId) => {
      const original = draft.submitted
      if (original) save({ ...draft, updatedAt: Date.now(), submitted: { ...original, attemptId } })
      router.push(routes.checkoutAttempt(attemptId))
    }} /> : null}
    {message ? <p role="alert" className="text-sm">{t(message)}</p> : null}{action.error ? <p role="alert">{t("unavailable")}</p> : null}
  </div>
}
function CartLine({ item, offer, available, locked, locale, update, remove }: { item: CartItem; offer: CatalogOffer | null; available: boolean; locked: boolean; locale: string; update: (quantity: number) => void; remove: () => void }) {
  const { t } = useTranslation("cart")
  const [quantity, setQuantity] = useState(String(item.quantity))
  const valid = /^[1-9]\d{0,2}$/.test(quantity)
  const variant = offer?.variants.find((entry) => entry.variantRef === item.variantRef)
  const amount = variant?.amount ?? (offer?.price.mode === "fixed" || offer?.price.mode === "unit" ? offer.price.amount : null)
  const unit = variant?.unit ?? (offer?.price.mode === "unit" ? offer.price.unit : null)
  return <Card><div className="grid gap-3"><h2 className="font-semibold">{offer?.title ?? t("missing")}</h2>{variant ? <p>{variant.label}</p> : null}{amount !== null ? <p>{unit ? t("unit", { amount: checkoutAmount(amount, locale), unit }) : checkoutAmount(amount, locale)}</p> : null}{!available ? <p role="status">{t("missing")}</p> : null}<form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (!locked && valid) update(Number(quantity)) }}><label className="grid gap-1 text-sm"><span>{t("quantity")}</span><TextInput value={quantity} disabled={locked} inputMode="numeric" aria-invalid={!valid} onChange={(event) => setQuantity(event.target.value)} className="max-w-28" /></label><Button type="submit" variant="outline" disabled={locked || !valid}>{t("update")}</Button><Button type="button" variant="danger" disabled={locked} onClick={remove}>{t("remove")}</Button></form>{!valid ? <p role="alert" className="text-sm">{t("quantityError")}</p> : null}</div></Card>
}
function SubmittedCart({ draft, save, onRecover, onStopped, recovery = false }: { draft: CartDraft; save: (draft: CartDraft | null) => boolean; onRecover: () => void; onStopped: () => void; recovery?: boolean }) {
  const { t } = useTranslation("cart")
  const { networkId } = useCartDraft()
  const connectivity = useCartConnectivity()
  const action = useShopAction()
  const stop = useMutation(api.modules.shops.checkout.stopClientIntent)
  const router = useRouter()
  const query = useAuthenticatedConvexQuery(api.modules.shops.checkout.findByClientRequestId, draft.submitted ? { networkId, clientRequestId: draft.submitted.clientRequestId } : "skip")
  const found = !query.isError && query.data?.outcome === "attempt" ? query.data.attempt : null
  const stoppable = !query.isError && (query.data?.outcome === "absent" || query.data?.outcome === "stopped")
  const abandon = () => {
    if (!stoppable || !draft.submitted || !connectivity.online || !navigator.onLine) return
    void action.run(() => stop({ networkId, clientRequestId: draft.submitted!.clientRequestId }), (result) => {
      if (result.outcome === "attempt") { router.push(routes.checkoutAttempt(result.attempt.attemptId)); return }
      if (result.outcome === "stopped" && save({ ...draft, submitted: null, updatedAt: Date.now() })) onStopped()
    })
  }
  return <Card><div className="grid gap-3"><p role="status">{t("submitted")}</p><Button variant="outline" pending={query.isFetching} disabled={!connectivity.online || action.pending} onClick={() => { if (navigator.onLine) void query.refetch() }}>{t("lookup")}</Button>{query.isPending ? <p>{t("looking")}</p> : found ? <><p>{t("found")}</p><ShopLink href={routes.checkoutAttempt(found.attemptId)}>{t("openAttempt")}</ShopLink><Button variant="outline" onClick={() => { save(null) }}>{t("clearResolved")}</Button></> : stoppable ? <><p>{t(query.data?.outcome === "stopped" ? "stopped" : "notFound")}</p>{!recovery && query.data?.outcome === "absent" ? <Button variant="outline" disabled={!connectivity.online} onClick={onRecover}>{t("recover")}</Button> : null}<p className="text-sm text-muted-foreground">{t("stopHint")}</p><Button variant="outline" pending={action.pending} disabled={!connectivity.online} onClick={abandon}>{t("stopIntent")}</Button></> : <p>{t("unavailable")}</p>}{action.error ? <p role="alert">{t("unavailable")}</p> : null}</div></Card>
}
