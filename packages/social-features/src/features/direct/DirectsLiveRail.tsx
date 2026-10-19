// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/DirectsLiveRail.tsx @ ad2e7fdc2 — adaptations : query réseau paginée du moteur (trois cartes), curseur accessible même sur fenêtre vide, routes et i18n ; liens profil/conférence frères.
"use client"
import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork, useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { Button, Card } from "@antsia/ui"
import type { FunctionArgs } from "convex/server"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Avatar } from "../reseau-personnel/Avatar"
import { RESEAU_CARD_STYLE } from "../../shell/design-styles"

export function DirectsLiveRail({ now }: { now: number }) {
  const { networkId } = useNetwork()
  return <LiveRailPage key={networkId} now={now} />
}
function LiveRailPage({ now }: { now: number }) {
  const { t } = useTranslation("direct")
  const { networkId } = useNetwork()
  const routes = useRoutes()
  const [cursor, setCursor] = useState<FunctionArgs<typeof api.modules.live.sessions.listLive>["cursor"]>()
  const query = useAuthenticatedConvexQuery(api.modules.live.sessions.listLive, { networkId, limit: 3, cursor })
  if (!query.isError && query.data?.items.length === 0 && !query.data.nextCursor) return null
  return <Card style={RESEAU_CARD_STYLE}><section aria-label={t("rail.title")} className="flex min-w-0 flex-col gap-3">
    <h2 className="text-sm font-semibold">{t("rail.title")}</h2>
    {query.isError ? <div role="alert"><p>{t("failed")}</p><Button variant="ghost" onClick={() => void query.refetch()}>{t("retry")}</Button></div> : !query.data ? <p role="status">{t("loading")}</p> : <>
      <ul className="flex flex-col gap-3">{query.data.items.map((card) => <li key={card.sessionId} className="flex min-w-0 items-center gap-3">
        {card.host.handle ? <Link href={routes.profile(card.host.handle)} aria-label={t("rail.profile", { name: card.host.displayName ?? t("person") })}><Avatar displayName={card.host.displayName ?? t("person")} avatarUrl={card.host.avatarUrl} size={32} /></Link> : <Avatar displayName={card.host.displayName ?? t("person")} avatarUrl={card.host.avatarUrl} size={32} />}
        <Link href={routes.conference(card.sessionId)} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1"><span className="truncate text-sm font-semibold">{card.title}</span><span className="text-xs text-muted-foreground">{t("rail.since", { minutes: Math.max(0, Math.floor((now - card.startedAt) / 60_000)) })}</span></Link>
      </li>)}</ul>
      {query.data.items.length === 0 && query.data.nextCursor ? <p className="text-sm">{t("rail.emptyWindow")}</p> : null}
      {query.data.nextCursor ? <Button style={{ minHeight: 44 }} variant="ghost" size="sm" disabled={query.isFetching} onClick={() => { if (query.data?.nextCursor) setCursor(query.data.nextCursor) }}>{t("more")}</Button> : null}
    </>}
  </section></Card>
}
