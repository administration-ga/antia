// @vitest-environment jsdom
// Scénarios ciblés U03 ; la recette navigateur reste coordonnée séparément.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
vi.mock("./StoryViewersSheet", () => ({ StoryViewersSheet: () => null }))
vi.mock("./StoryProgressBar", () => ({ StoryProgressBar: ({ progress }: { progress: number }) => <output data-testid="story-progress" data-progress={progress} /> }))

import { StoryViewer } from "./StoryViewer"

const NOW = Date.UTC(2026, 9, 21, 10)
function story(id: string, expiresAt: number, seen = false) {
  return {
    storyId: id, media: { kind: "image", url: `/${id}`, withheld: null, mimeType: "image/jpeg" },
    caption: id, audience: "connections", publishedAt: NOW - 60_000, expiresAt, seen, isOwn: false, viewCount: null,
  }
}
function videoStory(id: string) {
  return { ...story(id, NOW + 60_000), media: { kind: "video", url: `/${id}`, withheld: null, mimeType: "video/mp4", durationMs: 30_000 } }
}
function deferredPlayback() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
const props = { handle: "awa", displayName: "Awa NDONG", avatarUrl: null, active: true, myHandle: "me", onClose: vi.fn() }
const frames = new Map<number, FrameRequestCallback>()
let frameId = 0
function advanceFrame(stamp: number) {
  const callbacks = [...frames.values()]
  frames.clear()
  act(() => { for (const callback of callbacks) callback(stamp) })
}
const progress = () => Number(screen.getByTestId("story-progress").getAttribute("data-progress"))

