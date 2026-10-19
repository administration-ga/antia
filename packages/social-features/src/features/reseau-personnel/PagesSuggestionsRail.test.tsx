// Réécrit d'après socle/packages/agent-features/src/features/reseau-personnel/PagesSuggestionsRail.tsx @ ad2e7fdc2 — ce qui change : test NEUF (le socle ne montait pas ce rail) : monté dans l'enveloppe du moteur (`renderWithEngine`), annuaire borné simulé (`pages.pages.discover`, réseau courant), vrais composants de `@antsia/ui` (seul le squelette est marqué) ; vérifie le plafond du rail et du carrousel, le masquage sans écriture serveur, le retrait d'une page suivie à l'instant, la panne avec Réessayer, la carte vide et le badge calculé.
// @vitest-environment jsdom

/**
 * PagesSuggestionsRail — ce que le rail promet :
 *
 *  1. il PROPOSE : jamais une page déjà suivie, trois au plus (six en carrousel) ;
 *  2. masquer une suggestion ne touche pas au serveur ;
 *  3. une page suivie à l'instant quitte le rail après la réponse du serveur ;
 *  4. une panne se dit, avec Réessayer ; un rail vide le dit aussi ;
 *  5. le badge posé est celui que le serveur a calculé.
 */
import { act, fireEvent, screen, within } from "@testing-library/react"
import type * as AntsiaUi from "@antsia/ui"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { reseauAgentHref } from "../../shell/reseau-agent-nav"

const mocks = vi.hoisted(() => ({
  discover: {
    data: [] as unknown[] | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  queried: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: { modules: { pages: { pages: { discover: "discover", follow: "follow", unfollow: "unfollow" } } } },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (name: string, args: unknown) => {
    mocks.queried(name, args)
    return mocks.discover
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (name: string) => (name === "follow" ? mocks.follow : mocks.unfollow),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@antsia/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof AntsiaUi>()),
  SkeletonCard: () => <div data-testid="skeleton" />,
}))

import { PagesSuggestionsRail } from "./PagesSuggestionsRail"

function page(pageId: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    pageId,
    networkId: TEST_NETWORK_ID,
    handle: pageId,
    name,
    shortName: null,
    logoUrl: null,
    description: null,
    badge: "community",
    ownerKind: "association",
    country: null,
    followerCount: 0,
    following: false,
    ...overrides,
  }
}

beforeEach(() => {
  mocks.discover.data = []
  mocks.discover.isLoading = false
  mocks.discover.isError = false
  mocks.discover.refetch.mockReset()
  mocks.queried.mockReset()
  mocks.follow.mockReset()
  mocks.unfollow.mockReset()
})

describe("PagesSuggestionsRail", () => {
  it("lit l'annuaire BORNÉ du réseau courant, et ne propose jamais une page déjà suivie, trois au plus", () => {
    mocks.discover.data = [
      page("a", "Page A", { following: true }),
      page("b", "Page B"),
      page("c", "Page C"),
      page("d", "Page D"),
      page("e", "Page E"),
    ]
    renderWithEngine(<PagesSuggestionsRail />)

    expect(mocks.queried).toHaveBeenCalledWith("discover", { networkId: TEST_NETWORK_ID, limit: 6 })
    const list = screen.getByRole("list", { name: "Pages proposées" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(within(list).queryByText("Page A")).toBeNull()
    expect(screen.getByRole("link", { name: "Voir tout" }).getAttribute("href")).toBe(reseauAgentHref("pages", TEST_ROUTES.home()))
  })

  it("en carrousel, en propose jusqu'à six", () => {
    mocks.discover.data = Array.from({ length: 8 }, (_, index) => page(`p${index}`, `Page ${index}`))
    renderWithEngine(<PagesSuggestionsRail presentation="carousel" />)
    expect(mocks.queried).toHaveBeenCalledWith("discover", { networkId: TEST_NETWORK_ID, limit: 8 })
    expect(within(screen.getByRole("list", { name: "Pages proposées" })).getAllByRole("listitem")).toHaveLength(6)
  })

  it("pose le badge CALCULÉ et mène à la fiche de la page", () => {
    mocks.discover.data = [page("ambassade", "Ambassade du Gabon", { badge: "official", ownerKind: "institution" })]
    renderWithEngine(<PagesSuggestionsRail />)
    expect(screen.getByText("Officiel")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Page Ambassade du Gabon" }).getAttribute("href")).toBe(TEST_ROUTES.page("ambassade"))
  })

  it("masque une suggestion sans rien écrire au serveur", () => {
    mocks.discover.data = [page("b", "Page B"), page("c", "Page C")]
    renderWithEngine(<PagesSuggestionsRail />)
    fireEvent.click(screen.getByRole("button", { name: "Masquer la suggestion Page B" }))
    expect(screen.queryByText("Page B")).toBeNull()
    expect(screen.getByText("Page C")).toBeTruthy()
    expect(mocks.follow).not.toHaveBeenCalled()
    expect(mocks.unfollow).not.toHaveBeenCalled()
  })

  it("retire une page suivie à l'instant, APRÈS la réponse du serveur", async () => {
    mocks.discover.data = [page("b", "Page B"), page("c", "Page C")]
    mocks.follow.mockResolvedValue({ pageId: "b", following: true })
    renderWithEngine(<PagesSuggestionsRail />)

    const item = screen.getByText("Page B").closest("li") as HTMLElement
    await act(async () => {
      fireEvent.click(within(item).getByRole("button", { name: "Suivre" }))
    })
    expect(mocks.follow).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, handle: "b" })
    expect(screen.queryByText("Page B")).toBeNull()
  })

  it("dit sa panne, avec Réessayer — jamais un rail vide", () => {
    mocks.discover.data = undefined
    mocks.discover.isError = true
    renderWithEngine(<PagesSuggestionsRail />)
    expect(screen.getByText("Les pages à suivre sont momentanément indisponibles.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.discover.refetch).toHaveBeenCalledTimes(1)
  })

  it("dit qu'il n'a rien à proposer, et attend sous un squelette", () => {
    mocks.discover.data = [page("a", "Page A", { following: true })]
    const view = renderWithEngine(<PagesSuggestionsRail />)
    expect(screen.getByText(/Aucune nouvelle page à proposer pour le moment/)).toBeTruthy()

    mocks.discover.data = undefined
    mocks.discover.isLoading = true
    view.rerender(<PagesSuggestionsRail />)
    expect(screen.getByTestId("skeleton")).toBeTruthy()
  })
})
