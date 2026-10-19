import type { Metadata } from "next"

import { NotificationOpenScreen } from "@/components/notification-open-screen"
import { getAppT } from "@/i18n/server"
import { NOTIFICATION_REFERENCE_PARAM, parseNotificationReference } from "@/lib/notification-open"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("notificationOpen.title"), robots: { index: false, follow: false }, referrer: "no-referrer" }
}

export default async function NotificationOpenPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams ?? {}
  return <NotificationOpenScreen reference={parseNotificationReference(search[NOTIFICATION_REFERENCE_PARAM])} />
}
