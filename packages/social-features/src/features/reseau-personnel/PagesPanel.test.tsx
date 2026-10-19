// Réécrit d'après socle/packages/agent-features/src/features/reseau-personnel/PagesPanel.test.tsx @ ad2e7fdc2 — ce qui change : monté dans l'enveloppe du moteur (`renderWithEngine` : i18n fr, réseau et routes de test, routeur en mémoire) ; références simulées du moteur (`pages.pages.*`, `pages.signatories.*`, réseau courant dans chaque argument) ; vrais composants de `@antsia/ui` (seul le squelette est marqué) ; pages au DTO du moteur ; les huit cas du socle portés tels quels (recherche serveur, « Afficher plus », état vide après épuisement, pannes de la découverte et des suivies, squelette, état vide véritable) ; cas ajoutés : filtre par pays, badge calculé et ligne de méta, suivi par l'adresse, mes pages et invitations à signer, création d'une page, troncature et pagination (kit d'espace, `@antsia/ui/espace-kit` non simulé) des pages suivies.
// @vitest-environment jsdom

/**
 * PagesPanel — la recherche parcourt tout l'annuaire et une panne ne se
 * présente jamais comme un annuaire vide :
 *
 *  1. la requête PART au serveur, après la pause de frappe, jamais sous deux
 *     caractères ; le pays filtré aussi ;
 *  2. « Afficher plus de pages » demande la page suivante au serveur ;
 *  3. une panne de la découverte se dit, avec Réessayer — jamais l'état vide ;
 *  4. l'état vide n'est prononcé qu'après ÉPUISEMENT de la pagination ;
 *  5. une panne des pages suivies se dit sans vider la liste ;
 *  6. en attente, un squelette — pas un état vide ;
 *  7. les gestes passent par le réseau courant : suivre, répondre à une
 *     invitation, créer une page (puis l'ouvrir).
 */
import { act, fireEvent, screen, within } from "@testing-library/react"
import type * as AntsiaUi from "@antsia/ui"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

type Statut = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"

type FollowedResult = { page: unknown[]; isDone: boolean; continueCursor: string }

const mocks = vi.hoisted(() => ({
  followed: {
    data: { page: [], isDone: true, continueCursor: "" } as FollowedResult | undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle" as "idle" | "fetching" | "paused",
    refetch: vi.fn(),
  },
  mine: { data: [] as unknown[] | undefined, isPending: false, isFetching: false, isError: false, refetch: vi.fn() },
  invitations: { data: [] as unknown[] | undefined, isPending: false, isFetching: false, isError: false, refetch: vi.fn() },
  results: [] as unknown[],
  status: "Exhausted" as Statut,
  paginationError: false,
  queried: vi.fn(),
  paginated: vi.fn(),
  loadMore: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
  respond: vi.fn(),
  createPage: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      pages: {
        pages: {
          paginateMyPageFollows: "paginateMyPageFollows",
          paginateDiscover: "paginateDiscover",
          myPages: "myPages",
          follow: "follow",
          unfollow: "unfollow",
          createPage: "createPage",
        },
        signatories: {
          myPageInvitations: "myPageInvitations",
          respondToPageInvitation: "respondToPageInvitation",
        },
      },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: string, args: unknown) => {
    mocks.queried(query, args)
    if (query === "paginateMyPageFollows") return mocks.followed
    if (query === "myPages") return mocks.mine
    if (query === "myPageInvitations") return mocks.invitations
    throw new Error(`requête inattendue : ${query}`)
  },
  useAuthenticatedPaginatedQuery: (query: string, args: unknown, options: unknown) => {
    mocks.paginated(query, args, options)
    if (mocks.paginationError) throw new Error("panne pagination")
    return {
      results: mocks.results,
      status: mocks.status,
      loadMore: mocks.loadMore,
      isLoading: mocks.status === "LoadingFirstPage",
    }
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (name: string) => {
    if (name === "follow") return mocks.follow
    if (name === "unfollow") return mocks.unfollow
    if (name === "respondToPageInvitation") return mocks.respond
    if (name === "createPage") return mocks.createPage
    throw new Error(`mutation inattendue : ${name}`)
  },
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@antsia/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof AntsiaUi>()),
  SkeletonCard: () => <div data-testid="skeleton" />,
}))

