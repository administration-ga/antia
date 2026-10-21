"use client"

import { useContextualMessages } from "@antsia/social-features/features/messagerie/contextual-entry"
import { MessagesRoute } from "@antsia/social-features/messagerie"
import { demoWorkspaceHeight } from "@/lib/demo-embed"
import { useNetwork } from "@antsia/api/network"
import { Suspense } from "react"
import { MemberPage, MemberTopBar } from "@/components/member-chrome"
import { useCommercialMessages } from "@/components/shops/contact-messages"

import type { MessagesRouteTarget } from "@/lib/messages-route"

export function MessagesScreen({ route }: { route: MessagesRouteTarget }) {
  const commercial = useCommercialMessages()
  const contextual = useContextualMessages({ kind: "professionalCollaboration" })
  const { navigation, navigationLayout } = useNetwork()
  const immersive = route.compose !== undefined || (route.kind !== undefined && route.id !== undefined)
  if (navigation === "destinations" && navigationLayout === "adaptive") {
    return <MemberPage workspace immersiveOnPhone={immersive}>
      <Suspense fallback={null}><MessagesRoute {...route} commercial={commercial} contextual={contextual} /></Suspense>
    </MemberPage>
  }
  return (
    <div className="esp-page-motif flex h-dvh flex-col overflow-hidden bg-background" style={{ height: demoWorkspaceHeight() }}>
      <div className="shrink-0"><MemberTopBar onMobile={immersive ? "hidden" : "visible"} /></div>
      <main id="contenu" tabIndex={-1} className="min-h-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <Suspense fallback={null}>
          <MessagesRoute {...route} commercial={commercial} contextual={contextual} />
        </Suspense>
      </main>
    </div>
  )
}
