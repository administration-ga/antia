// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/AlbumsSection.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (i18n français, réseau de test, routeur en mémoire au lieu d'un `useRouter` simulé) ; liste du moteur (`paginatePersonAlbums`) lue avec le réseau courant ; DTO du moteur (couverture `{ url, withheld, altText }`, champs absents en `null`) ; adresse de l'album composée sous le profil que sert l'application (table de routes qui échappe le handle, comme celle d'antsia.ga) ; adresses d'images neutres ; les 11 cas sont gardés ; cas ajouté : une couverture retenue par la garde (propriétaire seul) se rend comme une couverture absente.
// @vitest-environment jsdom

/**
 * AlbumsSection — la vitrine des albums sur un profil (R-09, ADR-0145).
 *
 * Ce que ce fichier prouve, et qui ne se prouve nulle part ailleurs :
 *
 *  1. la LISTE vient du serveur et n'est jamais filtrée à l'écran — un
 *     brouillon d'autrui n'arrive pas, donc rien à cacher ici ;
 *  2. la PANNE se distingue du vide, avec Réessayer (R-08) ;
 *  3. l'entrée de création n'existe que chez soi ;
 *  4. le statut « Brouillon » ne s'affiche qu'à son propriétaire — l'afficher
 *     à un tiers dirait qu'il existe quelque chose qu'il ne peut pas voir.
 */
import type { Id } from "@antsia/api/engine"
import { NetworkProvider, type EngineRoutes } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { EngineTestWrapper, memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

type QueryMock = {
  data: unknown
  isPending: boolean
  isFetching: boolean
  isError: boolean
  fetchStatus: "idle" | "fetching" | "paused"
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  result: null as QueryMock | null,
  pages: new Map<string, QueryMock>(),
  activeCursors: new Set<string | null>(),
  query: vi.fn(),
}))

function ok(data: unknown): QueryMock {
  return {
    data,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle",
    refetch: vi.fn().mockResolvedValue(undefined),
  }
}

function pending(): QueryMock {
  return { ...ok(undefined), isPending: true, isFetching: true, fetchStatus: "fetching" }
}

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: unknown, args: unknown) => {
    mocks.query(query, args)
    const cursor = (args as { paginationOpts: { cursor: string | null } }).paginationOpts.cursor
    useEffect(() => {
      mocks.activeCursors.add(cursor)
      return () => { mocks.activeCursors.delete(cursor) }
    }, [cursor])
    return cursor === null ? mocks.result ?? pending() : mocks.pages.get(cursor) ?? pending()
  },
}))
vi.mock("@antsia/ui", () => ({
  Alert: ({ title, children }: { title: string; children: ReactNode }) => (
    <div role="alert">
      <strong>{title}</strong>
      {children}
    </div>
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    variant: _variant,
    size: _size,
    icon: _icon,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    icon?: string
  }) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  SkeletonCard: () => <div data-testid="skeleton" />,
}))

import { AlbumsSection, type AlbumsSectionProps } from "./AlbumsSection"

const ALBUM = {
  albumId: "al-1",
  title: "Mission de terrain à Oyem",
  description: null,
  audience: "connections" as const,
  status: "published" as const,
  itemCount: 12,
  cover: { url: "blob:couverture", withheld: null, altText: "Équipe devant la préfecture" },
  updatedAt: 1,
  publishedAt: 1,
  isOwner: false,
}

beforeEach(() => {
  mocks.result = null
  mocks.pages.clear()
  mocks.activeCursors.clear()
  mocks.query.mockReset()
})
afterEach(cleanup)

