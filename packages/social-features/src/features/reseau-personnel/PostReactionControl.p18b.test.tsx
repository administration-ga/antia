// @vitest-environment jsdom
/**
 * P18b (A10, A11) — réactions :
 *  · avec le bouton explicite (présentation « media »), la palette ne s'ouvre
 *    ni au survol ni au focus ; le déclencheur n'est qu'une bascule ;
 *  · l'état « réagi » se dit par l'icône PLEINE et `aria-pressed` ;
 *  · Échap ferme la palette où que soit le focus ; les quatre choix ne font
 *    qu'un arrêt de tabulation ;
 *  · présentation historique : la palette s'ouvre toujours au survol (rendu
 *    inchangé chez les applications qui ne déclarent rien).
 */
import { NetworkProvider, type EnginePostPresentation } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { PostReactionControl } from "./PostReactionControl"

const NONE = { total: 0, counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 }, mine: null }
const LIKED = { total: 1, counts: { like: 1, bravo: 0, soutien: 0, instructif: 0 }, mine: "like" as const }

function renderControl(ui: ReactElement, presentation: EnginePostPresentation = "media") {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nextProvider i18n={i18n}>
        <RouterProvider implementation={memoryRouter().implementation}>
          <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={TEST_ROUTES} postPresentation={presentation}>
            {children}
          </NetworkProvider>
        </RouterProvider>
      </I18nextProvider>
    ),
  })
}

describe("palette explicite (P18b, A11)", () => {
  it("ni le survol ni le focus ni les flèches du déclencheur n'ouvrent la palette ; il n'est qu'une bascule", () => {
    renderControl(<PostReactionControl reactions={NONE} pending={false} onReact={vi.fn()} choiceButton />)
    const toggle = screen.getByRole("button", { name: "J'aime" })

    fireEvent.pointerEnter(toggle, { pointerType: "mouse" })
    fireEvent.focus(toggle)
    fireEvent.keyDown(toggle, { key: "ArrowDown" })

    expect(screen.queryByRole("menu")).toBeNull()
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(toggle).not.toHaveAttribute("aria-haspopup")
    expect(toggle).not.toHaveAttribute("aria-expanded")
  })

  it("le bouton explicite ouvre la palette : un seul choix tabulable, et Échap la ferme sans aller plus loin", () => {
    const onDocumentKey = vi.fn<(event: KeyboardEvent) => void>()
    document.addEventListener("keydown", onDocumentKey)
    try {
      renderControl(<PostReactionControl reactions={NONE} pending={false} onReact={vi.fn()} choiceButton />)
      const choice = screen.getByRole("button", { name: "Afficher le choix des réactions" })
      fireEvent.click(choice)

      const choices = screen.getAllByRole("menuitemradio")
      expect(choices).toHaveLength(4)
      expect(choices.filter((option) => option.getAttribute("tabindex") === "0")).toHaveLength(1)
      fireEvent.keyDown(choices[0]!, { key: "ArrowRight" })
      expect(document.activeElement).toBe(choices[1])
      expect(choices.filter((option) => option.getAttribute("tabindex") === "0")).toEqual([choices[1]])

      fireEvent.keyDown(choices[1]!, { key: "Escape" })
      expect(screen.queryByRole("menu")).toBeNull()
      expect(document.activeElement).toBe(choice)
      // Capturée avant les surfaces sous-jacentes : une modale ne se ferme pas avec. Seule Échap
      // est retenue ; la flèche de navigation, elle, poursuit normalement sa propagation.
      expect(onDocumentKey.mock.calls.map(([event]) => event.key)).not.toContain("Escape")
    } finally {
      document.removeEventListener("keydown", onDocumentKey)
    }
  })
})

describe("état « réagi » non chromatique (P18b, A10)", () => {
  it("réagi : icône pleine et aria-pressed ; sans réaction : icône au trait", () => {
    const { container, rerender } = renderControl(<PostReactionControl reactions={LIKED} pending={false} onReact={vi.fn()} choiceButton />)
    const toggle = screen.getByRole("button", { name: /^J'aime · 1 réaction$/ })
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("svg[data-reacted='true']")).toHaveAttribute("fill", "currentColor")

    rerender(<PostReactionControl reactions={NONE} pending={false} onReact={vi.fn()} choiceButton />)
    expect(screen.getByRole("button", { name: "J'aime" })).toHaveAttribute("aria-pressed", "false")
    expect(container.querySelector("svg[data-reacted='false']")).toHaveAttribute("fill", "none")
  })
})

describe("présentation historique inchangée", () => {
  it("la palette s'ouvre toujours au survol, l'icône reste au trait, et Échap la ferme focus ailleurs (A11)", () => {
    const { container } = renderControl(<PostReactionControl reactions={LIKED} pending={false} onReact={vi.fn()} />, "classic")
    const trigger = screen.getByRole("button", { name: /^J'aime · 1 réaction\./ })
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(container.querySelector("svg[data-reacted='true']")).toHaveAttribute("fill", "none")

    fireEvent.pointerEnter(trigger, { pointerType: "mouse" })
    expect(screen.getByRole("menu", { name: "Choisir une réaction" })).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(screen.queryByRole("menu")).toBeNull()
  })
})
