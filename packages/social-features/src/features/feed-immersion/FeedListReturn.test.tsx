// @vitest-environment jsdom
// P04 (18/10/2026) : en liste, la carte lue est suivie au défilement et retrouvée au retour (profondeur rechargée, position recalée).
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FeedListReturn, listAnchorOf } from "./FeedListReturn"
import type { FeedRestoreTarget } from "./ImmersiveFeedReader"

/** Une carte dans son enveloppe d'ancre, à une position simulée sous le haut de la fenêtre. */
function Card({ id, top, height = 400 }: { id: string; top: number; height?: number }) {
  return (
    <div className="contents" data-feed-anchor={id}>
      <article
        data-testid={id}
        ref={(element) => {
          if (element === null) return
          element.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) })
        }}
      />
    </div>
  )
}

const target: FeedRestoreTarget = { anchorPostId: "posts_c", offset: -40, galleryIndex: null, depth: 2 }

let scrollBy: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollBy = vi.fn()
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("listAnchorOf", () => {
  it("la première carte encore visible et la position de son bord haut", () => {
    const view = render(
      <div data-testid="root">
        <Card id="posts_a" top={-500} />
        <Card id="posts_b" top={-120} />
        <Card id="posts_c" top={280} />
      </div>,
    )
    const root = view.getByTestId("root")
    expect(listAnchorOf(root, 0)).toEqual({ postId: "posts_b", offset: -120 })
  })
})

describe("FeedListReturn", () => {
  it("suit la carte lue au défilement de la fenêtre", async () => {
    const onAnchor = vi.fn()
    render(
      <div>
        <Card id="posts_a" top={-500} />
        <Card id="posts_b" top={60} />
        <FeedListReturn restore={null} onRestored={vi.fn()} onAnchor={onAnchor} canLoadMore={false} exhausted onLoadMore={vi.fn()} />
      </div>,
    )
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    await waitFor(() => expect(onAnchor).toHaveBeenCalledWith({ postId: "posts_b", offset: 60 }))
  })

  it("recharge la profondeur jusqu'à retrouver la carte, puis la recale à sa position", () => {
    const onLoadMore = vi.fn()
    const onRestored = vi.fn()
    const view = render(
      <div>
        <Card id="posts_a" top={0} />
        <FeedListReturn restore={target} onRestored={onRestored} onAnchor={vi.fn()} canLoadMore exhausted={false} onLoadMore={onLoadMore} />
      </div>,
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    // La page demandée est en route : on attend sa réponse, sans redemander.
    view.rerender(
      <div>
        <Card id="posts_a" top={0} />
        <FeedListReturn restore={target} onRestored={onRestored} onAnchor={vi.fn()} canLoadMore={false} exhausted={false} onLoadMore={onLoadMore} />
      </div>,
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    // La carte est arrivée, 300 px sous le haut ; elle était à −40 : défilement de 340.
    view.rerender(
      <div>
        <Card id="posts_a" top={0} />
        <Card id="posts_c" top={300} />
        <FeedListReturn restore={target} onRestored={onRestored} onAnchor={vi.fn()} canLoadMore={false} exhausted={false} onLoadMore={onLoadMore} />
      </div>,
    )
    expect(onRestored).toHaveBeenCalledWith("found")
    expect(scrollBy).toHaveBeenCalledWith(0, 340)
  })

  it("une carte qui a quitté un fil terminé ne bloque rien", () => {
    const onRestored = vi.fn()
    render(
      <div>
        <Card id="posts_a" top={0} />
        <FeedListReturn restore={target} onRestored={onRestored} onAnchor={vi.fn()} canLoadMore={false} exhausted onLoadMore={vi.fn()} />
      </div>,
    )
    expect(onRestored).toHaveBeenCalledWith("missing")
  })
})
