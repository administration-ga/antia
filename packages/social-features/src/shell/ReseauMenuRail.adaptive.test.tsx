// U02 — scénarios du rail adaptatif écrits sans exécution ni recette visuelle.
// @vitest-environment jsdom

import { NetworkProvider, type EngineNavigation, type EngineNavigationLayout, type EngineRoutes } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../tests/engine-wrapper"
import { AppearanceProvider } from "./appearance"
import { reseauAgentGroupeHref, reseauAgentHref } from "./reseau-agent-nav"
import { RESEAU_MENU_RAIL_ADAPTIVE_CSS } from "./reseau-menu-rail-styles"

const mocks = vi.hoisted(() => ({
  published: true,
  unread: 0,
  pages: [{ pageId: "page-test", handle: "atelier", name: "Atelier local", logoUrl: null }],
  groups: [{ groupId: "group-test", name: "Entraide locale" }],
}))

vi.mock("@antsia/api/engine", () => ({
  api: { modules: {
    people: { persons: { getMyPerson: "getMyPerson" } },
    pages: { pages: { paginateMyPageFollows: "paginateMyPageFollows" } },
    thematicGroups: { thematicGroups: { myGroups: "myGroups" } },
  } },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string) => reference === "getMyPerson"
    ? { data: { published: mocks.published, handle: "awa.ndong", displayName: "Awa NDONG", avatar: null }, isLoading: false, isError: false }
    : { data: { items: mocks.groups, truncated: false }, isLoading: false, isError: false },
  useAuthenticatedPaginatedQuery: () => ({ results: mocks.pages, status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

vi.mock("./reseau-menu-destinations-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./reseau-menu-destinations-ui")>()),
  useMessagesUnreadTotal: () => mocks.unread,
}))

import { ReseauMenuRail } from "./ReseauMenuRail"

const ROUTES: EngineRoutes = {
  ...TEST_ROUTES,
  discover: () => "/explorer",
  me: () => "/moi",
  settings: () => "/reglages-test",
  shops: () => "/explorer#boutiques",
}
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>()
const RAIL_ROUTER = memoryRouter({ pathname: TEST_ROUTES.home() }).implementation
let viewportWidth = 768

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({
    matches: query === "(width < 768px)" ? viewportWidth < 768 : query === "(max-width: 959px)" ? viewportWidth <= 959 : false,
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: () => false,
  }) })
})

beforeEach(() => {
  viewportWidth = 768
  mocks.published = true
  mocks.unread = 0
})

function rail(ui: ReactElement, options: {
  navigation?: EngineNavigation
  layout?: EngineNavigationLayout
  routes?: EngineRoutes
  shopsLabel?: string | null
  clipsLabel?: string
} = {}): ReactElement {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return <I18nextProvider i18n={i18n}>
    <RouterProvider implementation={RAIL_ROUTER}>
      <AppearanceProvider storagePrefix="test:adaptive-rail">
        <NetworkProvider networkId={TEST_NETWORK_ID} personId={TEST_PERSON_ID} slug="test" charte="antsia"
          routes={options.routes ?? ROUTES} navigation={options.navigation ?? "destinations"} navigationLayout={options.layout ?? "adaptive"}
          navigationLabels={options.shopsLabel === null ? undefined : { shops: options.shopsLabel ?? "Boutiques", clips: options.clipsLabel }} liveAvailable>
          {ui}
        </NetworkProvider>
      </AppearanceProvider>
    </RouterProvider>
  </I18nextProvider>
}

