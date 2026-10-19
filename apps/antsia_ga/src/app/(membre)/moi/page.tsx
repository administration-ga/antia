import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MemberMeScreen } from "./me-screen"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("me.title") }
}

/**
 * « Profil », destination des MEMBRES (P02) : l'espace personnel — mon profil
 * public, mes préférences, mes données, la sortie. Sous le gabarit `(membre)`.
 */
export default function MemberMePage() {
  return <MemberMeScreen />
}
