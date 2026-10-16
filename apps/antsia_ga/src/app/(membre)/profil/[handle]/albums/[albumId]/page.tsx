import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AlbumScreen } from "@/components/reseau/reseau-screens"
import { getAppT } from "@/i18n/server"
import { decodeRouteSegment } from "@/lib/route-params"

type Params = Promise<{ handle: string; albumId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { t } = getAppT()
  const handle = decodeRouteSegment((await params).handle)
  return { title: t("album.title", { handle: handle ?? "" }) }
}

/**
 * La galerie d'un album. Ni l'identifiant ni l'album ne sont validés ici : le
 * moteur rend un refus INDISTINCT (album inconnu, brouillon d'autrui, réservé
 * aux connexions d'un autre, blocage).
 */
export default async function ProfileAlbumPage({ params }: { params: Params }) {
  const { handle: rawHandle, albumId: rawAlbumId } = await params
  const handle = decodeRouteSegment(rawHandle)
  const albumId = decodeRouteSegment(rawAlbumId)
  if (handle === null || albumId === null) notFound()
  return <AlbumScreen handle={handle} albumId={albumId} />
}
