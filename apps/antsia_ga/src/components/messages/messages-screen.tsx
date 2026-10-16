"use client"

import { MessagesRoute } from "@antsia/social-features/messagerie"
import { Suspense } from "react"

import type { MessagesRouteTarget } from "@/lib/messages-route"

export function MessagesScreen({ route }: { route: MessagesRouteTarget }) {
  return (
    <main id="contenu" className="min-h-dvh bg-background">
      <Suspense fallback={null}>
        <MessagesRoute {...route} />
      </Suspense>
    </main>
  )
}
