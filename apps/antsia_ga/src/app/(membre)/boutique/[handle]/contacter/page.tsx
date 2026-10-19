import { notFound } from "next/navigation"
import { ContactRequestScreen } from "@/components/shops/contact-request-screen"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"
import { parseShopContactContinuation } from "@/lib/shop-contact-continuation"

export function generateMetadata() { return { title: getAppT().t("shops:contact.ask"), robots: { index: false, follow: false } } }
export default async function Page({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { handle: raw } = await params
  const search = await searchParams
  const handle = decodeRouteSegment(raw)
  const contact = parseShopContactContinuation({ kind: "shop_contact", handle, ...(search.offre === undefined ? {} : { offerRef: search.offre }) })
  if (!contact) notFound()
  return <ContactRequestScreen handle={contact.handle} offerRef={contact.offerRef} />
}
