import { notFound } from "next/navigation"
import { MyApplicationScreen } from "@/components/jobs/my-application-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("jobs:applications.detailTitle"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const applicationId = decodeRouteSegment((await params).applicationId)
  if (!applicationId) notFound()
  return <MyApplicationScreen applicationId={applicationId} />
}
