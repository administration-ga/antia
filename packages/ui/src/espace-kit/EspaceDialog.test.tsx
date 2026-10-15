// @vitest-environment jsdom
/**
 * EspaceDialog — la croix de fermeture n'a pas de texte visible et le paquet
 * n'a pas d'i18n : son nom accessible est le `closeLabel` de l'appelant.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { EspaceDialog } from "./EspaceDialog"

const TITLE = "Inviter au groupe"
const DESCRIPTION = "Choisissez vos relations."
const BODY = "Corps de la boîte"

describe("EspaceDialog", () => {
  it("nomme la croix avec le libellé traduit de l'appelant, et ferme", () => {
    const onClose = vi.fn()
    render(
      <EspaceDialog title={TITLE} description={DESCRIPTION} onClose={onClose} closeLabel="Fermer">
        <p>{BODY}</p>
      </EspaceDialog>,
    )

    const dialog = screen.getByRole("dialog", { name: TITLE })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleDescription(DESCRIPTION)

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("ferme au clic sur le voile, jamais au clic dans la boîte", () => {
    const onClose = vi.fn()
    render(
      <EspaceDialog title={TITLE} onClose={onClose} closeLabel="Close">
        <p>{BODY}</p>
      </EspaceDialog>,
    )

    fireEvent.click(screen.getByText(BODY))
    expect(onClose).not.toHaveBeenCalled()

    const veil = screen.getByRole("dialog").parentElement
    if (!veil) throw new Error("voile absent")
    fireEvent.click(veil)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })
})
