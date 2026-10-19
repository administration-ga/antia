// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import { PostReactionControl } from "./PostReactionControl"

const reactions = { total: 0, counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 }, mine: null }

describe("Choix explicite des réactions P03", () => {
  it("ouvre les quatre choix au toucher et rend le focus au bouton explicite", () => {
    const onReact = vi.fn()
    renderWithEngine(<PostReactionControl reactions={reactions} pending={false} onReact={onReact} choiceButton />)
    const choice = screen.getByRole("button", { name: "Afficher le choix des réactions" })
    fireEvent.click(choice)
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(4)
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Soutien" }))
    expect(onReact).toHaveBeenCalledOnce()
    expect(onReact).toHaveBeenCalledWith("soutien")
    expect(screen.queryByRole("menu")).toBeNull()
    expect(choice).toHaveFocus()
  })

  it("un clic après le survol entre dans la palette au lieu de la refermer", () => {
    renderWithEngine(<PostReactionControl reactions={reactions} pending={false} onReact={vi.fn()} choiceButton />)
    const choice = screen.getByRole("button", { name: "Afficher le choix des réactions" })
    fireEvent.pointerEnter(choice, { pointerType: "mouse" })
    fireEvent.click(choice)
    expect(screen.getByRole("menuitemradio", { name: "J'aime" })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })
    expect(choice).toHaveFocus()
  })

  it("ouvre le dernier choix avec Flèche haut et ferme au clic extérieur", () => {
    renderWithEngine(<PostReactionControl reactions={reactions} pending={false} onReact={vi.fn()} choiceButton />)
    fireEvent.keyDown(screen.getByRole("button", { name: "Afficher le choix des réactions" }), { key: "ArrowUp" })
    expect(screen.getByRole("menuitemradio", { name: "Instructif" })).toHaveFocus()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("menu")).toBeNull()
  })
})
