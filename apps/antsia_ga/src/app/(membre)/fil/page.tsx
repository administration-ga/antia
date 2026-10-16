import type { Metadata } from "next"

import { FeedScreen } from "@/components/feed/feed-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("feed.title") }
}

export default function FeedPage() {
  return <FeedScreen />
}
