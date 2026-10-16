import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { StoriesScreen } from "@/components/stories/stories-screen"
import { getAppT } from "@/i18n/server"
import { STORIES_NEW_SEGMENT } from "@/lib/routes"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("stories.title") }
}

/** Le lecteur plein écran des statuts (et, sur `…/nouvelle`, le composeur ouvert). */
export default async function StoriesPage({ params }: { params: Promise<{ chemin?: string[] }> }) {
  const { chemin = [] } = await params
  if (chemin.length > 1 || (chemin.length === 1 && chemin[0] !== STORIES_NEW_SEGMENT)) notFound()
  return <StoriesScreen openCreate={chemin[0] === STORIES_NEW_SEGMENT} />
}
