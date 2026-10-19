import { notFound } from "next/navigation"
import { MemberOfferScreen } from "@/components/shops/catalog-member-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("shops:catalog.offerTitle"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ handle: string; offerRef: string }> }) {
  const raw = await params
  const handle = decodeRouteSegment(raw.handle)
  const offerRef = decodeRouteSegment(raw.offerRef)
  if (!handle || !offerRef) notFound()
  return <MemberOfferScreen handle={handle} offerRef={offerRef} />
}
