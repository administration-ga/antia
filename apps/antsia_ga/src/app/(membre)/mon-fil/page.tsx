import type { Metadata } from "next"

import { FeedPreferencesScreen } from "@/components/feed/feed-preferences-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("feedPreferences.title") }
}

export default function FeedPreferencesPage() {
  return <FeedPreferencesScreen />
}
