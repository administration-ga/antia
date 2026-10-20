"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { routes } from "@/lib/routes"

/**
 * P16 : avant de demander l'effacement, la personne apprend que ses rendez-vous chez des
 * professionnels ne sont pas annulés par l'effacement, et où les annuler elle-même. Lecture
 * personnelle et bornée : un nombre, aucun professionnel, réseau ni créneau affiché.
 */
export function ErasureCommerceNotice() {
  const { t } = useTranslation("antsia")
  const bookings = useAuthenticatedConvexQuery(api.modules.shops.serviceLifecycle.myUpcomingBookings, {})
  const data = bookings.data
  if (!data || data.count === 0) return null
  return <div role="note" className="mb-4 grid gap-2 rounded-[var(--ui2-card-radius)] border border-border p-[var(--esp-card-padding,16px)] text-sm">
    <p>{t(data.truncated ? "personal.eraseBookingsMany" : "personal.eraseBookings", { count: data.count })}</p>
    <Link className="inline-flex min-h-11 items-center underline" href={routes.serviceRequests()}>{t("personal.eraseBookingsLink")}</Link>
  </div>
}
