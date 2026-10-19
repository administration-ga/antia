import { notFound } from "next/navigation"
import { AlbumScreen } from "@/components/reseau/reseau-screens"
import { decodeRouteSegment } from "@/lib/route-params"

export default async function PublicHandleAlbumPage({ params }: { params: Promise<{ publicHandle: string; albumId: string }> }) {
  const { publicHandle, albumId: rawAlbum } = await params
  const handle = decodeRouteSegment(publicHandle)
  const albumId = decodeRouteSegment(rawAlbum)
  if (handle === null || !handle.startsWith("@") || handle.length < 2 || albumId === null) notFound()
  return <AlbumScreen handle={handle.slice(1)} albumId={albumId} />
}
