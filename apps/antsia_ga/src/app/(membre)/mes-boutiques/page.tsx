import type { Metadata } from "next"
import { MyShopsScreen } from "@/components/shops/my-shops-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("shops:list.title"), robots: { index: false, follow: false } }
}
export default function MyShopsPage() { return <MyShopsScreen /> }
