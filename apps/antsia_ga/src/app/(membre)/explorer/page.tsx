import type { Metadata } from "next"

import { MemberDiscoverScreen } from "@/components/discovery/discover-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("memberNetwork:nav.discover") }
}

/**
 * « Découvrir », destination des MEMBRES (P02) — sous le gabarit `(membre)` :
 * la coque du réseau (appels, présence, iCom) n'est pas démontée en y venant.
 * La découverte PUBLIQUE reste `/decouvrir`, hors de la coque.
 */
export default function MemberDiscoverPage() {
  return <MemberDiscoverScreen />
}
