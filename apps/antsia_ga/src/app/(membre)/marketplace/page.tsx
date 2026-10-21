import type { Metadata } from "next"
import { MarketplaceScreen } from "@/components/marketplace/marketplace-screen"
import { getAppT } from "@/i18n/server"
import { marketplaceSearch } from "@/lib/marketplace-search"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("marketplace:title") }
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MarketplaceScreen search={marketplaceSearch(await searchParams)} />
}
