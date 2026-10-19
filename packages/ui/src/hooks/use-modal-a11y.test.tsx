// @vitest-environment jsdom
/** Fermeture d'une modale : le déclencheur doit être réactivé avant le focus. */
import { cleanup, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { createPortal } from "react-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useModalA11y } from "./use-modal-a11y"

function Modal() {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y({ containerRef, onClose: () => {} })
  return createPortal(<div ref={containerRef} role="dialog" aria-modal="true"><button>Fermer la modale</button></div>, document.body)
}

function Fixture({ open }: { open: boolean }) {
  return <><button>Ouvrir la modale</button>{open ? <Modal /> : null}</>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("useModalA11y : retour du focus après inert", () => {
  it("réactive le déclencheur avant de lui rendre le focus, même quand inert bloque le focus natif", () => {
    const view = render(<Fixture open={false} />)
    const trigger = screen.getByRole("button", { name: "Ouvrir la modale" })
    trigger.focus()
    view.rerender(<Fixture open />)
    expect(trigger.closest("[inert]")).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fermer la modale" }))

    // jsdom n'applique pas inert. Cette cible simule le refus du navigateur
    // tout en observant l'état réel du DOM au moment exact de focus().
    const inertAtFocus: boolean[] = []
    const focus = trigger.focus.bind(trigger)
    vi.spyOn(trigger, "focus").mockImplementation(() => {
      const inert = trigger.closest("[inert]") !== null
      inertAtFocus.push(inert)
      if (!inert) focus()
    })
    view.rerender(<Fixture open={false} />)
    expect(inertAtFocus).toEqual([false])
    expect(trigger.closest("[inert]")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("conserve l'inertage préexistant d'une autre surface à la fermeture", () => {
    const alreadyInert = document.createElement("div")
    alreadyInert.setAttribute("inert", "")
    document.body.append(alreadyInert)
    try {
      const view = render(<Fixture open={false} />)
      const trigger = screen.getByRole("button", { name: "Ouvrir la modale" })
      trigger.focus()
      view.rerender(<Fixture open />)
      expect(trigger.closest("[inert]")).not.toBeNull()
      view.rerender(<Fixture open={false} />)
      expect(alreadyInert.hasAttribute("inert")).toBe(true)
      expect(trigger.closest("[inert]")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    } finally {
      alreadyInert.remove()
    }
  })
})
