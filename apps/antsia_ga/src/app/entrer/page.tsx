import type { Metadata } from "next"

import { SignInScreen } from "@/components/sign-in-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("signIn.title") }
}

export default function SignInPage() {
  return <SignInScreen />
}
