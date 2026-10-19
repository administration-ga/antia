import type { Metadata } from "next"

import { ShopLinkCallbackScreen } from "@/components/shops/shop-link-callback-screen"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function ShopLinkReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const state = typeof params.etat === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(params.etat) ? params.etat : null
  const code = typeof params.code === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(params.code) ? params.code : null
  return <ShopLinkCallbackScreen state={state} code={code} />
}
