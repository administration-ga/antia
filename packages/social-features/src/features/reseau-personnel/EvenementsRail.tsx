// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/EvenementsRail.tsx @ ad2e7fdc2 — adaptations : mon agenda dans le réseau courant (`events.events.myAgenda` → `{ items }`, `networkId` par `useNetwork()`) ; lien « Voir tout » composé sur la base injectée de la page réseau (`reseauAgentHref("evenements", useRoutes().home())`) ; dates dans le fuseau du navigateur et la langue courante ; organisateur nommé par le contrat `counterpartLabel` (nom neutre quand le profil n'est pas publié) ; toutes les chaînes par l'i18n (espace `reseau`, clés `evenementsRail.*`).
"use client"

/** Aperçu compact des prochains évènements dans le rail de découverte. */

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork, useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { Badge, Button, Card, SkeletonCard } from "@antsia/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { RESEAU_SURFACE_STYLE } from "../../shell/design-styles"
import { reseauAgentHref } from "../../shell/reseau-agent-nav"
import { Avatar } from "./Avatar"
import { eventPersonName, eventsForRail, formatEventRange, viewerTimeZone } from "./evenements-list"

export function EvenementsRail({ now }: { now: number }) {
  const { t, i18n } = useTranslation("reseau")
  const { networkId } = useNetwork()
  const home = useRoutes().home()
  /** Le fuseau du lecteur — celui de son navigateur, lu une fois. */
  const [timeZone] = useState(viewerTimeZone)
  const agenda = useAuthenticatedConvexQuery(api.modules.events.events.myAgenda, { networkId, now })

  if (agenda.isLoading) return <SkeletonCard />
  if (agenda.isError) {
    return (
      <Card padded style={RESEAU_SURFACE_STYLE}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>{t("evenementsRail.error")}</p>
        <Button variant="ghost" size="sm" onClick={() => void agenda.refetch()} style={{ marginTop: 8, minHeight: 44 }}>
          {t("evenementsRail.retry")}
        </Button>
      </Card>
    )
  }

  const events = eventsForRail(agenda.data?.items ?? [], now, timeZone)
  if (events.length === 0) return null

  return (
    <Card padded={false} style={RESEAU_SURFACE_STYLE}>
      <section style={{ padding: 20 }} aria-labelledby="rp-events-rail-title">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 id="rp-events-rail-title" style={{ margin: 0, fontSize: 14, color: "var(--ink-900)" }}>
            {t("evenementsRail.title")}
          </h2>
          <Link
            href={reseauAgentHref("evenements", home)}
            style={{
              display: "inline-flex",
              minHeight: 44,
              alignItems: "center",
              color: "var(--primary-600)",
              fontSize: 12.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("evenementsRail.seeAll")}
          </Link>
        </div>

        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {events.map((event) => {
            const organizerName = eventPersonName(event.organizer.displayName, t)
            return (
              <li key={event.eventId} style={{ display: "flex", gap: 10 }}>
                <Avatar displayName={organizerName} avatarUrl={event.organizer.avatarUrl} hasIdentity={event.organizer.displayName !== null} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ink-900)",
                      fontSize: 13,
                      fontWeight: 700,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {event.title}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      color: "var(--ink-600)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    {formatEventRange(event.startAt, event.endAt, i18n.language, timeZone)}
                  </p>
                  {event.myParticipation?.status === "pending" ? (
                    <Badge tone="neutral" size="sm">
                      {t("evenementsRail.awaitingReply")}
                    </Badge>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </Card>
  )
}
