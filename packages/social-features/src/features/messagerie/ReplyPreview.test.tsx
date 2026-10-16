// @vitest-environment jsdom
/** R9 — compte effacé distinct d'un simple retrait de message, sans nom ni extrait résiduel. */
import { fireEvent, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it, vi } from "vitest"
import { createAppI18n } from "../../i18n"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { ReplyPreview } from "./ReplyPreview"

describe("citation anonyme", () => {
  it("dit Compte supprimé et Message supprimé ; aucune navigation ni donnée de l'ancien auteur", () => {
    const open = vi.fn()
    renderWithEngine(<ReplyPreview place="bubble" onOpen={open} reply={{ messageId: null, authorDeleted: true, authorName: "Ancien nom privé", excerpt: "Ancien texte privé", deleted: true }} />)
    expect(screen.getByText("Compte supprimé")).toBeInTheDocument()
    expect(screen.getByText("Message supprimé")).toBeInTheDocument()
    expect(screen.queryByText("Ancien nom privé")).toBeNull()
    expect(screen.queryByText("Ancien texte privé")).toBeNull()
    const quote = screen.getByRole("button", { name: "Aller au message cité de Compte supprimé" })
    expect(quote).toBeDisabled()
    fireEvent.click(quote)
    expect(open).not.toHaveBeenCalled()
  })
  it("un message retiré d'un auteur vivant reste distinct et garde son identité", () => {
    const open = vi.fn()
    renderWithEngine(<ReplyPreview place="bubble" onOpen={open} reply={{ messageId: "message", authorName: "Awa", excerpt: "Texte retiré", deleted: true }} />)
    expect(screen.getByText("Awa")).toBeInTheDocument()
    expect(screen.queryByText("Compte supprimé")).toBeNull()
    const quote = screen.getByRole("button", { name: "Aller au message cité de Awa" })
    expect(quote).not.toBeDisabled(); fireEvent.click(quote); expect(open).toHaveBeenCalledWith("message")
  })
  it("le composeur masque également un extrait ancien quand l'auteur est effacé", () => {
    renderWithEngine(<ReplyPreview place="composer" reply={{ messageId: null, authorDeleted: true, excerpt: "Ancien texte privé", deleted: false }} />)
    expect(screen.getByText("Réponse à Compte supprimé")).toBeInTheDocument()
    expect(screen.getByText("Message supprimé")).toBeInTheDocument()
    expect(screen.queryByText("Ancien texte privé")).toBeNull()
  })
  it("la même marque est traduite en anglais", () => {
    const i18n = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "social" })
    render(<I18nextProvider i18n={i18n}><ReplyPreview place="bubble" reply={{ messageId: null, authorDeleted: true, excerpt: "", deleted: true }} /></I18nextProvider>)
    expect(screen.getByText("Deleted account")).toBeInTheDocument()
    expect(screen.queryByText("Compte supprimé")).toBeNull()
  })
})
