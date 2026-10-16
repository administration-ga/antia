import type { Metadata } from "next"

import { WelcomeScreen } from "@/components/welcome-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("welcome.title") }
}

export default function WelcomePage() {
  return <WelcomeScreen />
}
