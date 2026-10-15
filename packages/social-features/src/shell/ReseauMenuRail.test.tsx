// Écrit pour le moteur (lot P5) : le rail-menu adapté d'après socle/packages/agent-features/src/features/reseau-personnel/ReseauMenuRail.tsx @ ad2e7fdc2 (sans test au socle) — volets servis et actif, pastille doublée de sa phrase, identité et compte seulement quand ils ont une adresse, raccourcis composés sur la table de routes injectée.
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, TEST_ROUTES } from "../tests/engine-wrapper"
import { reseauAgentGroupeHref } from "./reseau-agent-nav"

const mocks = vi.hoisted(() => ({
  person: undefined as { published: boolean; handle?: string; displayName?: string; avatar: null } | undefined,
  pages: [] as { pageId: string; handle: string; name: string; logoUrl: string | null }[],
  groups: [] as { groupId: string; name: string }[],
}))

vi.mock("@antia/api/engine", () => ({
  api: {
    modules: {
      people: { persons: { getMyPerson: "getMyPerson" } },
      pages: { pages: { paginateMyPageFollows: "paginateMyPageFollows" } },
      thematicGroups: { thematicGroups: { myGroups: "myGroups" } },
    },
  },
}))

vi.mock("@antia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string) =>
    reference === "getMyPerson" ? { data: mocks.person, isLoading: false, isError: false } : { data: { items: mocks.groups, truncated: false }, isLoading: false, isError: false },
  useAuthenticatedPaginatedQuery: () => ({ results: mocks.pages, status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

import { ReseauMenuRail } from "./ReseauMenuRail"

function rail(ui: ReactElement, routes = TEST_ROUTES): ReactElement {
  return <EngineTestWrapper routes={routes}>{ui}</EngineTestWrapper>
}

beforeEach(() => {
  mocks.person = { published: true, handle: "awa.ndong", displayName: "Awa Ndong", avatar: null }
  mocks.pages = []
  mocks.groups = []
})

describe("ReseauMenuRail — la navigation verticale du bureau", () => {
  it("reprend les volets SERVIS, dans l'ordre, et marque l'actif comme page courante", () => {
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    const nav = screen.getByRole("navigation", { name: "Menu du réseau" })
    const volets = Array.from(nav.querySelectorAll("ul")[0]!.querySelectorAll("button")).map((button) => button.textContent)
    expect(volets).toEqual(["Fil", "Relations", "Groupes", "Pages", "Évènements", "Enregistrements"])
    expect(screen.queryByRole("button", { name: /Conférences/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Fil" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("button", { name: "Relations" }).getAttribute("aria-current")).toBeNull()
  })

  it("demande le volet choisi au lieu de naviguer lui-même", () => {
    const onSelectTab = vi.fn()
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={onSelectTab} />))
    fireEvent.click(screen.getByRole("button", { name: "Groupes" }))
    expect(onSelectTab).toHaveBeenCalledWith("groupes")
  })

  it("double la pastille des invitations d'une phrase — un « 3 » nu ne dit pas 3 quoi", () => {
    render(rail(<ReseauMenuRail activeTab="fil" counts={{ invitations: 3 }} onSelectTab={vi.fn()} />))
    const relations = screen.getByRole("button", { name: /Relations/ })
    expect(relations.textContent).toContain("3 invitations en attente")
    expect(relations.querySelector('[aria-hidden="true"]:not(svg)')?.textContent).toBe("3")
  })

  it("mène l'identité publiée à son profil, et ne la montre pas sans identifiant public", () => {
    const { unmount } = render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    const identite = screen.getByRole("link", { name: /Awa Ndong/ })
    expect(identite.getAttribute("href")).toBe(TEST_ROUTES.profile("awa.ndong"))
    expect(identite.textContent).toContain("@awa.ndong")
    unmount()

    mocks.person = { published: false, handle: "awa.ndong", displayName: "Awa Ndong", avatar: null }
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    expect(screen.queryByRole("link", { name: /Awa Ndong/ })).toBeNull()
  })

  it("déplie les destinations de compte — seulement celles que l'application sert", () => {
    const { unmount } = render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    const plus = screen.getByRole("button", { name: "Voir plus" })
    expect(plus.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(plus)
    expect(screen.getByRole("button", { name: "Voir moins" }).getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("link", { name: "Mon profil" }).getAttribute("href")).toBe(TEST_ROUTES.profile("awa.ndong"))
    // L'application de test ne sert pas de réglages : aucune entrée vers un 404.
    expect(screen.queryByRole("link", { name: "Paramètres" })).toBeNull()
    unmount()

    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />, { ...TEST_ROUTES, settings: () => "/reglages-test" }))
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    expect(screen.getByRole("link", { name: "Paramètres" }).getAttribute("href")).toBe("/reglages-test")
  })

  it("n'offre rien à déplier quand aucune destination de compte n'existe", () => {
    mocks.person = { published: false, avatar: null }
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull()
  })

  it("pose les raccourcis — pages suivies d'abord, puis groupes — sur les adresses injectées", () => {
    mocks.pages = [{ pageId: "p1", handle: "min-sante", name: "Ministère de la Santé", logoUrl: null }]
    mocks.groups = [{ groupId: "g1", name: "Numérique" }]
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    expect(screen.getByRole("heading", { name: "Vos raccourcis" })).toBeTruthy()
    const liens = screen.getAllByRole("link").filter((link) => /Ministère|Numérique/.test(link.textContent ?? ""))
    // Les initiales de la pastille sont décoratives (`aria-hidden`) : seul l'ordre des noms compte.
    expect(liens).toHaveLength(2)
    expect(liens[0]!.textContent).toMatch(/Ministère de la Santé$/)
    expect(liens[1]!.textContent).toMatch(/Numérique$/)
    expect(liens[0]!.getAttribute("href")).toBe(TEST_ROUTES.page("min-sante"))
    expect(liens[1]!.getAttribute("href")).toBe(reseauAgentGroupeHref("g1", TEST_ROUTES.home()))
  })

  it("ne titre aucune section de raccourcis quand il n'y en a pas", () => {
    render(rail(<ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />))
    expect(screen.queryByRole("heading", { name: "Vos raccourcis" })).toBeNull()
  })
})
