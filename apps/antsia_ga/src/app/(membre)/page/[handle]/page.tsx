import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageProfileScreen } from "@/components/reseau/reseau-screens"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

type Params = Promise<{ handle: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { t } = getAppT()
  const handle = decodeRouteSegment((await params).handle)
  return { title: t("pageProfile.title", { handle: handle ?? "" }) }
}

/**
 * La fiche d'une page. L'identifiant n'est pas validé ici : le moteur rend un
 * refus INDISTINCT pour une page inconnue ou désactivée.
 */
export default async function PageProfilePage({ params }: { params: Params }) {
  const handle = decodeRouteSegment((await params).handle)
  if (handle === null) notFound()
  return <PageProfileScreen handle={handle} />
}
