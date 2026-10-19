import { notFound } from "next/navigation"
import { MemberShopJobsScreen } from "@/components/jobs/member-shop-jobs-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("jobs:shop.title"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const handle = decodeRouteSegment((await params).handle)
  if (!handle) notFound()
  return <MemberShopJobsScreen handle={handle} />
}
