"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { COMMERCIAL_MESSAGING_SOURCE, type CommercialShopId } from "@antsia/social-features/messagerie"
import { useMutation } from "convex/react"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import { useShopAction } from "./shop-ui"

export function ContactInbox({ query = "", shopId }: { query?: string; shopId?: CommercialShopId }) {
  const { networkId, personId } = useNetwork()
  return shopId === undefined ? <ContactInboxHome key={JSON.stringify([networkId, personId])} query={query} /> : <ContactInboxWindow key={JSON.stringify([networkId, personId, shopId, query])} query={query} shopId={shopId} />
}
function ContactInboxHome({ query }: { query: string }) {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const shops = useAuthenticatedConvexQuery(api.modules.commercialMessaging.team.myShops, { networkId })
  const [selected, setSelected] = useState("")
  const shopId = shops.data?.items.find((item) => String(item.shopId) === selected)?.shopId
  return <div className="grid gap-3"><ContactInvitations />
    {shops.isError ? <div role="alert" className="p-3"><p>{t("contact.team.shopsUnavailable")}</p><Button variant="outline" onClick={() => void shops.refetch()}>{t("common.retry")}</Button></div> : null}
    {shops.data && shops.data.items.length > 0 ? <label className="mx-3 grid gap-2 text-sm font-medium">{t("contact.inbox.mailbox")}<select className="min-h-11 rounded-lg border border-input bg-background px-3 py-2" value={shopId ? String(shopId) : ""} onChange={(event) => setSelected(event.target.value)}><option value="">{t("contact.inbox.myRequests")}</option>{shops.data.items.map((item) => <option key={item.shopId} value={item.shopId}>{item.shopName}</option>)}</select></label> : null}
    {shops.data?.truncated ? <p className="px-3 text-xs text-muted-foreground">{t("contact.team.truncated")}</p> : null}
    <ContactInboxWindow key={JSON.stringify([query, shopId])} query={query} shopId={shopId} />
  </div>
}
function ContactInboxWindow({ query, shopId }: { query: string; shopId?: CommercialShopId }) {
  const { t, i18n } = useTranslation("shops")
  const timeZone = useViewerTimeZone()
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const page = COMMERCIAL_MESSAGING_SOURCE.useThreads(shopId, query, cursors.at(-1) ?? null)
  return <section aria-label={t("contact.inbox.title")} className="grid content-start gap-3 p-3">
    <p className="text-xs text-muted-foreground">{t("contact.inbox.window")}</p>
    {page.isError ? <div role="alert" className="grid gap-2"><p>{t("contact.unavailable")}</p><Button variant="outline" pending={page.isFetching} onClick={() => void page.refetch()}>{t("common.retry")}</Button></div> : page.data === undefined ? <p role="status">{t("common.loading")}</p> : <>
      {page.data.page.length === 0 ? <p role="status">{t(query ? "contact.inbox.noResults" : "contact.inbox.empty")}</p> : null}
      <ul className="grid gap-2">{page.data.page.map((thread) => <li key={thread.threadId}><Link prefetch={false} href={routes.commercialConversation(thread.threadId)} className="grid min-h-11 gap-1 rounded-xl border border-border bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={thread.unread ? "font-bold" : "font-medium"}>{thread.viewerKind === "requester" ? thread.shop.name : thread.requester.displayName ?? thread.requester.handle ?? t("contact.person")}{thread.unread ? <span className="ml-2 text-xs">{t("contact.inbox.unread")}</span> : null}</span>{thread.offer ? <span className="break-words text-sm text-muted-foreground">{thread.offer.title}</span> : null}<span className="text-xs">{t(`contact.states.${thread.state}`)}</span><time dateTime={new Date(thread.lastMessageAt).toISOString()} className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "fr", { dateStyle: "medium", timeStyle: "short", timeZone }).format(thread.lastMessageAt)}</time></Link></li>)}</ul>
      <nav className="flex flex-wrap gap-2" aria-label={t("contact.inbox.pages")}><Button variant="outline" disabled={cursors.length <= 1 || page.isFetching} onClick={() => setCursors((items) => items.slice(0, -1))}>{t("contact.inbox.previous")}</Button><Button variant="outline" disabled={page.data.isDone || page.isFetching} onClick={() => { if (page.data && !page.data.isDone) setCursors((items) => [...items, page.data.continueCursor]) }}>{t("contact.inbox.next")}</Button></nav>
    </>}
  </section>
}

function ContactInvitations() {
  const { t } = useTranslation("shops")
  const { networkId } = useNetwork()
  const invitations = useAuthenticatedConvexQuery(api.modules.commercialMessaging.team.myInvitations, { networkId })
  const accept = useMutation(api.modules.commercialMessaging.team.accept)
  const action = useShopAction()
  const [saved, setSaved] = useState(false)
  if (invitations.isError) return <div role="alert"><p>{t("contact.team.invitationsUnavailable")}</p><Button variant="outline" onClick={() => void invitations.refetch()}>{t("common.retry")}</Button></div>
  if (!invitations.data || (invitations.data.items.length === 0 && !saved && !action.error)) return null
  return <section className="grid gap-2 rounded-xl border border-border p-3"><h2 className="font-semibold">{t("contact.team.invitations")}</h2><p className="text-sm text-muted-foreground">{t("contact.team.invitationHelp")}</p><ul className="grid gap-2">{invitations.data.items.map((item) => <li key={item.shopId} className="grid gap-2"><p className="font-medium">{item.shopName}</p><p className="text-xs">{(["canRead", "canReply", "canDecide", "canCall"] as const).filter((right) => item[right]).map((right) => t(`contact.team.rights.${right}`)).join(" · ")}</p><Button variant="outline" pending={action.pending} onClick={() => void action.run(() => accept({ networkId, shopId: item.shopId }), () => setSaved(true))}>{t("contact.team.accept")}</Button></li>)}</ul>{invitations.data.truncated ? <p className="text-xs text-muted-foreground">{t("contact.team.truncated")}</p> : null}{action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}{saved ? <p role="status">{t("contact.recorded")}</p> : null}</section>
}
