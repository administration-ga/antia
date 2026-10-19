import { PurchasesScreen } from "@/components/purchases/purchases-screen"
import { getAppT } from "@/i18n/server"
export function generateMetadata() { return { title: getAppT().t("purchases:title"), robots: { index: false, follow: false } } }
export default function Page() { return <PurchasesScreen /> }
