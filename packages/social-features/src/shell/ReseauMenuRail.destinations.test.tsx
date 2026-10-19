// Écrit pour le moteur (lot P02 de l'étude social-commerce du 18/10/2026) : le rail du bureau sous la navigation par destinations déclarée par l'application — les cinq destinations dans un repère à part, les volets sous un titre (sans le Fil, déjà destination), « Voir plus » retiré, « Fil » qui lève l'état du fil sur la page réseau, volets en liens hors de la page réseau, « Créer » et la pastille Messages.
// @vitest-environment jsdom

import { NetworkProvider, type EngineRoutes } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { dockStore } from "../features/messagerie/dock-store"
import { createAppI18n } from "../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../tests/engine-wrapper"
import { reseauAgentHref } from "./reseau-agent-nav"

const mocks = vi.hoisted(() => ({
  person: { published: true, handle: "awa.ndong", displayName: "Awa Ndong", avatar: null } as { published: boolean; handle?: string; displayName?: string; avatar: null },
  unread: 0,
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      people: { persons: { getMyPerson: "getMyPerson" } },
      pages: { pages: { paginateMyPageFollows: "paginateMyPageFollows" } },
      thematicGroups: { thematicGroups: { myGroups: "myGroups" } },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string) =>
    reference === "getMyPerson" ? { data: mocks.person, isLoading: false, isError: false } : { data: { items: [], truncated: false }, isLoading: false, isError: false },
  useAuthenticatedPaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

/* Le décompte de Messages se vérifie dans `reseau-menu-destinations-ui.test.tsx`. */
vi.mock("./reseau-menu-destinations-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./reseau-menu-destinations-ui")>()),
  useMessagesUnreadTotal: () => mocks.unread,
}))

import { ReseauMenuRail } from "./ReseauMenuRail"

const ROUTES: EngineRoutes = { ...TEST_ROUTES, discover: () => "/explorer", me: () => "/moi", settings: () => "/reglages-test" }
const HOME = TEST_ROUTES.home()

function rail(ui: ReactElement, options: { pathname?: string; search?: string } = {}): ReactElement {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter({ pathname: options.pathname ?? HOME, search: options.search }).implementation}>
        <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={ROUTES} liveAvailable navigation="destinations">
          {ui}
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

function destinations(): HTMLElement {
  return screen.getByRole("navigation", { name: "Navigation principale" })
}

function volets(): HTMLElement {
  return screen.getByRole("navigation", { name: "Menu du réseau" })
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  })
})

/**
 * Un clic sur un lien arrive-t-il jusqu'au NAVIGATEUR (non annulé par la page) ?
 * Le dernier écouteur relève la réponse puis annule : jsdom ne sait pas
 * changer de document, et le dirait dans la console.
 */
let reachedBrowser: boolean | null = null
function clickReachesBrowser(element: HTMLElement, init: { ctrlKey?: boolean } = {}): boolean | null {
  reachedBrowser = null
  fireEvent.click(element, init)
  return reachedBrowser
}

beforeAll(() => {
  window.addEventListener("click", (event) => {
    reachedBrowser = !event.defaultPrevented
    event.preventDefault()
  })
})

beforeEach(() => {
  mocks.person = { published: true, handle: "awa.ndong", displayName: "Awa Ndong", avatar: null }
  mocks.unread = 0
})

