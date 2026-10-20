"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import type { ServiceRequestDto } from "@convex/modules/shops/serviceRules"
import { useAction } from "convex/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, Card } from "@/components/shared/controls"
import { ShopFrame, ShopLink, useShopAction } from "@/components/shops/shop-ui"
import { routes } from "@/lib/routes"
import { BookingPanel, OrderPanel, QuotePanel } from "./service-request-panels"
import { SERVICE_AGENDA_TIME_ZONE, SERVICE_REQUESTS_PAGE_SIZE, serviceDateTime, serviceReasonKey, serviceRequestStatus } from "./service-model"

function RequestsFailure({ retry }: { retry?: () => void }) {
  const { t } = useTranslation("services")
  return <Card><div className="grid gap-3" role="alert"><p>{t("requests.unavailable")}</p>{retry ? <Button variant="outline" onClick={retry}>{t("common.retry")}</Button> : null}</div></Card>
}

/** « Mes demandes » : devis, rendez-vous et prestations de la personne dans ce réseau. */
export function ServiceRequestsScreen() {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("services")
  return <ShopFrame title={t("requests.title")} lead={t("requests.lead")}><RequestsWindow key={JSON.stringify([networkId, personId])} /></ShopFrame>
}

function RequestsWindow() {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const query = useAuthenticatedConvexQuery(api.modules.shops.services.myRequests, { networkId, paginationOpts: { cursor: cursors.at(-1) ?? null, numItems: SERVICE_REQUESTS_PAGE_SIZE } })
  if (query.isError) return <RequestsFailure retry={() => { void query.refetch() }} />
  if (query.isPending || !query.data) return <p role="status">{t("common.loading")}</p>
  const result = query.data
  return <div className="grid gap-4" aria-busy={query.isFetching || undefined}>
    <p className="text-sm text-muted-foreground">{t("requests.scope", { count: SERVICE_REQUESTS_PAGE_SIZE })}</p>
    {result.page.length ? <ul className="grid gap-3">{result.page.map((request) => <li key={request.requestRowId}><RequestCard request={request} /></li>)}</ul> : <Card><p>{t("requests.empty")}</p></Card>}
    {cursors.length > 1 || !result.isDone ? <nav aria-label={t("requests.pagination")} className="flex flex-wrap gap-3">
      {cursors.length > 1 ? <Button variant="outline" onClick={() => setCursors((items) => items.slice(0, -1))}>{t("common.previous")}</Button> : null}
      {!result.isDone ? <Button variant="outline" onClick={() => setCursors((items) => [...items, result.continueCursor])}>{t("common.next")}</Button> : null}
    </nav> : null}
  </div>
}

function RequestCard({ request }: { request: ServiceRequestDto }) {
  const { t, i18n } = useTranslation("services")
  const locale = i18n.resolvedLanguage ?? "fr"
  const status = serviceRequestStatus(request)
  return <article className="grid gap-2 rounded-[var(--ui2-card-radius)] border border-[color:var(--esp-surface-border)] bg-card p-[var(--esp-card-padding,16px)] text-card-foreground">
    <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="break-words font-semibold">{request.offerTitle}</h2><span className="rounded-[var(--ui2-badge-radius)] border border-transparent bg-muted px-3 py-1 text-xs">{t(`status.${status}`)}</span></div>
    <p className="text-sm text-muted-foreground">{t(`modes.${request.mode}`)}</p>
    {request.booking ? <p className="text-sm">{t("requests.bookingAt", { start: serviceDateTime(request.booking.startAt, SERVICE_AGENDA_TIME_ZONE, locale), zone: SERVICE_AGENDA_TIME_ZONE })}</p> : null}
    {request.desiredDate ? <p className="text-sm">{t("requests.desiredDate", { date: request.desiredDate })}</p> : null}
    <p className="text-xs text-muted-foreground">{t("requests.updated", { date: serviceDateTime(request.updatedAt, SERVICE_AGENDA_TIME_ZONE, locale) })}</p>
    <ShopLink href={routes.serviceRequest(request.requestRowId)}>{t("requests.open")}</ShopLink>
  </article>
}

export function ServiceRequestScreen({ requestRowId }: { requestRowId: string }) {
  const { networkId, personId } = useNetwork()
  const { t } = useTranslation("services")
  return <ShopFrame title={t("requests.detailTitle")}><ShopLink href={routes.serviceRequests()}>{t("requests.back")}</ShopLink><RequestReader key={JSON.stringify([networkId, personId, requestRowId])} requestRowId={requestRowId} /></ShopFrame>
}

