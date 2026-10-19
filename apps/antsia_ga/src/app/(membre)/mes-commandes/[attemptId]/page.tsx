import { notFound } from "next/navigation"
import { CheckoutAttemptScreen } from "@/components/checkout/checkout-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("checkout:attemptTitle"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const attemptId = decodeRouteSegment((await params).attemptId)
  if (!attemptId) notFound()
  return <CheckoutAttemptScreen attemptId={attemptId} />
}