describe("AlbumsSection — la liste publiée", () => {
  it("rend les albums servis, avec leur décompte et leur couverture", () => {
    mocks.result = ok({ page: [ALBUM], isDone: true, continueCursor: "" })
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)

    expect(screen.getByText("Mission de terrain à Oyem")).toBeTruthy()
    expect(screen.getByText("12 photos")).toBeTruthy()
    const image = screen.getByAltText("Équipe devant la préfecture")
    expect(image.getAttribute("src")).toBe("blob:couverture")
    // La liste est celle du serveur, lue DANS le réseau courant.
    expect(getFunctionName(mocks.query.mock.calls[0]![0] as never)).toBe(
      "modules/albums/albums:paginatePersonAlbums",
    )
    expect(mocks.query.mock.calls[0]![1]).toEqual({
      networkId: TEST_NETWORK_ID,
      handle: "awa",
      paginationOpts: { numItems: 12, cursor: null },
    })
  })

  it("ouvre la galerie par un lien sémantique sous le profil injecté", () => {
    mocks.result = ok({ page: [ALBUM], isDone: true, continueCursor: "" })
    const router = memoryRouter()
    // L'adresse du profil est celle que SERT l'application (`useRoutes().profile`),
    // qui échappe le handle — comme la table de routes d'antsia.ga.
    const routes: EngineRoutes = { ...TEST_ROUTES, profile: (handle) => `/profil/${encodeURIComponent(handle)}` }
    render(<AlbumsSection handle="a wa" isSelf={false} />, {
      wrapper: ({ children }) => (
        <EngineTestWrapper router={router.implementation} routes={routes}>
          {children}
        </EngineTestWrapper>
      ),
    })

    expect(screen.getByRole("link", { name: /Mission de terrain/ }).getAttribute("href")).toBe("/profil/a%20wa/albums/al-1")
    expect(router.calls).toEqual([])
  })

  it("un album sans couverture ne rend pas d'image cassée", () => {
    mocks.result = ok({
      page: [{ ...ALBUM, cover: null, itemCount: 0 }],
      isDone: true,
      continueCursor: "",
    })
    const { container } = renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("Aucune photo")).toBeTruthy()
  })

  it.each([
    { url: null, withheld: "fileScanPending" },
    { url: "https://images.exemple.test/retenue.png", withheld: "fileScanPending" },
    { url: "https://images.exemple.test/retenue.png", withheld: "fileQuarantined" },
  ])("une couverture $withheld reste absente même si le DTO fournit une URL", ({ url, withheld }) => {
    mocks.result = ok({
      page: [{ ...ALBUM, isOwner: true, cover: { url, withheld, altText: null } }],
      isDone: true,
      continueCursor: "",
    })
    const { container } = renderWithEngine(<AlbumsSection handle="awa" isSelf />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.innerHTML).not.toContain("https://images.exemple.test/retenue.png")
    expect(screen.getByText("Mission de terrain à Oyem")).toBeTruthy()
  })
})

