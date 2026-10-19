import { CartScreen } from "@/components/cart/cart-screen"
import { getAppT } from "@/i18n/server"
export function generateMetadata() { return { title: getAppT().t("cart:title"), robots: { index: false, follow: false } } }
export default function Page() { return <CartScreen /> }
