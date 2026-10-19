import { notFound } from "next/navigation"
import { PurchaseScreen } from "@/components/purchases/purchases-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"
export function generateMetadata() { return { title: getAppT().t("purchases:detailTitle"), robots: { index: false, follow: false } } }
export default async function Page({ params }: { params: Promise<{ purchaseId: string }> }) { const purchaseId = decodeRouteSegment((await params).purchaseId); if (!purchaseId) notFound(); return <PurchaseScreen purchaseId={purchaseId} /> }
