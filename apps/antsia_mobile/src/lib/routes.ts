/** Table native fermée. Un lien est une référence à relire sous la session courante, jamais un droit. */
export type NativeRoute =
  | { name: "feed" }
  | { name: "messages" }
  | { name: "settings" }
  | { name: "post"; id: string }
  | { name: "conversation"; id: string }

export function nativeRouteFromUrl(raw: string, scheme: string | null): NativeRoute | null {
  if (!scheme || raw.length > 512) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== `${scheme}:` || url.username || url.password || url.port || url.search || url.hash) return null
    const segments = [url.hostname, ...url.pathname.split("/")].filter(Boolean)
    if (segments.length === 1) {
      if (segments[0] === "fil") return { name: "feed" }
      if (segments[0] === "messages") return { name: "messages" }
      if (segments[0] === "reglages") return { name: "settings" }
    }
    if (segments.length !== 2 || !/^[a-z0-9]{16,64}$/.test(segments[1] ?? "")) return null
    if (segments[0] === "publication") return { name: "post", id: segments[1]! }
    if (segments[0] === "conversation") return { name: "conversation", id: segments[1]! }
    // Aucun callback de session, jeton, appel ni achat accepté dans ce lot.
    return null
  } catch { return null }
}

export const nativeWebRoutes = {
  enter: (origin: string) => new URL("/entrer", origin).href,
  profile: (origin: string, handle: string) => new URL(`/@${encodeURIComponent(handle)}`, origin).href,
}
