"use client"

import type { Id } from "@antsia/api/engine"
import { DirectPage } from "@antsia/social-features/direct"

import { MemberPage } from "@/components/member-chrome"

export function ConferenceScreen({ sessionId }: { sessionId: string }) {
  return <MemberPage><DirectPage sessionId={sessionId as Id<"liveSessions">} /></MemberPage>
}
