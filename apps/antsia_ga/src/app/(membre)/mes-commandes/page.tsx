import { CheckoutOrdersScreen } from "@/components/checkout/checkout-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata() { return { title: getAppT().t("checkout:ordersTitle"), robots: { index: false, follow: false } } }
export default function Page() { return <CheckoutOrdersScreen /> }