import { PagesPanel } from "./PagesPanel"

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

function card(pageId: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    pageId,
    networkId: TEST_NETWORK_ID,
    handle: pageId,
    name,
    shortName: null,
    logoUrl: null,
    badge: "community",
    ownerKind: "association",
    country: null,
    ...overrides,
  }
}

beforeEach(() => {
  mocks.followed.data = { page: [], isDone: true, continueCursor: "" }
  mocks.followed.isPending = false
  mocks.followed.isFetching = false
  mocks.followed.isError = false
  mocks.followed.fetchStatus = "idle"
  mocks.followed.refetch.mockReset()
  mocks.mine.data = []
  mocks.mine.isError = false
  mocks.invitations.data = []
  mocks.invitations.isError = false
  mocks.results = []
  mocks.status = "Exhausted"
  mocks.paginationError = false
  for (const fn of [mocks.queried, mocks.paginated, mocks.loadMore, mocks.follow, mocks.unfollow, mocks.respond, mocks.createPage]) fn.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const EMPTY_TEXT = /Vous ne suivez encore aucune page|Aucune nouvelle page|Aucune page ne correspond|Aucune page rattachée/
const LOAD_MORE = "Afficher plus de pages"
const SEARCH_LABEL = "Rechercher une page"
const DISCOVER_OPTIONS = { initialNumItems: 12 }

describe("PagesPanel — la recherche parcourt tout l'annuaire", () => {
  it("transmet la requête au serveur après la pause de frappe, jamais sous deux caractères", () => {
    vi.useFakeTimers()
    renderWithEngine(<PagesPanel />)
    const input = screen.getByLabelText(SEARCH_LABEL)

    fireEvent.change(input, { target: { value: "i" } })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(mocks.paginated).toHaveBeenLastCalledWith("paginateDiscover", { networkId: TEST_NETWORK_ID }, DISCOVER_OPTIONS)

    fireEvent.change(input, { target: { value: "im" } })
    // Avant la pause de frappe : rien n'est parti.
    expect(mocks.paginated).toHaveBeenLastCalledWith("paginateDiscover", { networkId: TEST_NETWORK_ID }, DISCOVER_OPTIONS)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(mocks.paginated).toHaveBeenLastCalledWith("paginateDiscover", { networkId: TEST_NETWORK_ID, query: "im" }, DISCOVER_OPTIONS)
  })

  it("« Afficher plus de pages » demande la page suivante au serveur", () => {
    mocks.results = [page("dgi", "Direction des Impôts")]
    mocks.status = "CanLoadMore"
    renderWithEngine(<PagesPanel />)

    expect(screen.getByText("Direction des Impôts")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: LOAD_MORE }))
    expect(mocks.loadMore).toHaveBeenCalledWith(12)
  })

  it("ne prononce l'état vide qu'après ÉPUISEMENT de la pagination", () => {
    mocks.status = "CanLoadMore"
    const view = renderWithEngine(<PagesPanel />)
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
    expect(screen.getByRole("button", { name: LOAD_MORE })).toBeTruthy()

    mocks.status = "Exhausted"
    view.rerender(<PagesPanel />)
    expect(screen.getByText(EMPTY_TEXT)).toBeTruthy()
  })

  it("filtre la découverte par pays AU SERVEUR, et les pages suivies sur place", () => {
    mocks.followed.data = {
      page: [page("lyon", "Association des Gabonais de Lyon", { country: "FR", following: true }), page("lbv", "Collectif de Libreville", { country: "GA", following: true })],
      isDone: true,
      continueCursor: "",
    }
    mocks.mine.data = [{ ...card("ma-page", "Ma page"), role: "admin" }]
    renderWithEngine(<PagesPanel />)
    expect(screen.getByText("Mes pages")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Filtrer les pages par pays"), { target: { value: "GA" } })
    expect(mocks.paginated).toHaveBeenLastCalledWith("paginateDiscover", { networkId: TEST_NETWORK_ID, country: "GA" }, DISCOVER_OPTIONS)
    expect(screen.getByText("Collectif de Libreville")).toBeTruthy()
    expect(screen.queryByText("Association des Gabonais de Lyon")).toBeNull()
    // Un filtre ne montre que des résultats : « Mes pages » se retire.
    expect(screen.queryByText("Mes pages")).toBeNull()
  })
})

describe("PagesPanel — une panne n'est jamais un annuaire vide", () => {
  it("dit la panne de la découverte, avec Réessayer — jamais l'état vide", () => {
    mocks.paginationError = true
    renderWithEngine(<PagesPanel />)

    expect(screen.getByRole("alert").textContent).toContain("Pages indisponibles")
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
    // Le champ de recherche survit à la panne : il n'est pas sous la frontière.
    expect(screen.getByLabelText(SEARCH_LABEL)).toBeTruthy()

    mocks.paginationError = false
    mocks.results = [page("dgi", "Direction des Impôts")]
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(screen.getByText("Direction des Impôts")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("dit la panne des pages suivies SANS vider la liste conservée", () => {
    mocks.followed.data = { page: [page("mef", "Ministère de l'Économie", { following: true })], isDone: true, continueCursor: "" }
    mocks.followed.isError = true
    renderWithEngine(<PagesPanel />)

    expect(screen.getByRole("alert").textContent).toContain("Pages suivies indisponibles")
    expect(screen.getByText("Ministère de l'Économie")).toBeTruthy()
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.followed.refetch).toHaveBeenCalledTimes(1)
  })

  it("dit la panne des pages suivies sans données — jamais l'état vide", () => {
    mocks.followed.data = undefined
    mocks.followed.isError = true
    renderWithEngine(<PagesPanel />)

    expect(screen.getByRole("alert").textContent).toContain("Pages suivies indisponibles")
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
    expect(screen.queryByTestId("skeleton")).toBeNull()
  })

  it("montre un squelette en vraie attente — pas un état vide", () => {
    mocks.followed.data = undefined
    mocks.followed.isPending = true
    mocks.followed.isFetching = true
    mocks.followed.fetchStatus = "fetching"
    renderWithEngine(<PagesPanel />)

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
  })

  it("rend l'état vide véritable quand tout a répondu « rien »", () => {
    renderWithEngine(<PagesPanel />)
    expect(screen.getByText(/Vous ne suivez encore aucune page/)).toBeTruthy()
  })
})

describe("PagesPanel — ce que montre une page", () => {
  it("pose le badge CALCULÉ par le serveur, la nature, le pays et les abonnés", () => {
    mocks.results = [
      page("ambassade", "Ambassade du Gabon", { badge: "official", ownerKind: "institution", country: "GA", followerCount: 12 }),
      page("collectif", "Collectif des étudiants", { ownerKind: "community" }),
    ]
    renderWithEngine(<PagesPanel />)

    const official = screen.getByText("Ambassade du Gabon").closest("div")?.parentElement
    expect(official).toBeTruthy()
    expect(within(official as HTMLElement).getByText("Officiel")).toBeTruthy()
    expect(within(official as HTMLElement).getByText("Institution · Gabon · 12 abonnés")).toBeTruthy()
    // Une page de la communauté le DIT — jamais « officielle ».
    const community = screen.getByText("Collectif des étudiants").closest("div")?.parentElement
    expect(within(community as HTMLElement).getByText("Communauté")).toBeTruthy()
    expect(within(community as HTMLElement).queryByText("Officiel")).toBeNull()
  })

  it("mène chaque page à SA fiche, par la table des routes", () => {
    mocks.results = [page("medias-ga", "Médias du Gabon")]
    renderWithEngine(<PagesPanel />)
    expect(screen.getByRole("link", { name: "Voir la page Médias du Gabon" }).getAttribute("href")).toBe(TEST_ROUTES.page("medias-ga"))
  })

  it("suivre une page passe par son adresse, dans le réseau courant", async () => {
    mocks.results = [page("medias-ga", "Médias du Gabon")]
    mocks.follow.mockResolvedValue({ pageId: "medias-ga", following: true })
    renderWithEngine(<PagesPanel />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Suivre" }))
    })
    expect(mocks.follow).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, handle: "medias-ga" })
  })

  it("pagine les pages suivies par douze (pagination du kit), et dit la troncature du catalogue", () => {
    const followed = Array.from({ length: 13 }, (_, index) => page(`p${index}`, `Page suivie ${index}`, { following: true }))
    mocks.followed.data = { page: followed, isDone: false, continueCursor: "suite" }
    renderWithEngine(<PagesPanel />)

    expect(screen.getAllByText(/^Page suivie \d+$/)).toHaveLength(12)
    // Plus de 50 abonnements : l'écran le dit, au lieu de laisser croire le catalogue complet.
    expect(screen.getByText(/Seuls vos 50 abonnements/)).toBeTruthy()
    const pagination = screen.getByRole("navigation", { name: "Pagination — pages suivies" })
    fireEvent.click(within(pagination).getByRole("button", { name: "Suivant" }))
    expect(screen.getAllByText(/^Page suivie \d+$/)).toHaveLength(1)
    expect(screen.getByText("Page suivie 12")).toBeTruthy()
  })
})

