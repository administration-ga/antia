// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/PostReactionControl.test.tsx @ ad2e7fdc2 — adaptations : composant monté dans l'enveloppe du moteur (`renderWithEngine` : i18n française) ; réactions au format du moteur (`counts`) ; les trois cas du socle portés ; cas ajoutés : le décompte et la réaction choisie s'annoncent (accord au singulier), et la palette nomme chaque décompte.
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import { PostReactionControl } from "./PostReactionControl"

const EMPTY_REACTIONS = {
  total: 0,
  counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 },
  mine: null,
}

const render = renderWithEngine

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("PostReactionControl", () => {
  it("un clic simple bascule toujours J'aime", () => {
    const onReact = vi.fn()
    render(
      <PostReactionControl
        reactions={EMPTY_REACTIONS}
        pending={false}
        onReact={onReact}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^J'aime\./ }))

    expect(onReact).toHaveBeenCalledOnce()
    expect(onReact).toHaveBeenCalledWith("like")
  })

  it("ouvre la palette au clavier, la parcourt et rend le focus au déclencheur", () => {
    render(
      <PostReactionControl
        reactions={EMPTY_REACTIONS}
        pending={false}
        onReact={vi.fn()}
      />
    )
    const trigger = screen.getByRole("button", { name: /^J'aime\./ })

    fireEvent.focus(trigger)
    expect(
      screen.getByRole("menu", { name: "Choisir une réaction" })
    ).toBeTruthy()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })

    const choices = screen.getAllByRole("menuitemradio")
    expect(choices).toHaveLength(4)
    expect(document.activeElement).toBe(choices[0])

    fireEvent.keyDown(choices[0]!, { key: "ArrowRight" })
    expect(document.activeElement).toBe(choices[1])
    fireEvent.keyDown(choices[1]!, { key: "End" })
    expect(document.activeElement).toBe(choices[3])
    fireEvent.keyDown(choices[3]!, { key: "Escape" })

    expect(screen.queryByRole("menu")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("un appui long tactile ouvre la palette sans déclencher aussi J'aime", () => {
    vi.useFakeTimers()
    const onReact = vi.fn()
    render(
      <PostReactionControl
        reactions={EMPTY_REACTIONS}
        pending={false}
        onReact={onReact}
      />
    )
    const trigger = screen.getByRole("button", { name: /^J'aime\./ })

    fireEvent.pointerDown(trigger, {
      pointerType: "touch",
      clientX: 20,
      clientY: 20,
    })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerUp(trigger, { pointerType: "touch" })
    fireEvent.click(trigger)

    expect(
      screen.getByRole("menu", { name: "Choisir une réaction" })
    ).toBeTruthy()
    expect(onReact).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Soutien" }))
    expect(onReact).toHaveBeenCalledWith("soutien")
  })

  it("annonce le décompte et la réaction choisie, accordés au nombre", () => {
    const { rerender } = render(
      <PostReactionControl
        reactions={{ total: 1, counts: { like: 0, bravo: 1, soutien: 0, instructif: 0 }, mine: "bravo" }}
        pending={false}
        onReact={vi.fn()}
      />
    )
    const trigger = screen.getByRole("button", { name: /^Bravo · 1 réaction\./ })
    expect(trigger).toHaveAttribute("aria-pressed", "true")
    expect(trigger).toHaveTextContent("Bravo")

    rerender(
      <PostReactionControl
        reactions={{ total: 3, counts: { like: 2, bravo: 1, soutien: 0, instructif: 0 }, mine: null }}
        pending={false}
        onReact={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /^J'aime · 3 réactions\./ })).toHaveAttribute("aria-pressed", "false")
  })

  it("nomme le décompte de chaque réaction dans la palette", () => {
    render(
      <PostReactionControl
        reactions={{ total: 3, counts: { like: 2, bravo: 1, soutien: 0, instructif: 0 }, mine: null }}
        pending={false}
        onReact={vi.fn()}
      />
    )
    fireEvent.focus(screen.getByRole("button", { name: /^J'aime/ }))
    expect(screen.getByRole("menuitemradio", { name: "J'aime · 2" })).toBeTruthy()
    expect(screen.getByRole("menuitemradio", { name: "Bravo · 1" })).toBeTruthy()
    expect(screen.getByRole("menuitemradio", { name: "Instructif" })).toBeTruthy()
  })
})
