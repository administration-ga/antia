import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  navigation: "destinations" as "destinations" | "volets",
  mobile: false as boolean | null,
  pathname: "/profil/autre",
  search: "",
}))

vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ navigation: state.navigation }) }))
vi.mock("@/components/network-shell", () => ({ useMemberSession: () => ({ person: { published: true, handle: "awa.ndong", displayName: "Awa Ndong", badges: [] } }) }))
vi.mock("@antsia/social-features/notifications", () => ({ NotificationBell: () => <span data-bell="" /> }))
vi.mock("@/components/identity-tools", () => ({ IdentityTools: () => <span data-identity="" /> }))
vi.mock("@/lib/sign-out", () => ({ signOutAndRedirect: vi.fn() }))
vi.mock("@antsia/social-features/reseau-personnel", () => ({
  ReseauMenuRail: (props: { activeTab: unknown; current?: unknown; onCreate?: unknown; onSelectTab?: unknown }) => (
    <div data-rail={JSON.stringify({ activeTab: props.activeTab, current: props.current ?? "auto", create: typeof props.onCreate === "function", select: props.onSelectTab !== undefined })} />
  ),
  ReseauMobileTabBar: (props: { active: unknown; handle?: unknown; current?: unknown; onCreate?: unknown }) => (
    <div data-bar={JSON.stringify({ active: props.active, handle: props.handle, current: props.current ?? "auto", create: typeof props.onCreate === "function" })} />
  ),
  PostComposerSheet: (props: { open: boolean }) => <div data-post-sheet={String(props.open)} />,
}))
vi.mock("@antsia/social-features/stories", () => ({ StoryCreateSheet: (props: { open: boolean }) => <div data-story-sheet={String(props.open)} /> }))
vi.mock("@antsia/social-features/features/reseau-personnel/use-creation-controller", () => ({
  useCreationController: () => ({ open: null, openCreation: vi.fn(), close: vi.fn() }),
}))
vi.mock("@antsia/ui/overlay", () => ({ DESKTOP_ONLY_CLASS: "hidden min-[960px]:block", useIsReseauMobile: () => state.mobile }))
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams(state.search) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { routes } from "@/lib/routes"
import { MemberPage, MemberTopBar } from "./member-chrome"

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"))
}

function attribute(html: string, name: string): Record<string, unknown> | null {
  const raw = new RegExp(`${name}="([^"]*)"`).exec(html)?.[1]
  return raw === undefined ? null : (JSON.parse(raw.replaceAll("&quot;", '"')) as Record<string, unknown>)
}

beforeEach(() => {
  state.navigation = "destinations"
  state.mobile = false
  state.pathname = "/profil/autre"
  state.search = ""
})

describe("MemberTopBar — la barre du haut sous les deux navigations", () => {
  it("destinations : marque (retour au fil), cloche, identité et sortie — aucune destination répétée", () => {
    const html = renderToStaticMarkup(<MemberTopBar />)
    expect(hrefsOf(html)).toEqual([routes.feed()])
    expect(html).toContain("data-bell")
    expect(html).toContain("data-identity")
    expect(html).toContain("nav.signOut")
    // La marque des chartes (ADR-0030) : la police d'affichage et son point à l'aplat d'identité.
    expect(html).toContain('data-brand=""')
    expect(html).toContain("var(--font-display, inherit)")
    expect(html).toContain("bg-[var(--primary-fill)]")
    // Plus un second repère « navigation » : un groupe d'outils nommé.
    expect(html).not.toContain("<nav")
    expect(html).toContain('<div aria-label="nav.sessionTools" role="group"')
  })

  it("volets (retour arrière) : les liens d'avant, à l'identique — Mon fil compris", () => {
    state.navigation = "volets"
    const html = renderToStaticMarkup(<MemberTopBar />)
    expect(hrefsOf(html)).toEqual([
      routes.feed(),
      routes.feedPreferences(),
      routes.nationalFeed(),
      routes.discover(),
      routes.moderation(),
      routes.messages(),
      routes.profile("awa.ndong"),
    ])
    expect(html).toContain('<nav aria-label="nav.label"')
  })
})

describe("MemberPage — les mêmes destinations que le fil, une coque d'appel intacte", () => {
  it("bureau : le rail des destinations (volets en liens, création branchée), jamais la barre du téléphone", () => {
    const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
    expect(attribute(html, "data-rail")).toEqual({ activeTab: null, current: "auto", create: true, select: false })
    expect(html).not.toContain("data-bar")
    expect(html).toContain('id="contenu"')
    expect(html).toContain("min-[960px]:grid")
  })

  it("téléphone : la barre basse (identifiant publié transmis), jamais le rail ; le bas de page lui laisse sa place", () => {
    state.mobile = true
    const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
    expect(attribute(html, "data-bar")).toEqual({ active: null, handle: "awa.ndong", current: "auto", create: true })
    expect(html).not.toContain("data-rail")
    expect(html).toContain("max-[959px]:pb-[calc(120px+env(safe-area-inset-bottom,0px))]")
  })

  it("avant de connaître la largeur, n'en monte aucun (pas de double carte « Créer »)", () => {
    state.mobile = null
    const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
    expect(html).not.toContain("data-rail")
    expect(html).not.toContain("data-bar")
  })

  it("range lui-même les pages qu'il est seul à connaître (le fil national sous Découvrir)", () => {
    state.pathname = routes.feed()
    state.search = "portee=national"
    expect(attribute(renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>), "data-rail")?.current).toEqual({ id: "decouvrir", current: "section" })
    state.pathname = routes.feedPreferences()
    state.search = ""
    expect(attribute(renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>), "data-rail")?.current).toEqual({ id: "profil", current: "section" })
  })

  it("monte les surfaces de création UNE fois pour la page, fermées", () => {
    const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
    expect(html.match(/data-post-sheet="false"/g)).toHaveLength(1)
    expect(html.match(/data-story-sheet="false"/g)).toHaveLength(1)
  })

  it("une page de direct garde l'écran entier : ni rail, ni barre", () => {
    for (const pathname of [routes.direct("s1"), routes.conference("s1")]) {
      state.pathname = pathname
      for (const mobile of [true, false]) {
        state.mobile = mobile
        const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
        expect(html).not.toContain("data-rail")
        expect(html).not.toContain("data-bar")
      }
    }
  })

  it("volets (retour arrière) : la page d'avant, sans rail, barre ni surface ajoutée", () => {
    state.navigation = "volets"
    const html = renderToStaticMarkup(<MemberPage><p>contenu</p></MemberPage>)
    expect(html).not.toContain("data-rail")
    expect(html).not.toContain("data-bar")
    expect(html).not.toContain("data-post-sheet")
    expect(html).toContain('<main id="contenu" tabindex="-1" class="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring mx-auto w-full max-w-7xl px-4 py-6 sm:px-5">')
  })
})
