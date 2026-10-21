import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@antsia/social-features/messagerie", () => ({ MessagesRoute: () => <section data-messages-content="" /> }))
vi.mock("@/components/member-chrome", () => ({ MemberTopBar: ({ onMobile }: { onMobile: string }) => <header data-mobile={onMobile} /> }))
vi.mock("@/components/shops/contact-messages", () => ({ useCommercialMessages: () => undefined }))

import { MessagesScreen } from "./messages-screen"

afterEach(() => vi.unstubAllEnvs())

describe("hauteur de la messagerie sous le bandeau démo", () => {
  it("borne la messagerie à la hauteur disponible dans la zone démo", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
    const html = renderToStaticMarkup(<MessagesScreen route={{}} />)
    expect(html).toContain('class="esp-page-motif flex h-dvh flex-col overflow-hidden bg-background"')
    expect(html).toContain('style="height:calc(100dvh - var(--antsia-demo-banner-height, 0px))"')
    expect(html).toContain('data-mobile="visible"')
    expect(html).toContain('data-messages-content=""')
  })

  it("conserve le masquage de la barre dans une conversation immersive de démo", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
    expect(renderToStaticMarkup(<MessagesScreen route={{ kind: "personne", id: "fixture" }} />)).toContain('data-mobile="hidden"')
  })

  it.each(["", "/demo"])("la hauteur du principal reste 100dvh avec basePath %j", (basePath) => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", basePath)
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://diligent-avocet-585.convex.cloud")
    const html = renderToStaticMarkup(<MessagesScreen route={{}} />)
    expect(html).not.toContain('style="')
    expect(html).toContain('class="esp-page-motif flex h-dvh flex-col overflow-hidden bg-background"')
  })
})
