// Écrit pour le moteur (lot P5) : le menu du réseau RÉÉCRIT d'après socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileMenuSheet.tsx @ ad2e7fdc2 (sans test au socle) — destinations résolues depuis la table de routes injectée, profil publié seul, réglages seulement servis, fermeture au clic, statuts marqués comme ouverts depuis l'application.
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, TEST_ROUTES } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  person: undefined as { published: boolean; handle?: string } | undefined,
  markStoriesOpenedFromApp: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: { modules: { people: { persons: { getMyPerson: "getMyPerson" } } } },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: () => ({ data: mocks.person, isLoading: false, isError: false }),
}))

vi.mock("../../features/stories/stories-entry", () => ({
  markStoriesOpenedFromApp: mocks.markStoriesOpenedFromApp,
}))

import { ReseauMobileMenuSheet } from "./ReseauMobileMenuSheet"

function sheet(ui: ReactElement, routes = TEST_ROUTES): ReactElement {
  return <EngineTestWrapper routes={routes}>{ui}</EngineTestWrapper>
}

beforeEach(() => {
  mocks.person = { published: true, handle: "awa.ndong" }
  mocks.markStoriesOpenedFromApp.mockClear()
})

describe("ReseauMobileMenuSheet — le menu principal du réseau", () => {
  it("se titre et nomme sa croix, une fois ouvert", () => {
    render(sheet(<ReseauMobileMenuSheet open onOpenChange={vi.fn()} />))
    expect(screen.getByRole("dialog", { name: "Menu principal" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Fermer le menu" })).toBeTruthy()
  })

  it("ne rend rien tant qu'il est fermé", () => {
    render(sheet(<ReseauMobileMenuSheet open={false} onOpenChange={vi.fn()} />))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("porte les statuts et mon profil publié — jamais un volet déjà dans la barre", () => {
    render(sheet(<ReseauMobileMenuSheet open onOpenChange={vi.fn()} />))
    expect(screen.getByRole("link", { name: "Actus" }).getAttribute("href")).toBe(TEST_ROUTES.stories())
    expect(screen.getByRole("link", { name: "Mon profil" }).getAttribute("href")).toBe(TEST_ROUTES.profile("awa.ndong"))
    for (const volet of [/Relations/, /Groupes/, /Pages/, /Conférences/, /Évènements/, /Enregistrements/, /^Fil$/]) {
      expect(screen.queryByRole("link", { name: volet })).toBeNull()
    }
    // L'application de test ne sert pas de réglages : aucune entrée vers un 404.
    expect(screen.queryByRole("link", { name: "Paramètres" })).toBeNull()
  })

  it("offre les réglages dès que l'application les sert", () => {
    render(sheet(<ReseauMobileMenuSheet open onOpenChange={vi.fn()} />, { ...TEST_ROUTES, settings: () => "/reglages-test" }))
    expect(screen.getByRole("link", { name: "Paramètres" }).getAttribute("href")).toBe("/reglages-test")
  })

  it("n'offre pas de profil tant qu'il n'est pas publié", () => {
    mocks.person = { published: false, handle: "awa.ndong" }
    render(sheet(<ReseauMobileMenuSheet open onOpenChange={vi.fn()} />))
    expect(screen.queryByRole("link", { name: "Mon profil" })).toBeNull()
    expect(screen.getByRole("link", { name: "Actus" })).toBeTruthy()
  })

  it("se referme AU CLIC, et marque les statuts comme ouverts depuis l'application", () => {
    const onOpenChange = vi.fn()
    // Le routeur de test rend des liens nus : la navigation du document, que
    // jsdom ne sait pas faire, n'est pas l'objet du cas.
    const stopNavigation = (event: MouseEvent) => event.preventDefault()
    document.addEventListener("click", stopNavigation)
    render(sheet(<ReseauMobileMenuSheet open onOpenChange={onOpenChange} />))

    fireEvent.click(screen.getByRole("link", { name: "Mon profil" }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(mocks.markStoriesOpenedFromApp).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("link", { name: "Actus" }))
    expect(mocks.markStoriesOpenedFromApp).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    document.removeEventListener("click", stopNavigation)
  })
})
