// Dupliqué de socle/packages/agent-features/src/features/direct/direct-floating.ts @ ad2e7fdc2 — adaptations : route injectée, clés préfixées par le réseau, labels i18n et état connecting/error sans jeton conservé.
export type DirectCardPose = "card" | "pill" | "mobile"
export function directCardPose(input: { isMobile: boolean | null; minimized: boolean }): DirectCardPose | null {
  if (input.isMobile === null) return null
  return input.isMobile ? "mobile" : input.minimized ? "pill" : "card"
}
export function directPresentationPlace(input: { heldSessionId: string | null; hasCredentials: boolean; pendingOrError?: boolean; pathname: string | null; conferenceHref: string }): "hidden" | "page" | "floating" {
  if (input.heldSessionId === null || (!input.hasCredentials && !input.pendingOrError)) return "hidden"
  return input.pathname?.replace(/\/+$/, "") === input.conferenceHref.replace(/\/+$/, "") ? "page" : "floating"
}
