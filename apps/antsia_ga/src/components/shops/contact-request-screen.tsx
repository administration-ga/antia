"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { COMMERCIAL_TEXT_MAX, commercialText } from "@antsia/social-domain/commercialContact"
import { useConversationSend } from "@antsia/social-features/features/messagerie/use-conversation-send"
import { zodResolver } from "@hookform/resolvers/zod"
import { useConvexAuth, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button, Card, Field, TextArea } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import { ShopFrame, ShopLink, ShopQueryFailure, useShopAction, useShopDirtyGuard } from "./shop-ui"

const requestSchema = z.object({ text: z.string().trim().min(1).max(COMMERCIAL_TEXT_MAX).refine((value) => commercialText(value) !== null) })
export function ContactRequestScreen({ handle, offerRef }: { handle: string; offerRef?: string }) {
  const { networkId, personId } = useNetwork()
  return <ContactRequest key={JSON.stringify([networkId, personId, handle, offerRef])} handle={handle} offerRef={offerRef} />
}
function ContactRequest({ handle, offerRef }: { handle: string; offerRef?: string }) {
  const { t } = useTranslation("shops")
  const { networkId, personId } = useNetwork()
  const { isAuthenticated } = useConvexAuth()
  const router = useRouter()
  const shop = useAuthenticatedConvexQuery(api.modules.shops.shops.storefront, { networkId, handle })
  const offer = useAuthenticatedConvexQuery(api.modules.shops.catalog.offer, offerRef ? { networkId, handle, offerRef } : "skip")
  const existing = useAuthenticatedConvexQuery(api.modules.commercialMessaging.threads.findMyThread, { networkId, shopHandle: handle, ...(offerRef ? { offerRef } : {}) })
  const request = useMutation(api.modules.commercialMessaging.threads.requestContact)
  const action = useShopAction()
  const sender = useConversationSend(JSON.stringify([networkId, personId]), JSON.stringify(["commerce-request", handle, offerRef ?? null]), isAuthenticated)
  const form = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema), defaultValues: { text: "" } })
  const id = useId()
  useShopDirtyGuard(form.formState.isDirty && !action.pending)
  const unavailable = shop.isError || shop.data === null || existing.isError || (!!offerRef && (offer.isError || offer.data === null || offer.data?.actions.contact === false))
  const loading = shop.data === undefined || existing.data === undefined || (!!offerRef && offer.data === undefined)
  return <ShopFrame title={t("contact.ask")} lead={t("contact.request.lead")}><ShopLink href={offerRef ? routes.shopOffer(handle, offerRef) : routes.storefront(handle)}>{t("common.back")}</ShopLink>{existing.data ? <Card><div className="grid gap-3"><p>{t("contact.request.existing")}</p><ShopLink href={routes.commercialConversation(existing.data.threadId)}>{t("contact.request.openExisting")}</ShopLink></div></Card> : unavailable ? <ShopQueryFailure href={routes.storefront(handle)} retry={() => { void shop.refetch(); void existing.refetch(); if (offerRef) void offer.refetch() }} /> : loading ? <p role="status">{t("common.loading")}</p> : <Card><form noValidate className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
    await action.run(() => sender.perform({ text: values.text, attachments: [], replyTo: null }, (idempotencyKey) => request({ networkId, shopHandle: handle, ...(offerRef ? { offerRef } : {}), text: values.text, idempotencyKey })), (result) => {
      if (!sender.isCurrent()) return
      form.reset({ text: "" })
      router.replace(routes.commercialConversation(result.threadId))
    })
  })}>
    <h2 className="text-lg font-semibold">{shop.data?.name}</h2>{offer.data ? <p className="text-sm">{t("contact.offerContext", { title: offer.data.title })}</p> : null}
    <p className="text-sm text-muted-foreground">{t("contact.request.explanation")}</p>
    <Field id={id} label={t("contact.request.text")} hint={t("contact.request.hint")} error={form.formState.errors.text ? t("contact.validation.message") : undefined}><TextArea id={id} maxLength={COMMERCIAL_TEXT_MAX} disabled={action.pending} aria-invalid={!!form.formState.errors.text} aria-describedby={`${id}-hint${form.formState.errors.text ? ` ${id}-error` : ""}`} {...form.register("text")} /></Field>
    {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
    <Button type="submit" pending={action.pending} className="justify-self-start">{t("contact.request.send")}</Button>
  </form></Card>}</ShopFrame>
}