describe("ReseauMenuRail — navigation par destinations (P02)", () => {
  it("coiffe le rail des cinq destinations, dans un repère à part, l'identité en tête", () => {
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} onCreate={vi.fn()} />))
    const list = within(destinations()).getAllByRole("listitem")
    expect(list.map((item) => item.textContent)).toEqual(["Fil", "Découvrir", "Créer", "Messages", "Profil"])
    expect(within(destinations()).getByRole("link", { name: /Awa Ndong/ })).toHaveAttribute("href", TEST_ROUTES.profile("awa.ndong"))
    expect(within(destinations()).getByRole("link", { name: "Découvrir" })).toHaveAttribute("href", "/explorer")
    expect(within(destinations()).getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/moi")
    expect(within(destinations()).getByRole("link", { name: "Messages" })).toHaveAttribute("href", TEST_ROUTES.messages())
  })

  it("range les volets sous un titre, sans le Fil (déjà destination) ni « Voir plus » (porté par Profil)", () => {
    render(rail(<ReseauMenuRail activeTab="relations" onSelectTab={vi.fn()} onCreate={vi.fn()} />))
    expect(within(volets()).getByRole("heading", { name: "Dans le réseau" })).toBeTruthy()
    const labels = Array.from(volets().querySelectorAll("ul")[0]!.querySelectorAll("button")).map((button) => button.textContent)
    expect(labels).toEqual(["Relations", "Groupes", "Pages", "Conférences", "Évènements", "Enregistrements"])
    expect(within(volets()).getByRole("button", { name: "Relations" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull()
    // L'identité n'est plus répétée sous les volets.
    expect(within(volets()).queryByRole("link", { name: /Awa Ndong/ })).toBeNull()
  })

  it("garde une entrée « Paramètres » au pied du rail, vers les réglages de l'application, courante sur leur page", () => {
    const view = render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} onCreate={vi.fn()} />))
    const settings = within(volets()).getByRole("link", { name: "Paramètres" })
    expect(settings).toHaveAttribute("href", "/reglages-test")
    expect(settings).not.toHaveAttribute("aria-current")
    view.unmount()
    render(rail(<ReseauMenuRail activeTab={null} />, { pathname: "/reglages-test" }))
    expect(within(volets()).getByRole("link", { name: "Paramètres" })).toHaveAttribute("aria-current", "page")
  })

  it("sur la page réseau, « Fil » reste un lien mais un clic ordinaire repasse par le volet (recherche et pagination levées)", () => {
    const onSelectTab = vi.fn()
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={onSelectTab} onCreate={vi.fn()} />))
    const fil = within(destinations()).getByRole("link", { name: "Fil" })
    expect(fil).toHaveAttribute("href", HOME)
    expect(fil).toHaveAttribute("aria-current", "page")
    expect(clickReachesBrowser(fil)).toBe(false)
    expect(onSelectTab).toHaveBeenCalledWith("fil")

    onSelectTab.mockClear()
    // Ctrl/⌘ + clic : nouvel onglet — le navigateur garde la main.
    expect(clickReachesBrowser(fil, { ctrlKey: true })).toBe(true)
    expect(onSelectTab).not.toHaveBeenCalled()
  })

  it("« Messages » ouvre sa page liste/détail depuis le réseau comme depuis les autres pages", () => {
    const detach = vi.spyOn(dockStore, "detach").mockImplementation(() => {})
    const { unmount } = render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} onCreate={vi.fn()} />))
    const messages = within(destinations()).getByRole("link", { name: "Messages" })
    expect(messages).toHaveAttribute("href", TEST_ROUTES.messages())
    expect(clickReachesBrowser(messages)).toBe(true)
    expect(detach).not.toHaveBeenCalled()
    // Un nouvel onglet reste au navigateur.
    expect(clickReachesBrowser(messages, { ctrlKey: true })).toBe(true)
    expect(detach).not.toHaveBeenCalled()
    unmount()

    detach.mockClear()
    render(rail(<ReseauMenuRail activeTab={null} onCreate={vi.fn()} />, { pathname: "/ailleurs" }))
    expect(clickReachesBrowser(within(destinations()).getByRole("link", { name: "Messages" }))).toBe(true)
    expect(detach).not.toHaveBeenCalled()
    detach.mockRestore()
  })

  it("hors de la page réseau, chaque volet est un LIEN vers son adresse et aucun n'est courant", () => {
    render(rail(<ReseauMenuRail activeTab={null} onCreate={vi.fn()} current={{ id: "profil", current: "section" }} />, { pathname: "/moderation-test" }))
    for (const [tab, label] of [["relations", "Relations"], ["groupes", "Groupes"], ["evenements", "Évènements"], ["enregistrements", "Enregistrements"]] as const) {
      const link = within(volets()).getByRole("link", { name: label })
      expect(link).toHaveAttribute("href", reseauAgentHref(tab, HOME))
      expect(link).not.toHaveAttribute("aria-current")
    }
    expect(within(volets()).queryAllByRole("button").filter((button) => button.textContent === "Relations")).toEqual([])
    // La destination imposée par l'hôte (une page qu'il est seul à ranger).
    expect(within(destinations()).getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "true")
    // Ici « Fil » n'a pas de geste de page : un clic est une navigation ordinaire.
    expect(clickReachesBrowser(within(destinations()).getByRole("link", { name: "Fil" }))).toBe(true)
  })

  it("« Créer » ouvre la carte de choix ; un format à surface remonte à l'hôte", () => {
    const onCreate = vi.fn()
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} onCreate={onCreate} />))
    const create = within(destinations()).getByRole("button", { name: "Créer" })
    expect(create).toHaveAttribute("aria-haspopup", "dialog")
    fireEvent.click(create)
    const formats = within(screen.getByRole("group", { name: "Formats" }))
    expect(formats.getByRole("link", { name: /Évènement/ }).getAttribute("href")).toMatch(new RegExp(`^${HOME}\\?tab=evenements`))
    fireEvent.click(formats.getByRole("button", { name: /Actu/ }))
    expect(onCreate).toHaveBeenCalledWith("actu")
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
  })

  it("double la pastille de Messages de sa phrase — plafonnée comme partout", () => {
    // 99 = le plafond du serveur (`messagesUnreadTotal`) : la pastille dit « 99+ ».
    mocks.unread = 99
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} onCreate={vi.fn()} />))
    const messages = within(destinations()).getByRole("link", { name: "Messages 99 conversations non lues" })
    expect(messages.querySelector('[aria-hidden="true"]:not(svg)')?.textContent).toBe("99+")
  })
})
