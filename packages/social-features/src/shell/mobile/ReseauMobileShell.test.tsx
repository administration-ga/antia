// Écrit pour le moteur (lot P02 de l'étude social-commerce du 18/10/2026) : la charpente mobile sous les deux navigations — historique (commande flottante « Créer » + barre « Menu ») inchangée, et par destinations (« Créer » dans la barre, aucune commande flottante en doublon, le geste de création transmis à la barre).
// @vitest-environment jsdom

import { NetworkProvider, type EngineNavigation, type EngineRoutes } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

vi.mock("../reseau-menu-destinations-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../reseau-menu-destinations-ui")>()),
  useMessagesUnreadTotal: () => 0,
}))
vi.mock("./ReseauMobileMenuSheet", () => ({ ReseauMobileMenuSheet: () => null }))

import { ReseauMobileShell } from "./ReseauMobileShell"

const ROUTES: EngineRoutes = { ...TEST_ROUTES, discover: () => "/explorer", me: () => "/moi" }

function shell(navigation: EngineNavigation, onCreate = vi.fn()) {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter({ pathname: TEST_ROUTES.home() }).implementation}>
        <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={ROUTES} liveAvailable navigation={navigation}>
          <ReseauMobileShell showTabBar active="fil" onCreate={onCreate} myHandle="awa.ndong">
            <p>contenu</p>
          </ReseauMobileShell>
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>,
  )
  return onCreate
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  })
  Element.prototype.scrollIntoView = vi.fn()
})

describe("ReseauMobileShell — une seule porte « Créer »", () => {
  it("navigation historique : la commande flottante ET la barre « Menu », inchangées", () => {
    shell("volets")
    expect(screen.getByRole("button", { name: "Ouvrir le menu principal" })).toBeTruthy()
    const creates = screen.getAllByRole("button", { name: /Créer/ })
    expect(creates).toHaveLength(1)
    expect(creates[0]!.closest("nav")).toBeNull()
  })

  it("navigation par destinations : « Créer » est une place de la barre, sans commande flottante en doublon", () => {
    const onCreate = shell("destinations")
    const creates = screen.getAllByRole("button", { name: /Créer/ })
    expect(creates).toHaveLength(1)
    const bar = screen.getByRole("navigation", { name: "Navigation principale" })
    expect(bar.contains(creates[0]!)).toBe(true)
    fireEvent.click(creates[0]!)
    fireEvent.click(within(screen.getByRole("group", { name: "Formats" })).getByRole("button", { name: /Publication/ }))
    expect(onCreate).toHaveBeenCalledWith("publication")
    // L'identifiant publié est transmis : l'album est offert.
    fireEvent.click(creates[0]!)
    expect(within(screen.getByRole("group", { name: "Formats" })).getByRole("link", { name: /Album/ })).toBeTruthy()
  })
})