beforeEach(() => {
  mocks.items = []
  mocks.mutation.mockClear()
  frames.clear()
  frameId = 0
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { const id = ++frameId; frames.set(id, callback); return id }))
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal("PointerEvent", MouseEvent)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

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

  it("propose trois cibles de 44 px et les flèches gauche/droite entre stories", () => {
    mocks.items = [story("first", NOW + 60_000), story("second", NOW + 60_000)]
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    for (const name of ["Précédente", "Pause", "Suivante"]) {
      expect(screen.getByRole("button", { name })).toHaveStyle({ minWidth: "44px", minHeight: "44px" })
    }
    const stage = view.container.querySelector<HTMLDivElement>(".st-stage")!
    stage.focus()
    expect(stage).toHaveFocus()
    fireEvent.keyDown(stage, { key: "ArrowRight" })
    expect(screen.getByRole("img", { name: "second" })).toBeInTheDocument()
    fireEvent.keyDown(stage, { key: "ArrowLeft" })
    expect(screen.getByRole("img", { name: "first" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Suivante" }))
    expect(screen.getByRole("img", { name: "second" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Précédente" }))
    expect(screen.getByRole("img", { name: "first" })).toBeInTheDocument()
  })

  it("ne détourne pas les flèches d'une saisie, d'un contenu éditable ou d'un raccourci système", () => {
    mocks.items = [story("first", NOW + 60_000), story("second", NOW + 60_000)]
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    const stage = view.container.querySelector<HTMLDivElement>(".st-stage")!
    const input = document.createElement("input")
    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")
    const text = document.createElement("span")
    editable.append(text)
    stage.append(input, editable)
    fireEvent.keyDown(input, { key: "ArrowRight" })
    fireEvent.keyDown(text, { key: "ArrowRight" })
    fireEvent.keyDown(stage, { key: "ArrowRight", altKey: true })
    expect(screen.getByRole("img", { name: "first" })).toBeInTheDocument()
    input.remove()
    editable.remove()
  })

  it("la pause explicite résiste aux gestes du pointeur et reprend sans facturer le temps arrêté", () => {
    mocks.items = [story("first", NOW + 60_000)]
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    const stage = view.container.querySelector<HTMLDivElement>(".st-stage")!
    advanceFrame(0)
    advanceFrame(1_000)
    const before = progress()
    expect(before).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    advanceFrame(2_000)
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(stage)
    fireEvent.pointerLeave(stage)
    advanceFrame(6_000)
    expect(progress()).toBe(before)
    expect(screen.getByRole("button", { name: "Reprendre" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }))
    advanceFrame(7_000)
    expect(progress()).toBe(before)
    advanceFrame(8_000)
    expect(progress()).toBeGreaterThan(before)
  })

  it("le maintien du pointeur continue de suspendre puis relâcher l'horloge", () => {
    mocks.items = [story("first", NOW + 60_000)]
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    const stage = view.container.querySelector<HTMLDivElement>(".st-stage")!
    advanceFrame(0)
    advanceFrame(1_000)
    const before = progress()
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 100 })
    advanceFrame(3_000)
    expect(progress()).toBe(before)
    fireEvent.pointerCancel(stage)
    advanceFrame(4_000)
    advanceFrame(5_000)
    expect(progress()).toBeGreaterThan(before)
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("la pause et la reprise d'une vidéo ne réactivent jamais le son d'elles-mêmes", async () => {
    mocks.items = [{ ...story("video", NOW + 60_000), media: { kind: "video", url: "/video", withheld: null, mimeType: "video/mp4", durationMs: 30_000 } }]
    const mutedAtPlay: boolean[] = []
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { mutedAtPlay.push(this.muted); return Promise.resolve() })
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(pause).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }))
    await act(async () => { await Promise.resolve() })
    expect(play.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(mutedAtPlay.every(Boolean)).toBe(true)
    expect(view.container.querySelector("video")?.muted).toBe(true)
    expect(screen.getByRole("button", { name: "Activer le son" })).toBeInTheDocument()
  })

  it("après un autoplay refusé, Lire respecte Pause et attend Reprendre sans activer le son", async () => {
    mocks.items = [videoStory("video")]
    const mutedAtPlay: boolean[] = []
    const play = vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementationOnce(() => Promise.reject(new DOMException("Gesture required", "NotAllowedError")))
      .mockImplementation(function (this: HTMLMediaElement) { mutedAtPlay.push(this.muted); return Promise.resolve() })
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    const read = screen.getByRole("button", { name: "Lire la vidéo" })
    expect(read).toBeDisabled()
    fireEvent.click(read)
    expect(play).toHaveBeenCalledTimes(1)
    advanceFrame(0)
    advanceFrame(1_000)
    expect(progress()).toBe(0)

    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }))
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole("button", { name: "Lire la vidéo" })).toBeNull()
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    advanceFrame(2_000)
    advanceFrame(3_000)
    expect(progress()).toBeGreaterThan(0)
    expect(mutedAtPlay.length).toBeGreaterThan(0)
    expect(mutedAtPlay.every(Boolean)).toBe(true)
    expect(view.container.querySelector("video")?.muted).toBe(true)
  })

  it("une promesse Lire résolue après Pause ne lève ni l'attente du geste ni la pause", async () => {
    mocks.items = [videoStory("video")]
    const pending = deferredPlayback()
    const play = vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new DOMException("Gesture required", "NotAllowedError"))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }))
    expect(play).toHaveBeenCalledTimes(2)
    const pausesBefore = pause.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(pause.mock.calls.length).toBeGreaterThan(pausesBefore)
    await act(async () => { pending.resolve(); await pending.promise })
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reprendre" })).toBeInTheDocument()
    advanceFrame(0)
    advanceFrame(3_000)
    expect(progress()).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }))
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeEnabled()
    expect(play).toHaveBeenCalledTimes(2)
  })

  it("une ancienne promesse Lire ne déverrouille pas l'autoplay refusé de la story suivante", async () => {
    mocks.items = [videoStory("first"), videoStory("second")]
    const pending = deferredPlayback()
    const play = vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new DOMException("Gesture required", "NotAllowedError"))
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValue(new DOMException("Gesture required", "NotAllowedError"))
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    const view = render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }))
    const reusedVideo = view.container.querySelector("video")
    fireEvent.click(screen.getByRole("button", { name: "Suivante" }))
    await act(async () => { await Promise.resolve() })
    expect(view.container.querySelector("video")).toBe(reusedVideo)
    expect(reusedVideo).toHaveAttribute("src", "/second")
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeEnabled()
    await act(async () => { pending.resolve(); await pending.promise })
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeEnabled()
    advanceFrame(0)
    advanceFrame(3_000)
    expect(progress()).toBe(0)
    expect(play).toHaveBeenCalledTimes(3)
  })
})

describe("StoryViewer — média retenu par la garde des fichiers", () => {
  it("dit en clair qu'une analyse n'a pas pu aboutir, sans clé brute ni média servi", () => {
    mocks.items = [{ ...story("scan", NOW + 60_000), media: { kind: "image", url: null, withheld: "fileScanUnavailable", mimeType: "image/jpeg" } }]
    render(<EngineTestWrapper><StoryViewer {...props} now={NOW} onExhausted={vi.fn()} /></EngineTestWrapper>)
    expect(screen.getByText("L'analyse de sécurité n'a pas pu être terminée. Le fichier reste indisponible jusqu'à sa vérification.")).toBeInTheDocument()
    expect(screen.queryByText("fileScanUnavailable")).toBeNull()
    expect(screen.queryByRole("img", { name: "scan" })).toBeNull()
  })
})
