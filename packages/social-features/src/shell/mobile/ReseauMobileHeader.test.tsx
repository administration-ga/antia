// Écrit pour le moteur (lot P5) : l'en-tête mobile adapté d'après socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileHeader.tsx @ ad2e7fdc2 (sans test au socle) — recherche à la demande (ouverture, validation, Échap), porte d'iCom sur la messagerie injectée et son nom accordé, profil lié seulement quand il a une adresse ; cloche simulée (son contenu se vérifie dans sa tranche).
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, TEST_ROUTES } from "../../tests/engine-wrapper"

vi.mock("../../features/notifications/NotificationBell", () => ({
  NotificationBell: () => null,
}))

import { ReseauMobileHeader } from "./ReseauMobileHeader"

function header(ui: ReactElement): ReactElement {
  return <EngineTestWrapper>{ui}</EngineTestWrapper>
}

const BASE_PROPS = {
  onSearch: () => {},
  searchQuery: "",
  profileHref: TEST_ROUTES.profile("awa.ndong"),
  avatarUrl: null,
  displayName: "Awa Ndong",
}

describe("ReseauMobileHeader — l'en-tête collant du téléphone", () => {
  it("dit où l'on est, sans second titre de niveau 1", () => {
    render(header(<ReseauMobileHeader {...BASE_PROPS} />))
    expect(screen.getByText("Réseau").tagName).toBe("P")
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("ouvre la recherche à la demande et la valide sans la deviner", () => {
    const onSearch = vi.fn()
    render(header(<ReseauMobileHeader {...BASE_PROPS} onSearch={onSearch} />))
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la recherche" }))
    const champ = screen.getByRole("searchbox", { name: "Chercher dans les publications" })
    fireEvent.change(champ, { target: { value: "  numérique  " } })
    expect(onSearch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Lancer la recherche" }))
    expect(onSearch).toHaveBeenCalledWith("numérique")
    expect(screen.queryByRole("searchbox")).toBeNull()
  })

  it("referme la recherche par Échap en rendant le brouillon à la recherche en cours", () => {
    render(header(<ReseauMobileHeader {...BASE_PROPS} searchQuery="santé" />))
    fireEvent.click(screen.getByRole("button", { name: "Modifier la recherche" }))
    const champ = screen.getByRole("searchbox", { name: "Chercher dans les publications" })
    expect((champ as HTMLInputElement).value).toBe("santé")
    fireEvent.change(champ, { target: { value: "autre" } })
    fireEvent.keyDown(champ, { key: "Escape" })
    expect(screen.queryByRole("searchbox")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Modifier la recherche" }))
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("santé")
  })

  it("mène la porte d'iCom à la messagerie de l'application, nom accordé au décompte", () => {
    const { unmount } = render(header(<ReseauMobileHeader {...BASE_PROPS} />))
    expect(screen.getByRole("link", { name: "Ouvrir iCom" }).getAttribute("href")).toBe(TEST_ROUTES.messages())
    unmount()

    render(header(<ReseauMobileHeader {...BASE_PROPS} unreadMessages={3} />))
    const icom = screen.getByRole("link", { name: "Ouvrir iCom — 3 conversations non lues" })
    expect(icom.querySelector('.rm-tab-badge [aria-hidden="true"]')?.textContent).toBe("3")
  })

  it("lie la pastille au profil quand il a une adresse, et la laisse décorative sinon", () => {
    const { unmount } = render(header(<ReseauMobileHeader {...BASE_PROPS} />))
    expect(screen.getByRole("link", { name: "Voir mon profil" }).getAttribute("href")).toBe(TEST_ROUTES.profile("awa.ndong"))
    unmount()

    render(header(<ReseauMobileHeader {...BASE_PROPS} profileHref={null} />))
    expect(screen.queryByRole("link", { name: "Voir mon profil" })).toBeNull()
  })
})
