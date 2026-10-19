"use client"

import { MessagesRoute } from "@antsia/social-features/messagerie"
import { Suspense } from "react"
import { MemberTopBar } from "@/components/member-chrome"
import { useCommercialMessages } from "@/components/shops/contact-messages"

import type { MessagesRouteTarget } from "@/lib/messages-route"

export function MessagesScreen({ route }: { route: MessagesRouteTarget }) {
  const commercial = useCommercialMessages()
  const immersive = route.compose !== undefined || (route.kind !== undefined && route.id !== undefined)
  return (
    <div className="esp-page-motif flex h-dvh flex-col overflow-hidden bg-background">
      <div className="shrink-0"><MemberTopBar onMobile={immersive ? "hidden" : "visible"} /></div>
      <main id="contenu" tabIndex={-1} className="min-h-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <Suspense fallback={null}>
          <MessagesRoute {...route} commercial={commercial} />
        </Suspense>
      </main>
    </div>
  )
}
