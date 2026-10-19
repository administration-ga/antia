import { ServiceRequestsScreen } from "@/components/services/service-requests-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata() { return { title: getAppT().t("services:requests.title"), robots: { index: false, follow: false } } }
export default function Page() { return <ServiceRequestsScreen /> }