describe("AlbumsSection — panne, vide, et à qui l'on parle (R-08)", () => {
  it("la panne se dit, avec Réessayer — jamais « aucun album »", () => {
    mocks.result = { ...ok(null), isError: true }
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)

    expect(screen.getByRole("alert").textContent).toContain("Albums indisponibles")
    expect(screen.queryByText(/Aucun album ne vous est ouvert/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.result.refetch).toHaveBeenCalledTimes(1)
  })

  it("une panne APRÈS données conserve la liste, sous un bandeau", () => {
    mocks.result = {
      ...ok({ page: [ALBUM], isDone: true, continueCursor: "" }),
      isError: true,
    }
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)
    expect(screen.getByText("Mission de terrain à Oyem")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("Albums indisponibles")
  })

  it("le vide ne se dit pas pareil pour soi et pour autrui", () => {
    mocks.result = ok({ page: [], isDone: true, continueCursor: "" })
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)
    expect(screen.getByText(/Aucun album ne vous est ouvert ici/)).toBeTruthy()
    cleanup()

    renderWithEngine(<AlbumsSection handle="awa" isSelf onCreate={() => {}} />)
    expect(screen.getByText(/Vous n'avez pas encore d'album/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Créer un album" })).toBeTruthy()
  })

  it("le squelette reste réservé à la vraie attente", () => {
    mocks.result = {
      ...ok(undefined),
      isPending: true,
      isFetching: true,
      fetchStatus: "fetching",
    }
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)
    expect(screen.getByTestId("skeleton")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("AlbumsSection — ce que le propriétaire voit en plus", () => {
  it("son BROUILLON porte son étiquette", () => {
    mocks.result = ok({
      page: [{ ...ALBUM, status: "draft" as const, isOwner: true }],
      isDone: true,
      continueCursor: "",
    })
    renderWithEngine(<AlbumsSection handle="awa" isSelf onCreate={() => {}} />)
    expect(screen.getByText("Brouillon")).toBeTruthy()
  })

  it("un tiers ne voit AUCUNE étiquette d'état", () => {
    // `paginatePersonAlbums` ne sert que du publié : si une étiquette
    // apparaissait ici, c'est que la liste aurait laissé passer autre chose.
    mocks.result = ok({
      page: [{ ...ALBUM, status: "draft" as const, isOwner: false }],
      isDone: true,
      continueCursor: "",
    })
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} />)
    expect(screen.queryByText("Brouillon")).toBeNull()
    expect(screen.queryByText("Publié")).toBeNull()
  })

  it("sans `onCreate`, aucune entrée de création — même chez soi", () => {
    // Le parent tient la surface : offrir un bouton sans destinataire serait
    // exactement le « poser le bouton et raccorder plus tard » qu'on refuse.
    mocks.result = ok({ page: [ALBUM], isDone: true, continueCursor: "" })
    renderWithEngine(<AlbumsSection handle="awa" isSelf />)
    expect(screen.queryByRole("button", { name: "Créer un album" })).toBeNull()
  })

  it("l'onglet Photos dit où voir la galerie complète", () => {
    mocks.result = ok({ page: [ALBUM], isDone: true, continueCursor: "" })
    renderWithEngine(<AlbumsSection handle="awa" isSelf={false} variant="photos" />)
    expect(screen.getByText(/Ouvrez un album pour voir toutes ses photos/)).toBeTruthy()
  })
})

const translations = {
  fr: createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" }),
  en: createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "social" }),
}
const paginationRouter = memoryRouter()

function paginationTree(props: AlbumsSectionProps, context: {
  locale?: "fr" | "en"
  networkId?: Id<"networks">
  personId?: Id<"persons">
} = {}) {
  return (
    <I18nextProvider i18n={translations[context.locale ?? "fr"]}>
      <RouterProvider implementation={paginationRouter.implementation}>
        <NetworkProvider networkId={context.networkId ?? TEST_NETWORK_ID} personId={context.personId ?? TEST_PERSON_ID} slug="test" charte="antsia" routes={TEST_ROUTES}>
          <AlbumsSection {...props} />
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

function moreLabel(locale: "fr" | "en" = "fr") {
  return translations[locale].getFixedT(locale, "albums")("albumsSection.loadMore")
}

function loadingLabel(locale: "fr" | "en" = "fr") {
  return translations[locale].getFixedT(locale, "albums")("albumsSection.loadingMore")
}

function album(id: string, title = id) {
  return { ...ALBUM, albumId: id, title, cover: null }
}

const PERSON: AlbumsSectionProps = { handle: "awa", isSelf: false }

describe("AlbumsSection — source choisie selon le lecteur et l'onglet", () => {
  it.each([
    { variant: "albums" as const, functionName: "paginateMyAlbums", withHandle: false },
    { variant: "photos" as const, functionName: "paginatePersonAlbums", withHandle: true },
  ])("chez soi, $variant appelle $functionName", ({ variant, functionName, withHandle }) => {
    mocks.result = ok({ page: [], isDone: true, continueCursor: "" })
    renderWithEngine(<AlbumsSection handle="awa" isSelf variant={variant} />)

    expect(getFunctionName(mocks.query.mock.calls[0]![0] as never)).toBe(`modules/albums/albums:${functionName}`)
    expect(mocks.query.mock.calls[0]![1]).toEqual({
      networkId: TEST_NETWORK_ID,
      ...(withHandle ? { handle: "awa" } : {}),
      paginationOpts: { numItems: 12, cursor: null },
    })
  })
})

describe("AlbumsSection — pages réactives", () => {
  it.each(["fr", "en"] as const)("charge la suite avec le curseur natif, sans doublon, en %s", (locale) => {
    const first = Array.from({ length: 12 }, (_, index) => album(`album-${index + 1}`))
    mocks.result = ok({ page: first, isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("album-1", "Ancien doublon"), album("album-13"), album("album-14")], isDone: true, continueCursor: "fin" }))
    render(paginationTree(PERSON, { locale }))

    expect(screen.getAllByRole("link")).toHaveLength(12)
    expect(moreLabel(locale)).not.toBe("albumsSection.loadMore")
    fireEvent.click(screen.getByRole("button", { name: moreLabel(locale) }))

    expect(screen.getAllByRole("link")).toHaveLength(14)
    expect(screen.getByText("album-1")).toBeTruthy()
    expect(screen.queryByText("Ancien doublon")).toBeNull()
    expect(screen.queryByRole("button", { name: moreLabel(locale) })).toBeNull()
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { networkId: TEST_NETWORK_ID, handle: "awa", paginationOpts: { numItems: 12, cursor: "suite-1" } })
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("garde la première page et ferme les doubles gestes pendant le chargement de la suite", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    const { rerender } = render(paginationTree(PERSON))
    const more = screen.getByRole("button", { name: moreLabel() })
    act(() => {
      more.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      more.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(screen.getByRole("link", { name: /^premier/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: loadingLabel() }).hasAttribute("disabled")).toBe(true)
    expect([...mocks.activeCursors]).toEqual([null, "suite-1"])
    expect(screen.queryByTestId("skeleton")).toBeNull()

    mocks.pages.set("suite-1", ok({ page: [album("second")], isDone: true, continueCursor: "fin" }))
    rerender(paginationTree(PERSON))
    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: loadingLabel() })).toBeNull()
  })

  it("une première page vide non terminale laisse atteindre les albums suivants", () => {
    mocks.result = ok({ page: [], isDone: false, continueCursor: "apres-filtrage" })
    mocks.pages.set("apres-filtrage", ok({ page: [album("visible")], isDone: true, continueCursor: "fin" }))
    render(paginationTree(PERSON))

    expect(screen.queryByText(/Aucun album ne vous est ouvert/)).toBeNull()
    expect(screen.queryByTestId("skeleton")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    expect(screen.getByRole("link", { name: /^visible/ })).toBeTruthy()
  })

  it("une page intermédiaire vide continue sans effacer la page déjà servie", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [], isDone: false, continueCursor: "suite-2" }))
    mocks.pages.set("suite-2", ok({ page: [album("dernier")], isDone: true, continueCursor: "fin" }))
    render(paginationTree(PERSON))

    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    expect(screen.getByRole("link", { name: /^premier/ })).toBeTruthy()
    expect(screen.queryByText(/Aucun album ne vous est ouvert/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect([...mocks.activeCursors]).toEqual([null, "suite-1", "suite-2"])
  })

  it("une nouvelle frontière en première page abandonne les deux anciennes pages descendantes", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("ancien-second")], isDone: false, continueCursor: "suite-2" }))
    mocks.pages.set("suite-2", ok({ page: [album("ancien-troisieme")], isDone: true, continueCursor: "fin" }))
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    expect(screen.getAllByRole("link")).toHaveLength(3)

    mocks.result = ok({ page: [album("nouveau-premier")], isDone: false, continueCursor: "frontiere-neuve" })
    rerender(paginationTree(PERSON))

    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(screen.getByRole("link", { name: /^nouveau-premier/ })).toBeTruthy()
    expect(screen.queryByText("ancien-second")).toBeNull()
    expect(screen.queryByText("ancien-troisieme")).toBeNull()
    expect([...mocks.activeCursors]).toEqual([null, "frontiere-neuve"])

    mocks.pages.set("frontiere-neuve", ok({ page: [album("suite-a-jour")], isDone: true, continueCursor: "fin" }))
    rerender(paginationTree(PERSON))
    expect(screen.getByRole("link", { name: /^suite-a-jour/ })).toBeTruthy()
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })

  it("une frontière intermédiaire est vivante et remplace ses seuls descendants", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("second")], isDone: false, continueCursor: "suite-2" }))
    mocks.pages.set("suite-2", ok({ page: [album("obsolete")], isDone: true, continueCursor: "fin" }))
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))

    mocks.pages.set("suite-1", ok({ page: [album("second-actualise")], isDone: false, continueCursor: "nouvelle-suite" }))
    rerender(paginationTree(PERSON))

    expect(screen.getByRole("link", { name: /^premier/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /^second-actualise/ })).toBeTruthy()
    expect(screen.queryByText("obsolete")).toBeNull()
    expect([...mocks.activeCursors]).toEqual([null, "suite-1", "nouvelle-suite"])
  })

  it("referme la chaîne quand la première page devient terminale", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("retire")], isDone: true, continueCursor: "fin" }))
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))

    mocks.result = ok({ page: [album("premier")], isDone: true, continueCursor: "fin" })
    rerender(paginationTree(PERSON))

    expect(screen.queryByText("retire")).toBeNull()
    expect(screen.queryByRole("button", { name: moreLabel() })).toBeNull()
    expect([...mocks.activeCursors]).toEqual([null])
  })

  it("reprend une panne de page suivante sans effacer les données valides ni lancer de rejet non traité", async () => {
    const first = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    const failed = { ...ok(undefined), isError: true, refetch: vi.fn().mockRejectedValue(new Error("panne privée")) }
    mocks.result = first
    mocks.pages.set("suite-1", failed)
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))

    expect(screen.getByRole("alert").textContent).toContain("Albums indisponibles")
    expect(screen.getByRole("link", { name: /^premier/ })).toBeTruthy()
    expect(screen.queryByText(/Aucun album ne vous est ouvert/)).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Réessayer" })) })
    expect(first.refetch).toHaveBeenCalledTimes(1)
    expect(failed.refetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("panne privée")).toBeNull()

    mocks.pages.set("suite-1", ok({ page: [album("second")], isDone: true, continueCursor: "fin" }))
    rerender(paginationTree(PERSON))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })

  it("conserve aussi le cache d'une page déjà chargée lorsque son abonnement tombe", () => {
    mocks.result = ok({ page: [album("premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("second")], isDone: true, continueCursor: "fin" }))
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    mocks.pages.set("suite-1", { ...ok(undefined), isError: true })
    rerender(paginationTree(PERSON))

    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByText(/Aucun album ne vous est ouvert/)).toBeNull()
  })

  it.each(["network", "person", "handle", "variant", "isSelf"] as const)("retire immédiatement toutes les pages précédentes au changement de %s", (changed) => {
    mocks.result = ok({ page: [album("ancien-premier")], isDone: false, continueCursor: "suite-1" })
    mocks.pages.set("suite-1", ok({ page: [album("ancien-second")], isDone: true, continueCursor: "fin" }))
    const { rerender } = render(paginationTree(PERSON))
    fireEvent.click(screen.getByRole("button", { name: moreLabel() }))
    expect(screen.getAllByRole("link")).toHaveLength(2)

    mocks.result = pending()
    mocks.pages.clear()
    const props = { ...PERSON }
    const context: { networkId?: Id<"networks">; personId?: Id<"persons"> } = {}
    if (changed === "network") context.networkId = "networks_other" as Id<"networks">
    if (changed === "person") context.personId = "persons_other" as Id<"persons">
    if (changed === "handle") props.handle = "autre-personne"
    if (changed === "variant") props.variant = "photos"
    if (changed === "isSelf") props.isSelf = true
    rerender(paginationTree(props, context))

    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByText("ancien-premier")).toBeNull()
    expect(screen.queryByText("ancien-second")).toBeNull()
    expect(screen.getByTestId("skeleton")).toBeTruthy()
    expect([...mocks.activeCursors]).toEqual([null])
  })
})
