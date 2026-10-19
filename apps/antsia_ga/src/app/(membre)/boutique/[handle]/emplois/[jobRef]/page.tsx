import { notFound } from "next/navigation"
import { MemberJobScreen } from "@/components/jobs/member-shop-jobs-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("jobs:details.title"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ handle: string; jobRef: string }> }) {
  const raw = await params
  const handle = decodeRouteSegment(raw.handle)
  const jobRef = decodeRouteSegment(raw.jobRef)
  if (!handle || !jobRef) notFound()
  return <MemberJobScreen handle={handle} jobRef={jobRef} />
}
