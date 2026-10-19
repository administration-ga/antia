// Dupliqué de socle/packages/agent-features/src/features/direct/direct-floating.ts @ ad2e7fdc2 — adaptations : route injectée, clés préfixées par le réseau, labels i18n et état connecting/error sans jeton conservé ; la page se reconnaît à TOUTES ses adresses (conférence et alias déclarés par l'application, `conferenceAliases`).
export type DirectCardPose = "card" | "pill" | "mobile"
export function directCardPose(input: { isMobile: boolean | null; minimized: boolean }): DirectCardPose | null {
  if (input.isMobile === null) return null
  return input.isMobile ? "mobile" : input.minimized ? "pill" : "card"
}
export function directPresentationPlace(input: { heldSessionId: string | null; hasCredentials: boolean; pendingOrError?: boolean; pathname: string | null; pageHrefs: readonly string[] }): "hidden" | "page" | "floating" {
  if (input.heldSessionId === null || (!input.hasCredentials && !input.pendingOrError)) return "hidden"
  const here = input.pathname?.replace(/\/+$/, "")
  return input.pageHrefs.some((href) => href.replace(/\/+$/, "") === here) ? "page" : "floating"
}
