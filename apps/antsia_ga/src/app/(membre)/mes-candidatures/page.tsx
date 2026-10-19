import { MyApplicationsScreen } from "@/components/jobs/my-applications-screen"
import { getAppT } from "@/i18n/server"
export function generateMetadata() { return { title: getAppT().t("jobs:applications.title"), robots: { index: false, follow: false } } }
export default function Page() { return <MyApplicationsScreen /> }
