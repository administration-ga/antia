import { notFound } from "next/navigation"
import { ServiceOrderScreen } from "@/components/services/service-order-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("services:order.title"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ handle: string; offerRef: string }> }) {
  const raw = await params
  const handle = decodeRouteSegment(raw.handle)
  const offerRef = decodeRouteSegment(raw.offerRef)
  if (!handle || !offerRef) notFound()
  return <ServiceOrderScreen handle={handle} offerRef={offerRef} />
}