describe("ReseauMenuRail — capacité adaptative U02", () => {
  it("sert les cinq lieux finaux et conserve un vrai choix Créer séparé", () => {
    const create = vi.fn()
    render(rail(<ReseauMenuRail activeTab="fil" onCreate={create} />, { routes: { ...ROUTES, clips: () => "/clips-test" }, clipsLabel: "Clips" }))
    const primary = screen.getByRole("navigation", { name: "Navigation principale" })
    expect(within(within(primary).getByRole("list")).getAllByRole("link").map(link => link.textContent)).toEqual(["Fil", "Clips", "Messages", "Découvrir", "Profil"])
    const trigger = screen.getByRole("button", { name: "Créer" })
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole("group", { name: "Formats" })).getByRole("button", { name: /Actu/ }))
    expect(create).toHaveBeenCalledWith("actu")
    expect(document.activeElement).toBe(trigger)
  })
  it("conserve toutes les portes nommées, les volets actifs et les raccourcis dans la colonne compacte", () => {
    const select = vi.fn()
    const { container } = render(rail(<ReseauMenuRail activeTab="groupes" onSelectTab={select} onCreate={vi.fn()} />))
    expect(container.querySelector('[data-reseau-menu-layout="adaptive"]')).toBeTruthy()
    const primary = screen.getByRole("navigation", { name: "Navigation principale" })
    expect(within(primary).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Fil", "Découvrir", "Créer", "Messages", "Profil"])
    const network = screen.getByRole("navigation", { name: "Menu du réseau" })
    for (const label of ["Relations", "Groupes", "Pages", "Conférences", "Évènements", "Enregistrements"]) {
      const item = within(network).getByRole("button", { name: label })
      expect(item).toHaveAttribute("title", label)
      expect(item.style.minHeight).toBe("44px")
    }
    const groups = within(network).getByRole("button", { name: "Groupes" })
    expect(groups).toHaveAttribute("aria-current", "page")
    fireEvent.click(groups)
    expect(select).toHaveBeenCalledWith("groupes")
    expect(screen.getByRole("link", { name: "Atelier local" })).toHaveAttribute("href", ROUTES.page("atelier"))
    expect(screen.getByRole("link", { name: "Entraide locale" })).toHaveAttribute("href", reseauAgentGroupeHref("group-test", ROUTES.home()))
    expect(screen.getByRole("link", { name: "Boutiques" })).toHaveAttribute("href", ROUTES.shops!())
    expect(screen.getByRole("link", { name: "Paramètres" })).toHaveAttribute("href", ROUTES.settings!())
    expect(container.querySelector(".rmr-appearance-link")).toHaveAttribute("href", ROUTES.settings!())
    expect(container.querySelector(".rmr-appearance-link")).toHaveAttribute("title", "Apparence")
    // Présence et unicité seulement : jsdom ne prouve pas le rendu à une largeur donnée.
    expect(container.querySelectorAll(".rmr-appearance-controls")).toHaveLength(1)
    expect(screen.getAllByRole("combobox", { name: "Apparence" })).toHaveLength(1)
  })

  it("garde les mêmes éléments interactifs entre 768 et 1200 sans second arbre ni perte du choix Créer", () => {
    const create = vi.fn()
    const { rerender } = render(rail(<ReseauMenuRail activeTab="fil" onCreate={create} />))
    const trigger = screen.getByRole("button", { name: "Créer" })
    const profile = screen.getByRole("link", { name: /Awa NDONG/ })
    expect(profile).toHaveAttribute("title", "Awa NDONG · @awa.ndong")
    for (const width of [1199, 1200, 768]) {
      act(() => { viewportWidth = width; for (const listener of mediaListeners) listener({ matches: false } as MediaQueryListEvent) })
      rerender(rail(<ReseauMenuRail activeTab="fil" onCreate={create} />))
      expect(screen.getByRole("button", { name: "Créer" })).toBe(trigger)
      expect(screen.getByRole("link", { name: /Awa NDONG/ })).toBe(profile)
      expect(screen.getAllByRole("navigation", { name: "Navigation principale" })).toHaveLength(1)
    }
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(within(screen.getByRole("group", { name: "Formats" })).getByRole("button", { name: /Actu/ }))
    expect(create).toHaveBeenCalledWith("actu")
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("préserve les noms de décompte et les badges plafonnés quand les labels sont masqués visuellement", () => {
    mocks.unread = 99
    render(rail(<ReseauMenuRail activeTab="relations" counts={{ invitations: 105 }} onSelectTab={vi.fn()} />))
    const messages = screen.getByRole("link", { name: "Messages 99 conversations non lues" })
    const relations = screen.getByRole("button", { name: /Relations.*105 invitations en attente/ })
    expect(messages.querySelector('.rmr-badge [aria-hidden="true"]')?.textContent).toBe("99+")
    expect(relations.querySelector('.rmr-badge [aria-hidden="true"]')?.textContent).toBe("99+")
    expect(relations).toHaveAttribute("aria-current", "page")
  })

  it("reste une navigation par liens hors fil et ne montre jamais une identité non publiée", () => {
    mocks.published = false
    render(rail(<ReseauMenuRail activeTab={null} onCreate={vi.fn()} />))
    expect(screen.queryByRole("link", { name: /Awa NDONG/ })).toBeNull()
    expect(screen.getByRole("link", { name: "Groupes" })).toHaveAttribute("href", reseauAgentHref("groupes", ROUTES.home()))
  })

  it.each([
    { navigation: "volets" as const, layout: "adaptive" as const },
    { navigation: "destinations" as const, layout: "classic" as const },
  ])("ne compacte pas la présentation historique $navigation/$layout malgré la route Boutiques", options => {
    const { container } = render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />, options))
    expect(container.querySelector('[data-reseau-menu-layout="adaptive"]')).toBeNull()
    expect(screen.queryByRole("link", { name: "Boutiques" })).toBeNull()
    expect(screen.getByRole("combobox", { name: "Apparence" })).toBeTruthy()
  })

  it("retire uniquement le raccourci Boutique si route ou libellé injecté manque", () => {
    const withoutShop: EngineRoutes = { ...ROUTES, shops: undefined }
    const view = render(rail(<ReseauMenuRail activeTab="fil" />, { routes: withoutShop }))
    expect(screen.queryByRole("link", { name: "Boutiques" })).toBeNull()
    view.unmount()
    const empty = render(rail(<ReseauMenuRail activeTab="fil" />, { shopsLabel: "   " }))
    expect(screen.queryByRole("link", { name: "Boutiques" })).toBeNull()
    expect(screen.getByRole("link", { name: "Découvrir" })).toBeTruthy()
    empty.unmount()
    render(rail(<ReseauMenuRail activeTab="fil" />, { shopsLabel: null }))
    expect(screen.queryByRole("link", { name: "Boutiques" })).toBeNull()
  })

  it("garde le sélecteur d'apparence historique si aucune page de réglages n'est servie", () => {
    render(rail(<ReseauMenuRail activeTab="fil" />, { routes: { ...ROUTES, settings: undefined } }))
    expect(screen.getByRole("combobox", { name: "Apparence" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Apparence" })).toBeNull()
  })

  it("borne le seul masquage visuel à 768–1199 et garde le label dans l'arbre accessible", () => {
    expect(RESEAU_MENU_RAIL_ADAPTIVE_CSS).toContain("@media (min-width: 768px) and (max-width: 1199px)")
    expect(RESEAU_MENU_RAIL_ADAPTIVE_CSS).toContain('[data-reseau-menu-layout="adaptive"] .rmr-label')
    expect(RESEAU_MENU_RAIL_ADAPTIVE_CSS).toContain("clip-path: inset(50%)")
    const labels = RESEAU_MENU_RAIL_ADAPTIVE_CSS.match(/\.rmr-section-title\s*\{([^}]+)\}/)?.[1]
    expect(labels).toBeDefined()
    expect(labels).not.toContain("display: none")
    expect(labels).not.toContain("visibility: hidden")
  })

  it("réserve la porte Apparence au compact et conserve l'unique contrôle dans le rail large", () => {
    const compact = RESEAU_MENU_RAIL_ADAPTIVE_CSS.split("@media (min-width: 768px) and (max-width: 1199px)")[1]
    expect(RESEAU_MENU_RAIL_ADAPTIVE_CSS).toContain('.rmr-appearance-link {\n  display: none !important;')
    expect(compact).toContain('.rmr-appearance-controls {\n    display: none;')
    expect(compact).toContain('.rmr-appearance-link {\n    display: flex !important;')
  })
})
