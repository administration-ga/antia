import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MemberStorefrontScreen } from "@/components/shops/member-storefront-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

type Params = Promise<{ handle: string }>
export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("shops:storefront.title"), robots: { index: false, follow: false } }
}
export default async function StorefrontPage({ params }: { params: Params }) {
  const handle = decodeRouteSegment((await params).handle)
  if (handle === null) notFound()
  return <MemberStorefrontScreen handle={handle} />
}