function RequestReader({ requestRowId }: { requestRowId: string }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const query = useAuthenticatedConvexQuery(api.modules.shops.services.myRequest, { networkId, requestRowId })
  if (query.isError) return <RequestsFailure retry={() => { void query.refetch() }} />
  if (query.isPending || query.data === undefined) return <p role="status">{t("common.loading")}</p>
  if (query.data === null) return <RequestsFailure />
  return <RequestDetail request={query.data} />
}

function RequestDetail({ request }: { request: ServiceRequestDto }) {
  const { t, i18n } = useTranslation("services")
  const locale = i18n.resolvedLanguage ?? "fr"
  const status = serviceRequestStatus(request)
  return <div className="grid gap-5">
    <Card><div className="grid gap-2">
      <h2 className="break-words text-xl font-semibold">{request.offerTitle}</h2>
      <p className="text-sm text-muted-foreground">{t(`modes.${request.mode}`)}</p>
      <p role="status" className="font-medium">{t(`status.${status}`)}</p>
      <p className="text-sm">{t(`statusHint.${status}`)}</p>
      {request.reason ? <p className="text-sm">{t(serviceReasonKey(request.reason))}</p> : null}
      {request.desiredDate ? <p className="text-sm">{t("requests.desiredDate", { date: request.desiredDate })}</p> : null}
      {request.chosenAttachmentCount ? <p className="text-sm text-muted-foreground">{t("requests.attachments", { count: request.chosenAttachmentCount })}</p> : null}
      <p className="text-xs text-muted-foreground">{t("requests.created", { date: serviceDateTime(request.createdAt, SERVICE_AGENDA_TIME_ZONE, locale) })}</p>
      <div className="flex flex-wrap gap-2">
        <ShopLink href={routes.shopOffer(request.handle, request.offerRef)}>{t("requests.openOffer")}</ShopLink>
        {request.threadId ? <ShopLink href={routes.commercialConversation(request.threadId)}>{t("quote.openConversation")}</ShopLink> : null}
      </div>
    </div></Card>
    <RequestControls request={request} />
    {request.mode === "quote" ? <QuotePanel request={request} /> : null}
    {request.mode === "booking" ? <BookingPanel request={request} /> : null}
    {request.mode === "fixed_order" ? <OrderPanel request={request} /> : null}
    <p className="text-xs text-muted-foreground">{t("common.noPayment")}</p>
  </div>
}

/** Résultat d'une commande et relectures : consultation corrélée, jamais un nouvel envoi deviné. */
function RequestControls({ request }: { request: ServiceRequestDto }) {
  const { networkId } = useNetwork()
  const { t } = useTranslation("services")
  const refresh = useAction(api.modules.shops.serviceActions.refresh)
  const retry = useAction(api.modules.shops.serviceActions.retry)
  const action = useShopAction()
  const [message, setMessage] = useState<string | null>(null)
  const last = request.lastCommand
  return <Card><div className="grid gap-3">
    {last ? <div className="grid gap-1">
      <p className="text-sm font-medium">{t("command.last", { kind: t(`commandKinds.${last.kind}`) })}</p>
      <p className="text-sm">{t(`commandStates.${last.state}`)}</p>
      {last.reason ? <p className="text-sm text-muted-foreground">{t(serviceReasonKey(last.reason))}</p> : null}
    </div> : null}
    <div className="flex flex-wrap gap-2">
      {last?.state === "unknown" ? <Button pending={action.pending} disabled={!last.canRetry} onClick={() => { setMessage(null); void action.run(() => retry({ networkId, requestRowId: request.requestRowId }), (result) => setMessage(result.outcome === "request" ? `commandStates.${result.state}` : result.outcome === "refused" ? "command.retryRefused" : "common.unavailable")) }}>{t("command.check")}</Button> : null}
      <Button variant="outline" pending={action.pending} onClick={() => { setMessage(null); void action.run(() => refresh({ networkId, requestRowId: request.requestRowId }), (result) => setMessage(`refresh.${result}`)) }}>{t("command.refresh")}</Button>
    </div>
    {last?.state === "unknown" && !last.canRetry ? <p className="text-xs text-muted-foreground">{t("command.inFlight")}</p> : null}
    {message ? <p role="status" className="text-sm">{t(message)}</p> : null}
    {action.error ? <p role="alert" className="text-sm">{action.error}</p> : null}
  </div></Card>
}
