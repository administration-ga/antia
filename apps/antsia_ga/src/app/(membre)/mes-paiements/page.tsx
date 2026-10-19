import { PaymentListScreen } from "@/components/payment/payment-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata() { return { title: getAppT().t("payment:listTitle"), robots: { index: false, follow: false } } }
export default function Page() { return <PaymentListScreen /> }
