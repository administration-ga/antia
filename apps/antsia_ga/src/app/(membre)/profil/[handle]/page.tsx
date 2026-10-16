import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProfileScreen } from "@/components/reseau/reseau-screens"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

type Params = Promise<{ handle: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { t } = getAppT()
  const handle = decodeRouteSegment((await params).handle)
  return { title: t("profile.title", { handle: handle ?? "" }) }
}

/**
 * Le profil d'une personne du réseau. L'identifiant n'est pas validé ici : le
 * moteur rend un refus INDISTINCT pour un identifiant inconnu, un profil
 * retiré ou un blocage — le filtrer côté route distinguerait ces cas.
 */
export default async function ProfilePage({ params }: { params: Params }) {
  const handle = decodeRouteSegment((await params).handle)
  if (handle === null) notFound()
  return <ProfileScreen handle={handle} />
}
