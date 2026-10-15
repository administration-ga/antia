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
 * La messagerie (iCom) en pages : liste, conversation, composeurs. Au bureau,
 * ces adresses ouvrent la carte iCom détachée sur le fil ; au téléphone, elles
 * rendent la page iCom (`MessagesRoute` choisit).
 */
export default async function MessagesPage({ params }: { params: Promise<{ chemin?: string[] }> }) {
  const { chemin = [] } = await params
  const route = parseMessagesSegments(chemin)
  if (route === null) notFound()
  return <MessagesScreen route={route} />
}
