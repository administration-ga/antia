import { notFound } from "next/navigation"
import { ServiceRequestScreen } from "@/components/services/service-requests-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("services:requests.detailTitle"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const requestRowId = decodeRouteSegment((await params).requestId)
  if (!requestRowId) notFound()
  return <ServiceRequestScreen requestRowId={requestRowId} />
}
