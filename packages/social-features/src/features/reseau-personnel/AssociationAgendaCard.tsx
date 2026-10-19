"use client"

/** Une inscription collective ; les actes personnels ne se montent jamais ici. */
import { useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { Badge, Card } from "@antsia/ui"
import { useTranslation } from "react-i18next"

import { RESEAU_SURFACE_STYLE } from "../../shell/design-styles"
import type { AssociationAgendaItem } from "./association-agenda"
import { formatEventRange } from "./evenements-list"

export function AssociationAgendaCard(props: { readonly event: AssociationAgendaItem; readonly locale: string; readonly timeZone: string }) {
  const { t } = useTranslation("reseau")
  const routes = useRoutes()
  const { event } = props
  const href = routes.associationEvent?.(event.organizer.handle, event.eventId) ?? routes.page(event.organizer.handle)
  return <Card padded style={RESEAU_SURFACE_STYLE}>
    <article style={{ display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14.5, overflowWrap: "anywhere" }}>{event.title}</h3>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-foreground)" }}>{formatEventRange(event.startAt, event.endAt, props.locale, props.timeZone)}</p>
      <p style={{ margin: 0, fontSize: 12 }}>{t("associationAgenda.organizedBy", { name: event.organizer.name })}</p>
      {event.location ? <p style={{ margin: 0, fontSize: 12.5, overflowWrap: "anywhere" }}>{event.location}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Badge tone={event.status === "cancelled" ? "danger" : "neutral"} size="sm">{event.status === "cancelled" ? t("associationAgenda.cancelled") : event.registration === "waitlisted" ? t("associationAgenda.waitlisted") : t("associationAgenda.confirmed")}</Badge>
        <Link href={href} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "var(--primary-600)", fontSize: 12, fontWeight: 700 }}>{t("associationAgenda.open")}</Link>
      </div>
      {event.registration === "waitlisted" ? <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>{t("associationAgenda.waitlistHint")}</p> : null}
    </article>
  </Card>
}
