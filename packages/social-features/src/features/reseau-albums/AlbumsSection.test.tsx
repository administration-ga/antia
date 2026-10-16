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
import type { EngineRoutes } from "@antsia/api/network"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

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
  query: vi.fn(),
}))

function ok(data: unknown): QueryMock {
  return {
    data,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  }
}

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: unknown, args: unknown) => {
    mocks.query(query, args)
    return mocks.result ?? ok(null)
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

import { AlbumsSection } from "./AlbumsSection"

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

  it("ouvre la galerie de l'album au clic", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Mission de terrain/ }))
    expect(router.calls.map((call) => call.method)).toEqual(["push"])
    expect(router.calls[0]?.href).toBe("/profil/a%20wa/albums/al-1")
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

  it("une couverture RETENUE par la garde (propriétaire seul) se rend comme une couverture absente", () => {
    mocks.result = ok({
      page: [{ ...ALBUM, isOwner: true, cover: { url: null, withheld: "fileScanPending", altText: null } }],
      isDone: true,
      continueCursor: "",
    })
    const { container } = renderWithEngine(<AlbumsSection handle="awa" isSelf />)
    expect(container.querySelector("img")).toBeNull()
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
