import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { MessagesScreen } from "@/components/messages/messages-screen"
import { getAppT } from "@/i18n/server"
import { parseMessagesSegments } from "@/lib/messages-route"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("messages.title") }
}

/**
 * La messagerie (iCom) en pages : liste, conversation, composeurs. La capacité
 * de navigation ANTSIA sert une liste et un détail au bureau, puis des pages
 * immersives au téléphone. L'aiguillage historique reste disponible aux autres
 * consommateurs (`MessagesRoute` choisit).
 */
export default async function MessagesPage({ params }: { params: Promise<{ chemin?: string[] }> }) {
  const { chemin = [] } = await params
  const route = parseMessagesSegments(chemin)
  if (route === null) notFound()
  return <MessagesScreen route={route} />
}
