import type { Metadata } from "next"

import { FeedScreen } from "@/components/feed/feed-screen"
import { getAppT } from "@/i18n/server"
import { memberFeedFilter } from "@/components/discovery/member-feed-filter"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("feed.title") }
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <FeedScreen filter={memberFeedFilter(await searchParams)} />
}
