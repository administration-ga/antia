import { notFound } from "next/navigation"
import { ConferenceScreen } from "@/components/direct/conference-screen"
import { decodeRouteSegment } from "@/lib/route-params"

export default async function DirectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeRouteSegment((await params).id)
  if (id === null) notFound()
  return <ConferenceScreen sessionId={id} />
}
