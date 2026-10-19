import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  data: undefined as undefined | { page: { _id: string }[]; isDone: boolean; continueCursor: string },
  error: null as unknown,
  calls: [] as unknown[],
  refetch: vi.fn(),
}))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { discovery: { discovery: { rootFeed: "root-feed" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: unknown, args: unknown) => { state.calls.push([reference, args]); return { data: state.data, error: state.error, refetch: state.refetch } } }))
// P04 : le fil immersif n'est pas déclaré ici (`useFeedImmersion` rend `null`) — la liste historique, à l'identique.
vi.mock("@antsia/social-features/reseau-personnel", () => ({ PostCard: ({ post }: { post: { _id: string } }) => <article data-post={post._id} />, useFeedImmersion: () => null }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { MemberDiscoveryFeed } from "./member-feed"

beforeEach(() => { state.data = undefined; state.error = null; state.calls = []; state.refetch.mockReset() })

describe("fil national : lecture bornée et états honnêtes", () => {
  it("transmet le réseau, la province volontaire et la continuation sans élargissement", () => {
    renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national", province: "nyanga", tag: "école", cursor: "opaque" }} />)
    expect(state.calls).toEqual([["root-feed", { networkId: "network", province: "nyanga", tag: "école", paginationOpts: { numItems: 20, cursor: "opaque", maximumRowsRead: 100, maximumBytesRead: 1_048_576 } }]])
  })
  it("une page filtrée vide conserve sa continuation", () => {
    state.data = { page: [], isDone: false, continueCursor: "next" }
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toContain("discovery.emptyWindow")
    expect(html).toContain("common.next")
    expect(html).not.toContain("common.end")
  })
  it("une panne ne se transforme pas en résultat vide", () => {
    state.error = new Error("read failed")
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toContain("common.retry")
    expect(html).not.toContain("discovery.empty")
    expect(html).not.toContain("common.end")
  })
  it("réutilise les cartes servies et rend une fin réelle distincte du chargement", () => {
    state.data = { page: [{ _id: "admitted" }], isDone: true, continueCursor: "" }
    const html = renderToStaticMarkup(<MemberDiscoveryFeed filter={{ kind: "national" }} />)
    expect(html).toContain('data-post="admitted"')
    expect(html).toContain("common.end")
    expect(html).not.toContain("common.loading")
  })
})
