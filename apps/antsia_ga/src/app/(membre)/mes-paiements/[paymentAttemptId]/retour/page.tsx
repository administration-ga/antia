import { notFound } from "next/navigation"
import { PaymentAttemptScreen } from "@/components/payment/payment-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

export function generateMetadata() { return { title: getAppT().t("payment:returnTitle"), robots: { index: false, follow: false } } }
/** Les paramètres du prestataire ne sont jamais lus comme une preuve de règlement. */
export default async function Page({ params }: { params: Promise<{ paymentAttemptId: string }> }) {
  const paymentAttemptId = decodeRouteSegment((await params).paymentAttemptId)
  if (!paymentAttemptId) notFound()
  return <PaymentAttemptScreen paymentAttemptId={paymentAttemptId} returnedFromProvider />
}
