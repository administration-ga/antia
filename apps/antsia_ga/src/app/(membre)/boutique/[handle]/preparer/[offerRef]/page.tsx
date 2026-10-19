import { notFound } from "next/navigation"
import { CheckoutPrepareScreen } from "@/components/checkout/checkout-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("checkout:title"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ handle: string; offerRef: string }> }) {
  const raw = await params
  const handle = decodeRouteSegment(raw.handle)
  const offerRef = decodeRouteSegment(raw.offerRef)
  if (!handle || !offerRef) notFound()
  return <CheckoutPrepareScreen handle={handle} offerRef={offerRef} />
}
