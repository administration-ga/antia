// P04 (18/10/2026) : les portées National, province et mot-clé dans le lecteur immersif — même fenêtre d'adresse, pagination dans la fin, bascule toujours là.
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  data: undefined as undefined | { page: { _id: string; page: null; author: { displayName: string } }[]; isDone: boolean; continueCursor: string },
  immersive: true,
}))

vi.mock("@antsia/api/engine", () => ({ api: { modules: { discovery: { discovery: { rootFeed: "root-feed" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ data: state.data, error: null, refetch: vi.fn() }) }))
vi.mock("@antsia/social-features/reseau-personnel", () => ({
  PostCard: ({ post }: { post: { _id: string } }) => <article data-post={post._id} />,
  useFeedImmersion: () => ({
    mode: { pose: "phone", known: true, preferred: "immersive", effective: state.immersive ? "immersive" : "list", fallback: null, explicit: false, setMode: () => {} },
    immersive: state.immersive,
    restore: null,
    onRestored: () => {},
    recordSlotAnchor: () => {},
    recordListAnchor: () => {},
    surfaceMemory: { initialGalleryIndex: () => null, reportGalleryIndex: () => {} },
    changeMode: () => {},
  }),
  useImmersiveFrozenHead: () => 0,
  useImmersivePageReport: () => {},
  ImmersiveFeedReader: ({ head, toggle, end, children }: { head: ReactNode; toggle: ReactNode; end: ReactNode; children: ReactNode }) => (
    <section data-reader="">
      <div data-bar="">{toggle}</div>
      <div data-head="">{head}</div>
      <div data-feed="">{children}</div>
      <div data-end="">{end}</div>
    </section>
  ),
  ImmersiveFeedSlot: ({ postId, label, children }: { postId: string; label: string; children: ReactNode }) => (
    <div data-slot={postId} aria-label={label}>
      {children}
    </div>
  ),
  ImmersiveStatusSlot: ({ children }: { children: ReactNode }) => <div data-status-slot="">{children}</div>,
  FeedModeToggle: () => <div data-toggle="" />,
  FeedSurfaceMemoryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  FeedPostMemoryScope: ({ children }: { children: ReactNode }) => <>{children}</>,
  FeedListReturn: () => <span data-list-return="" />,
}))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { MemberDiscoveryFeed } from "./member-feed"

beforeEach(() => {
  state.data = undefined
  state.immersive = true
})

describe("fil national en immersion", () => {
  it("la fenêtre de l'adresse dans le lecteur : tête, créneaux nommés, pagination dans la fin", () => {
    state.data = { page: [{ _id: "admitted", page: null, author: { displayName: "Awa" } }], isDone: false, continueCursor: "next" }
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toContain("data-reader")
    expect(html).toMatch(/data-head="">.*discovery\.nationalTitle/)
    expect(html).toContain('data-slot="admitted"')
    expect(html).toContain('data-post="admitted"')
    expect(html).toMatch(/data-end="">.*common\.next/)
    expect(html).toContain("data-toggle")
  })

  it("une fenêtre vide garde sa continuation, dans la fin du lecteur", () => {
    state.data = { page: [], isDone: false, continueCursor: "next" }
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toMatch(/data-end="">.*discovery\.emptyWindow/)
    expect(html).toContain("common.next")
    expect(html).not.toContain("common.end")
  })

  it("le chargement occupe un créneau, sans prétendre une fin", () => {
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toContain("data-status-slot")
    expect(html).toContain("common.loading")
    expect(html).not.toContain("common.end")
  })
})

describe("fil national en liste (capacité déclarée)", () => {
  it("la bascule précède la fenêtre ; chaque carte a son enveloppe d'ancre ; le retour est suivi", () => {
    state.immersive = false
    state.data = { page: [{ _id: "admitted", page: null, author: { displayName: "Awa" } }], isDone: true, continueCursor: "" }
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).not.toContain("data-reader")
    expect(html).toContain("data-toggle")
    expect(html).toContain('data-feed-anchor="admitted"')
    expect(html).toContain("data-list-return")
    expect(html).toContain("common.end")
  })
})