describe("PagesPanel — mes pages, mes invitations", () => {
  it("montre les pages au nom desquelles je publie, avec mon rôle", () => {
    mocks.mine.data = [{ ...card("medias-ga", "Médias du Gabon", { badge: "verified", ownerKind: "media" }), role: "admin" }]
    renderWithEngine(<PagesPanel />)

    const section = screen.getByRole("region", { name: "Mes pages" })
    expect(within(section).getByText("Médias du Gabon")).toBeTruthy()
    expect(within(section).getByText("Administrateur")).toBeTruthy()
    expect(within(section).getByText("Vérifié")).toBeTruthy()
  })

  it("répond à une invitation à signer, dans le réseau courant", async () => {
    mocks.invitations.data = [{ page: card("asso", "Association des parents"), role: "signatory", invitedAt: 1 }]
    mocks.respond.mockResolvedValue({ role: "signatory" })
    renderWithEngine(<PagesPanel />)

    const section = screen.getByRole("region", { name: "Invitations à signer" })
    expect(within(section).getByText(/rôle : Signataire/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(section).getByRole("button", { name: "Accepter" }))
    })
    expect(mocks.respond).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, pageId: "asso", accept: true })
  })

  it("dit la panne de mes pages, avec Réessayer", () => {
    mocks.mine.data = undefined
    mocks.mine.isError = true
    renderWithEngine(<PagesPanel />)
    expect(screen.getByRole("alert").textContent).toContain("Vos pages indisponibles")
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.mine.refetch).toHaveBeenCalledTimes(1)
  })
})

