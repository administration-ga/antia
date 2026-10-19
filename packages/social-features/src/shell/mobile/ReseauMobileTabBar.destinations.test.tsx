// Écrit pour le moteur (lot P02 de l'étude social-commerce du 18/10/2026) : la barre basse sous la navigation par destinations déclarée par l'application — cinq places dans l'ordre, adresses injectées, élément courant (page / section / imposé par l'hôte), « Créer » ouvrant le choix réel (surfaces en boutons, formats qui naviguent en liens, focus rendu), pastille Messages et repli sur la barre historique tant qu'une destination manque.
// @vitest-environment jsdom

import { NetworkProvider, type EngineNavigation, type EngineRoutes } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({ unread: 0 }))

/* Le décompte vient de deux queries du serveur : sa composition se vérifie
   dans `reseau-menu-destinations-ui.test.tsx` ; ici, seul compte ce que la
   barre en fait. */
vi.mock("../reseau-menu-destinations-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../reseau-menu-destinations-ui")>()),
  useMessagesUnreadTotal: () => mocks.unread,
}))

/* La barre HISTORIQUE (cas de repli) monte la feuille « Menu », qui lit la
   personne au serveur : simulée fermée, son contenu se vérifie à part. */
vi.mock("./ReseauMobileMenuSheet", () => ({ ReseauMobileMenuSheet: () => null }))

import { ReseauMobileTabBar } from "./ReseauMobileTabBar"

/** Les adresses de l'application de test, avec ses deux destinations propres. */
const ROUTES: EngineRoutes = { ...TEST_ROUTES, discover: () => "/explorer", me: () => "/moi" }

function app(
  ui: ReactElement,
  options: { pathname?: string; search?: string; routes?: EngineRoutes; navigation?: EngineNavigation; live?: boolean } = {},
): ReactElement {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter({ pathname: options.pathname ?? TEST_ROUTES.home(), search: options.search }).implementation}>
        <NetworkProvider
          networkId={TEST_NETWORK_ID}
          slug="test"
          personId={TEST_PERSON_ID}
          charte="antsia"
          routes={options.routes ?? ROUTES}
          liveAvailable={options.live ?? true}
          navigation={options.navigation ?? "destinations"}
        >
          {ui}
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

function nav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Navigation principale" })
}

function formats(): HTMLElement {
  return screen.getByRole("group", { name: "Formats" })
}

