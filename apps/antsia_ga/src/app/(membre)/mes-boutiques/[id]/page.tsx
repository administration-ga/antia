import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShopEditorScreen } from "@/components/shops/shop-editor-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

type Params = Promise<{ id: string }>
export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("shops:editor.title"), robots: { index: false, follow: false } }
}
export default async function ShopEditorPage({ params }: { params: Params }) {
  const id = decodeRouteSegment((await params).id)
  if (id === null) notFound()
  return <ShopEditorScreen shopId={id} />
}
