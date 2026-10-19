"use client"

import { CommercialConversationView } from "@antsia/social-features/messagerie"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { routes } from "@/lib/routes"
import { ContactCrm } from "./contact-crm"
import { ContactInbox } from "./contact-inbox"

/** L'application ANTSIA seule injecte son canal boutique dans la destination iCom. */
export function useCommercialMessages() {
  const router = useRouter()
  return useMemo(() => ({
    renderList: (query: string) => <ContactInbox query={query} />,
    renderConversation: (threadId: string) => <CommercialConversationView threadId={threadId} onBack={() => router.push(routes.messages())} onOpenOffer={(handle, offerRef) => router.push(routes.shopOffer(handle, offerRef))} renderExtras={(thread) => <ContactCrm thread={thread} />} />,
  }), [router])
}