describe("PagesPanel — créer une page", () => {
  it("refuse un nom vide sous son champ, sans rien envoyer, puis crée et OUVRE la page", async () => {
    const router = memoryRouter()
    mocks.createPage.mockResolvedValue({ pageId: "agl", handle: "association-des-gabonais-de-lyon" })
    renderWithEngine(<PagesPanel />, { router: router.implementation })

    fireEvent.click(screen.getByRole("button", { name: "Créer une page" }))
    const form = screen.getByRole("form", { name: "Créer une page" })
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Créer la page" }))
    })
    expect(within(form).getByText(/ne peut pas être vide/)).toBeTruthy()
    expect(mocks.createPage).not.toHaveBeenCalled()

    fireEvent.change(within(form).getByLabelText(/Nom de la page/), { target: { value: "Association des Gabonais de Lyon" } })
    expect(within(form).getByText("La page sera à l'adresse @association-des-gabonais-de-lyon.")).toBeTruthy()
    fireEvent.change(within(form).getByLabelText("Pays"), { target: { value: "FR" } })
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Créer la page" }))
    })
    expect(mocks.createPage).toHaveBeenCalledWith({
      networkId: TEST_NETWORK_ID,
      name: "Association des Gabonais de Lyon",
      ownerKind: "association",
      handle: "association-des-gabonais-de-lyon",
      country: "FR",
    })
    expect(router.calls).toContainEqual({ method: "push", href: TEST_ROUTES.page("association-des-gabonais-de-lyon") })
  })

  it("dit le refus du serveur par son code, au-dessus du formulaire", async () => {
    mocks.createPage.mockRejectedValue({ data: { code: "statusInsufficient" } })
    renderWithEngine(<PagesPanel />)

    fireEvent.click(screen.getByRole("button", { name: "Créer une page" }))
    const form = screen.getByRole("form", { name: "Créer une page" })
    fireEvent.change(within(form).getByLabelText(/Nom de la page/), { target: { value: "Médias du Gabon" } })
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Créer la page" }))
    })
    expect(within(form).getByRole("alert").textContent).toContain("Votre adhésion ne permet pas encore cette action.")
  })
})
