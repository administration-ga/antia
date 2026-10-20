import type { PublicPost } from "@antsia/social-contracts/publicNetwork"
import { createAppI18n } from "@antsia/social-features/i18n"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), posts: vi.fn() }))
vi.mock("@/components/access-home-screen", () => ({ AccessHomeScreen: ({ publicPreview }: { publicPreview?: ReactNode }) => <div data-access-home="true">{publicPreview}</div> }))
vi.mock("@/lib/server-session", () => ({ getPublicLocale: async () => "fr" }))
vi.mock("@/lib/public-data", () => ({
  loadPublicSnapshot: mocks.snapshot,
  loadPublicPosts: mocks.posts,
  publicSearch: (search: Record<string, unknown>) => ({ cursor: typeof search.cursor === "string" ? search.cursor : null, handoff: Object.hasOwn(search, "ott") }),
}))
vi.mock("./public-shell", () => ({ PublicShell: ({ children }: { children: ReactNode }) => <div data-public-shell="true">{children}</div> }))
vi.mock("./public-status", () => ({ PublicStatus: ({ status }: { status: string }) => <div data-public-status={status} /> }))

import { HomeScreen } from "./public-routes"

function renderPublic(children: ReactNode) {
  const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "antsia" })
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.posts.mockResolvedValue({ status: "ready", viewer: "anonymous", data: { page: [], isDone: true, continueCursor: "" } })
})
describe("route d'accueil — garde OTT", () => {
  it("charge l'aperçu public en HTML initial avec la porte d'accès, sans compteur inventé", async () => {
    const post: PublicPost = { id: "public-home-post", body: "Une contribution publique", publishedAt: 1_700_000_000_000, editedAt: null, tags: [], province: null, author: { kind: "person", handle: null, displayName: null, badges: [], avatarUrl: null }, origin: { slug: "antsia", name: "ANTSIA" }, media: [], shared: null }
    mocks.posts.mockResolvedValue({ status: "ready", viewer: "anonymous", data: { page: [post], isDone: true, continueCursor: "" } })
    const html = renderPublic(await HomeScreen({}))
    expect(html).toContain('data-access-home="true"')
    expect(html).toContain('id="public-home-feed"')
    expect(html).toContain('data-post-presentation="charte"')
    expect(html).toContain(post.body)
    expect(html).toContain("Profil non publié")
    expect(html).toContain(`href="${routes.signIn(undefined, post.id)}"`)
    expect(mocks.posts).toHaveBeenCalledExactlyOnceWith(null)
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })

  it("conserve la page suivante d'une fenêtre publique vide", async () => {
    mocks.posts.mockResolvedValue({ status: "ready", viewer: "anonymous", data: { page: [], isDone: false, continueCursor: "next=opaque" } })
    const html = renderPublic(await HomeScreen({ searchParams: Promise.resolve({ cursor: "previous-window" }) }))
    expect(mocks.posts).toHaveBeenCalledExactlyOnceWith("previous-window")
    expect(html).toContain("Cette fenêtre ne contient aucune publication visible")
    expect(html).toContain("cursor=next%3Dopaque")
    expect(html).toContain("Page suivante")
    expect(html).not.toContain('data-post-presentation="charte"')
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })

  it.each(["refused", "unavailable"] as const)("garde l'accès et un état honnête sans données quand l'aperçu est %s", async (status) => {
    mocks.posts.mockResolvedValue({ status })
    const html = renderPublic(await HomeScreen({}))
    expect(html).toContain('data-access-home="true"')
    expect(html).toContain('id="public-home-feed"')
    expect(html).toContain(status === "refused" ? "Contenu indisponible" : "La lecture est momentanément indisponible")
    expect(html).not.toContain('data-post-presentation="charte"')
    expect(mocks.posts).toHaveBeenCalledExactlyOnceWith(null)
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })

  it("un OTT, même vide, garde le passage sur cette origine sans rendre la carte ou des contenus", async () => {
    for (const ott of ["", "private-one-time-token"]) {
      const html = renderToStaticMarkup(await HomeScreen({ searchParams: Promise.resolve({ ott }) }))
      expect(html).toContain('data-public-status="handoff"')
      expect(html).not.toContain("data-access-home")
      expect(html).not.toContain('id="public-home-feed"')
      expect(html).not.toContain('data-post-presentation="charte"')
      expect(html).not.toContain("private-one-time-token")
    }
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.posts).not.toHaveBeenCalled()
  })
})