beforeAll(() => {
  // `useIsReseauMobile` (carte de choix) interroge `matchMedia`, absent de jsdom.
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

beforeEach(() => {
  mocks.unread = 0
})

describe("ReseauMobileTabBar — navigation par destinations (P02)", () => {
  it("rend EXACTEMENT cinq places, dans l'ordre, sans « Menu » ni rangée de volets", () => {
    render(app(<ReseauMobileTabBar active="fil" badges={{}} onCreate={vi.fn()} handle="awa.ndong" />))
    const items = within(nav()).getAllByRole("listitem")
    expect(items).toHaveLength(5)
    expect(items.map((item) => item.textContent)).toEqual(["Fil", "Découvrir", "Créer", "Messages", "Profil"])
    expect(nav()).toHaveAttribute("data-mobile-nav", "")
    expect(nav().className).toContain("min-[960px]:hidden")
    expect(screen.queryByRole("button", { name: "Ouvrir le menu principal" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Sous-menus du réseau" })).toBeNull()
  })

  it("adresse chaque lieu sur la table injectée ; « Créer » est un bouton qui ouvre un dialogue", () => {
    render(app(<ReseauMobileTabBar active="fil" badges={{}} onCreate={vi.fn()} handle="awa.ndong" />))
    expect(within(nav()).getByRole("link", { name: "Fil" })).toHaveAttribute("href", TEST_ROUTES.home())
    expect(within(nav()).getByRole("link", { name: "Découvrir" })).toHaveAttribute("href", "/explorer")
    expect(within(nav()).getByRole("link", { name: "Messages" })).toHaveAttribute("href", TEST_ROUTES.messages())
    expect(within(nav()).getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/moi")
    const create = within(nav()).getByRole("button", { name: "Créer" })
    expect(create).toHaveAttribute("aria-haspopup", "dialog")
    expect(create).toHaveAttribute("aria-expanded", "false")
  })

  it("marque l'élément courant : la page (page), la section dont elle relève (true), ou ce que l'hôte impose", () => {
    const { unmount } = render(app(<ReseauMobileTabBar active="fil" badges={{}} handle="awa.ndong" />))
    expect(within(nav()).getByRole("link", { name: "Fil" })).toHaveAttribute("aria-current", "page")
    expect(within(nav()).getByRole("link", { name: "Découvrir" })).not.toHaveAttribute("aria-current")
    unmount()

    const second = render(app(<ReseauMobileTabBar active={null} badges={{}} handle="awa.ndong" />, { search: "tab=groupes" }))
    expect(within(nav()).getByRole("link", { name: "Découvrir" })).toHaveAttribute("aria-current", "true")
    expect(within(nav()).getByRole("link", { name: "Fil" })).not.toHaveAttribute("aria-current")
    second.unmount()

    const third = render(app(<ReseauMobileTabBar active={null} badges={{}} handle="awa.ndong" />, { pathname: TEST_ROUTES.profile("awa.ndong") }))
    expect(within(nav()).getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "true")
    third.unmount()

    // L'hôte connaît mieux une page qu'il est seul à ranger : il l'impose, ou n'en allume aucune.
    const fourth = render(app(<ReseauMobileTabBar active={null} badges={{}} current={{ id: "decouvrir", current: "section" }} />))
    expect(within(nav()).getByRole("link", { name: "Découvrir" })).toHaveAttribute("aria-current", "true")
    expect(within(nav()).getByRole("link", { name: "Fil" })).not.toHaveAttribute("aria-current")
    fourth.unmount()

    render(app(<ReseauMobileTabBar active={null} badges={{}} current={null} />))
    expect(within(nav()).queryAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toEqual([])
  })

  it("« Créer » ouvre le choix RÉEL : surfaces en boutons, formats qui naviguent en liens servis", () => {
    const onCreate = vi.fn()
    render(app(<ReseauMobileTabBar active="fil" badges={{}} onCreate={onCreate} handle="awa.ndong" />))
    const create = within(nav()).getByRole("button", { name: "Créer" })
    fireEvent.click(create)
    expect(create).toHaveAttribute("aria-expanded", "true")

    const choices = within(formats())
    expect(choices.getByRole("button", { name: /Publication/ })).toBeTruthy()
    expect(choices.getByRole("button", { name: /Actu/ })).toBeTruthy()
    expect(choices.getByRole("button", { name: /Conférence/ })).toBeTruthy()
    expect(choices.getByRole("link", { name: /Évènement/ }).getAttribute("href")).toMatch(new RegExp(`^${TEST_ROUTES.home()}\\?tab=evenements`))
    expect(choices.getByRole("link", { name: /Album/ }).getAttribute("href")).toMatch(new RegExp(`^${TEST_ROUTES.profile("awa.ndong")}`))

    fireEvent.click(choices.getByRole("button", { name: /Publication/ }))
    expect(onCreate).toHaveBeenCalledWith("publication")
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
    expect(create).toHaveAttribute("aria-expanded", "false")
  })

  it("Échap referme le choix seul et rend le focus à « Créer »", () => {
    render(app(<ReseauMobileTabBar active="fil" badges={{}} onCreate={vi.fn()} />))
    const create = within(nav()).getByRole("button", { name: "Créer" })
    fireEvent.click(create)
    expect(formats()).toBeTruthy()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
    expect(document.activeElement).toBe(create)
  })

  it("n'offre aucun geste mort : sans hôte de surfaces, seulement les formats qui naviguent ; sans direct, pas de conférence", () => {
    const { unmount } = render(app(<ReseauMobileTabBar active="fil" badges={{}} handle="awa.ndong" />))
    fireEvent.click(within(nav()).getByRole("button", { name: "Créer" }))
    expect(within(formats()).queryAllByRole("button")).toHaveLength(0)
    expect(within(formats()).getAllByRole("link").map((link) => link.textContent)).toEqual([expect.stringMatching(/^Évènement/), expect.stringMatching(/^Album/)])
    unmount()

    render(app(<ReseauMobileTabBar active="fil" badges={{}} onCreate={vi.fn()} />, { live: false }))
    fireEvent.click(within(nav()).getByRole("button", { name: "Créer" }))
    expect(within(formats()).queryByRole("button", { name: /Conférence/ })).toBeNull()
    // Sans identifiant publié, pas d'album : il n'aurait pas d'adresse.
    expect(within(formats()).queryByRole("link", { name: /Album/ })).toBeNull()
  })

  it("double la pastille de Messages d'une phrase, et n'en pose aucune ailleurs", () => {
    mocks.unread = 3
    render(app(<ReseauMobileTabBar active="fil" badges={{ unreadNotifications: 5 }} />))
    const messages = within(nav()).getByRole("link", { name: "Messages 3 conversations non lues" })
    expect(messages.querySelector('[aria-hidden="true"]:not(svg)')?.textContent).toBe("3")
    expect(within(nav()).getByRole("link", { name: "Fil" })).toBeTruthy()
  })

  it("retombe sur la barre HISTORIQUE tant qu'une destination propre manque, ou sans déclaration", () => {
    const { unmount } = render(app(<ReseauMobileTabBar active="fil" badges={{}} />, { routes: { ...ROUTES, discover: undefined } }))
    expect(screen.getByRole("button", { name: "Ouvrir le menu principal" })).toBeTruthy()
    expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull()
    unmount()

    render(app(<ReseauMobileTabBar active="fil" badges={{}} />, { navigation: "volets" }))
    expect(screen.getByRole("group", { name: "Sous-menus du réseau" })).toBeTruthy()
    expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull()
  })
})
