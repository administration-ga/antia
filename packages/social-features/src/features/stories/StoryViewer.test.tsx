// @vitest-environment jsdom
// U03 : aucun scénario exécuté dans la sous-tâche ; le coordinateur lance la recette.
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EngineTestWrapper } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({ items: [] as unknown[], mutation: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined) }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { stories: { stories: {
  myActive: "mine", listByAuthor: "author", markSeen: "seen", remove: "remove",
} } } } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (_ref: string, args: unknown) => ({
  data: args === "skip" ? undefined : mocks.items, isError: false, refetch: vi.fn(),
}) }))
vi.mock("convex/react", () => ({ useMutation: () => mocks.mutation }))
vi.mock("./StoryOverlay", () => ({ StoryOverlay: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div> }))
vi.mock("./StoryViewersSheet", () => ({ StoryViewersSheet: () => null }))
vi.mock("./StoryProgressBar", () => ({ StoryProgressBar: () => null }))

import { StoryViewer } from "./StoryViewer"

const NOW = Date.UTC(2026, 9, 21, 10)
function story(id: string, expiresAt: number, seen = false) {
  return {
    storyId: id, media: { kind: "image", url: `/${id}`, withheld: null, mimeType: "image/jpeg" },
    caption: id, audience: "connections", publishedAt: NOW - 60_000, expiresAt, seen, isOwn: false, viewCount: null,
  }
}
const props = { handle: "awa", displayName: "Awa NDONG", avatarUrl: null, active: true, myHandle: "me", onClose: vi.fn() }

beforeEach(() => {
  mocks.items = []
  mocks.mutation.mockClear()
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("StoryViewer — expiration reçue et contexte de lecture", () => {
  it("ignore le segment expiré dès l'arrivée sans le marquer vu", () => {
    mocks.items = [story("expired", NOW), story("current", NOW + 60_000)]
    render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    expect(screen.queryByRole("img", { name: "expired" })).toBeNull()
    expect(screen.getByRole("img", { name: "current" })).toHaveAttribute("src", "/current")
    expect(mocks.mutation.mock.calls.some(([args]) => (args as { storyId: string }).storyId === "expired")).toBe(false)
  })

  it("ferme le dernier média quand l'horloge atteint l'expiration et n'épuise la série qu'une fois", () => {
    mocks.items = [story("last", NOW + 1_000)]
    const exhausted = vi.fn()
    const viewer = (now: number) => <EngineTestWrapper><StoryViewer {...props} now={now} onExhausted={exhausted} /></EngineTestWrapper>
    const view = render(viewer(NOW))
    expect(screen.getByRole("img", { name: "last" })).toBeInTheDocument()
    view.rerender(viewer(NOW + 1_000))
    expect(screen.queryByRole("img")).toBeNull()
    expect(exhausted).toHaveBeenCalledTimes(1)
    expect(exhausted).toHaveBeenCalledWith(1)
    view.rerender(viewer(NOW + 2_000))
    expect(exhausted).toHaveBeenCalledTimes(1)
  })

  it("un autre acteur retrouve son propre premier segment non vu", () => {
    mocks.items = [story("first", NOW + 60_000, true), story("second", NOW + 60_000)]
    const viewer = (personId: string) => <EngineTestWrapper personId={personId as never}><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>
    const view = render(viewer("persons_first"))
    expect(screen.getByRole("img", { name: "second" })).toBeInTheDocument()
    mocks.items = [story("first", NOW + 60_000), story("second", NOW + 60_000, true)]
    view.rerender(viewer("persons_second"))
    expect(screen.getByRole("img", { name: "first" })).toBeInTheDocument()
  })
})
