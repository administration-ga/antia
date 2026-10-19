// @vitest-environment jsdom
// PA6 : une panne et une fenêtre lacunaire ne deviennent jamais un fil complet vide.
import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@antsia/api/engine"

import { renderWithEngine } from "../../tests/engine-wrapper"

type Feed = FunctionReturnType<typeof api.modules.posts.posts.myFeed>
const state = vi.hoisted(() => ({
  data: undefined as Feed | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(async () => undefined),
  prepare: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => state, useConvexMutationQuery: () => ({ mutate: state.prepare }) }))
vi.mock("./PostCard", () => ({ PostCard: ({ post }: { post: { body: string } }) => <p>{post.body}</p> }))
vi.mock("./PagesSuggestionsRail", () => ({ PagesSuggestionsRail: () => null }))
vi.mock("./SuggestionsPanel", () => ({ SuggestionsPanel: () => null }))

import { FeedPage } from "./FeedPages"

function mount(first = true) {
  const onTail = vi.fn()
  const onBoundaryShift = vi.fn()
  const element = () => <FeedPage cursor={null} pageIndex={first ? 0 : 1} pageKey="page" nextMountedCursor={undefined} scope="recents" now={0} isFirst={first} isLast interleaveAfter={null} onTag={vi.fn()} onMention={vi.fn()} onTail={onTail} onBoundaryShift={onBoundaryShift} emptyFallback={<p>Fil vide</p>} />
  const view = renderWithEngine(element())
  return { onTail, onBoundaryShift, rerender: () => view.rerender(element()) }
}

beforeEach(() => { vi.clearAllMocks(); state.data = undefined; state.isLoading = false; state.isError = false })

describe("FeedPage — vérité des états", () => {
  it("prépare une seule fois la première page admise et annonce la préparation", () => {
    state.data = { items: [], nextCursor: null, lacunar: true, preparing: true }
    mount()
    expect(state.prepare).toHaveBeenCalledOnce()
    expect(screen.getByText(/Votre fil se prépare/)).toBeTruthy()
    expect(screen.queryByText("Fil vide")).toBeNull()
  })

  it("une continuation n'amorce pas une nouvelle préparation", () => {
    state.data = { items: [], nextCursor: null, lacunar: true, preparing: true }
    mount(false)
    expect(state.prepare).not.toHaveBeenCalled()
    expect(screen.queryByText(/Votre fil se prépare/)).toBeNull()
  })

  it("réveille une version manquante une seule fois et réarme après une erreur d'accès", () => {
    state.data = { items: [], nextCursor: null, lacunar: true, preparing: true, preparationKey: "a".repeat(64) }
    const view = mount()
    view.rerender()
    expect(state.prepare).toHaveBeenCalledTimes(1)
    state.data = { ...state.data, preparationKey: "b".repeat(64) }
    view.rerender()
    expect(state.prepare).toHaveBeenCalledTimes(2)
    state.isError = true; view.rerender()
    state.isError = false; view.rerender()
    expect(state.prepare).toHaveBeenCalledTimes(3)
  })

  it("date la limite historique sur la première page", () => {
    state.data = { items: [], nextCursor: null, lacunar: true, materializedSince: Date.UTC(2026, 8, 18) }
    mount()
    expect(screen.getByText(/Ce fil présente les publications depuis le/)).toBeTruthy()
  })

  it("une erreur masque même une ancienne page et permet de réessayer", () => {
    state.isError = true
    state.data = { items: [{ body: "Ancien contenu" } as Feed["items"][number]], nextCursor: null, lacunar: false }
    const { onTail } = mount()
    expect(screen.queryByText("Ancien contenu")).toBeNull()
    expect(screen.queryByText("Fil vide")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(state.refetch).toHaveBeenCalledOnce()
    expect(onTail).not.toHaveBeenCalled()
  })

  it("une page vide avec curseur garde sa suite et annonce sa lacune", () => {
    const cursor = { publishedAt: 1, postId: "posts_next" as never }
    state.data = { items: [], nextCursor: cursor, lacunar: true }
    const { onTail } = mount(false)
    expect(screen.getByRole("status")).toHaveTextContent(/incomplet/)
    expect(screen.queryByText("Fil vide")).toBeNull()
    expect(onTail).toHaveBeenCalledWith("page", cursor)
  })

  it("un résultat réellement vide et complet affiche seulement son état vide", () => {
    state.data = { items: [], nextCursor: null, lacunar: false }
    const { onTail } = mount()
    expect(screen.getByText("Fil vide")).toBeTruthy()
    expect(screen.queryByRole("status")).toBeNull()
    expect(onTail).toHaveBeenCalledWith("page", null)
  })

  it.each([null, { publishedAt: 1, postId: "posts_next" as never }])("une première fenêtre lacunaire ne prétend jamais que le fil est vide, curseur %s", (cursor) => {
    state.data = { items: [], nextCursor: cursor, lacunar: true }
    const { onTail } = mount()
    expect(screen.getByRole("status")).toHaveTextContent(/incomplet/)
    expect(screen.queryByText("Fil vide")).toBeNull()
    expect(onTail).toHaveBeenCalledWith("page", cursor)
  })

  it("une première page encore poursuivable attend sa suite avant d'annoncer le vide", () => {
    const cursor = { publishedAt: 1, postId: "posts_next" as never }
    state.data = { items: [], nextCursor: cursor, lacunar: false }
    const { onTail } = mount()
    expect(screen.queryByText("Fil vide")).toBeNull()
    expect(onTail).toHaveBeenCalledWith("page", cursor)
  })

  it("un chargement ne prétend pas que le fil est vide", () => {
    state.isLoading = true
    const { onTail } = mount()
    expect(screen.queryByText("Fil vide")).toBeNull()
    expect(onTail).not.toHaveBeenCalled()
  })
})
