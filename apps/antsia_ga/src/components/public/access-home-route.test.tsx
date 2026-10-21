import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), posts: vi.fn() }))
vi.mock("@/components/access-home-screen", () => ({ AccessHomeScreen: () => <div data-access-home="true" /> }))
vi.mock("@/lib/server-session", () => ({ getPublicLocale: async () => "fr" }))
vi.mock("@/lib/public-data", () => ({
  loadPublicSnapshot: mocks.snapshot,
  loadPublicPosts: mocks.posts,
  publicSearch: (search: Record<string, unknown>) => ({ cursor: null, handoff: Object.hasOwn(search, "ott") }),
}))
vi.mock("./public-shell", () => ({ PublicShell: ({ children }: { children: React.ReactNode }) => <div data-public-shell="true">{children}</div> }))
vi.mock("./public-status", () => ({ PublicStatus: ({ status }: { status: string }) => <div data-public-status={status} /> }))

import { HomeScreen } from "./public-routes"

beforeEach(() => vi.clearAllMocks())
describe("route d'accueil — garde OTT", () => {
  it("monte la porte d'accès sans charger de publication ni de compteur", async () => {
    const html = renderToStaticMarkup(await HomeScreen({}))
    expect(html).toContain('data-access-home="true"')
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.posts).not.toHaveBeenCalled()
  })

  it("un OTT, même vide, garde le passage sur cette origine sans rendre la carte ou des contenus", async () => {
    for (const ott of ["", "private-one-time-token"]) {
      const html = renderToStaticMarkup(await HomeScreen({ searchParams: Promise.resolve({ ott }) }))
      expect(html).toContain('data-public-status="handoff"')
      expect(html).not.toContain("data-access-home")
      expect(html).not.toContain("private-one-time-token")
    }
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.posts).not.toHaveBeenCalled()
  })
})
