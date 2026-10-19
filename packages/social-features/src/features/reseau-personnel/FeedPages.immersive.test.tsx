// @vitest-environment jsdom
// P04 (18/10/2026) : la MÊME page du fil sous le lecteur immersif — créneaux, états déclarés, nouvelles publications retenues ; liste inchangée sans déclaration.
import type { api } from "@antsia/api/engine"
import { NetworkProvider } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { fireEvent, render, screen } from "@testing-library/react"
import type { FunctionReturnType } from "convex/server"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { ImmersiveFeedReader } from "../feed-immersion/ImmersiveFeedReader"

type Feed = FunctionReturnType<typeof api.modules.posts.posts.myFeed>
type Item = Feed["items"][number]

const state = vi.hoisted(() => ({
  data: undefined as Feed | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(async () => undefined),
  prepare: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => state, useConvexMutationQuery: () => ({ mutate: state.prepare }) }))
vi.mock("./PostCard", () => ({ PostCard: ({ post }: { post: { body: string } }) => <p>{post.body}</p> }))
vi.mock("./PagesSuggestionsRail", () => ({ PagesSuggestionsRail: () => null }))
vi.mock("./SuggestionsPanel", () => ({ SuggestionsPanel: () => null }))

import { FeedPage } from "./FeedPages"

function item(id: string, name: string): Item {
  return { _id: id, body: `Corps ${id}`, page: null, author: { displayName: name } } as unknown as Item
}

function page(first = true) {
  return (
    <FeedPage
      cursor={null}
      pageIndex={first ? 0 : 1}
      pageKey="page"
      nextMountedCursor={undefined}
      scope="recents"
      now={0}
      isFirst={first}
      isLast
      interleaveAfter={null}
      onTag={vi.fn()}
      onMention={vi.fn()}
      onTail={vi.fn()}
      onBoundaryShift={vi.fn()}
      emptyFallback={<p>Fil vide</p>}
    />
  )
}

function inReader(children: ReactNode, canLoadMore = false) {
  return (
    <ImmersiveFeedReader label="Fil en immersion" canLoadMore={canLoadMore}>
      {children}
    </ImmersiveFeedReader>
  )
}

/** Le réseau qui DÉCLARE le fil immersif (antsia.ga). */
function ImmersiveNetwork({ children }: { children: ReactNode }) {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter().implementation}>
        <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={TEST_ROUTES} feedPresentation="immersive">
          {children}
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  state.data = undefined
  state.isLoading = false
  state.isError = false
  Element.prototype.scrollTo = vi.fn()
})

describe("FeedPage sous le lecteur immersif", () => {
  it("rend chaque publication dans un créneau nommé par son auteur", () => {
    state.data = { items: [item("posts_a", "Awa"), item("posts_b", "Bella")], nextCursor: null, lacunar: false }
    renderWithEngine(inReader(page()))
    expect(screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual(["Publication de Awa", "Publication de Bella"])
    expect(screen.getByText("Corps posts_a")).toBeInTheDocument()
  })

  it("une fenêtre vide avec suite n'est pas une fin : pas d'état vide, la suite offerte, la lacune dite", () => {
    state.data = { items: [], nextCursor: { publishedAt: 1, postId: "posts_next" as never }, lacunar: true }
    renderWithEngine(inReader(page(), true))
    expect(screen.queryByText("Fil vide")).toBeNull()
    expect(screen.getByRole("button", { name: "Charger la suite" })).toBeInTheDocument()
    expect(screen.getByText("Fil incomplet")).toBeInTheDocument()
  })

  it("un fil réellement vide et complet affiche son état vide dans un créneau", () => {
    state.data = { items: [], nextCursor: null, lacunar: false }
    renderWithEngine(inReader(page()))
    expect(screen.getByText("Fil vide")).toBeInTheDocument()
  })

  it("une panne se dit dans un créneau, avec « Réessayer »", () => {
    state.isError = true
    renderWithEngine(inReader(page()))
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(state.refetch).toHaveBeenCalledOnce()
  })

  it("un chargement occupe un créneau occupé (`aria-busy`), sans prétendre un fil vide", () => {
    state.isLoading = true
    const view = renderWithEngine(inReader(page()))
    expect(view.container.querySelector('[data-fil-slot="status"][aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText("Fil vide")).toBeNull()
  })

  it("les publications arrivées en tête pendant la lecture sont retenues derrière une commande", async () => {
    state.data = { items: [item("posts_a", "Awa"), item("posts_b", "Bella")], nextCursor: null, lacunar: false }
    const view = renderWithEngine(inReader(page()))
    state.data = { items: [item("posts_new", "Nouvelle"), item("posts_a", "Awa"), item("posts_b", "Bella")], nextCursor: null, lacunar: false }
    view.rerender(inReader(page()))
    expect(screen.queryByRole("article", { name: "Publication de Nouvelle" })).toBeNull()
    fireEvent.click(await screen.findByRole("button", { name: "1 nouvelle publication" }))
    expect(await screen.findByRole("article", { name: "Publication de Nouvelle" })).toBeInTheDocument()
  })

  it("une continuation n'amorce pas de préparation et ne fige aucune tête", () => {
    state.data = { items: [item("posts_a", "Awa")], nextCursor: null, lacunar: false }
    renderWithEngine(inReader(page(false)))
    expect(state.prepare).not.toHaveBeenCalled()
    expect(screen.getByRole("article", { name: "Publication de Awa" })).toBeInTheDocument()
  })
})

describe("FeedPage en liste", () => {
  it("sans déclaration de l'application : aucune enveloppe ni créneau (rendu historique)", () => {
    state.data = { items: [item("posts_a", "Awa")], nextCursor: null, lacunar: false }
    const view = renderWithEngine(page())
    expect(view.container.querySelector("[data-feed-anchor]")).toBeNull()
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.getByText("Corps posts_a")).toBeInTheDocument()
  })

  it("avec la déclaration : une enveloppe d'ancre sans boîte autour de chaque carte, pour le retour", () => {
    state.data = { items: [item("posts_a", "Awa"), item("posts_b", "Bella")], nextCursor: null, lacunar: false }
    const view = render(<ImmersiveNetwork>{page()}</ImmersiveNetwork>)
    const anchors = Array.from(view.container.querySelectorAll("[data-feed-anchor]"))
    expect(anchors.map((anchor) => anchor.getAttribute("data-feed-anchor"))).toEqual(["posts_a", "posts_b"])
    expect(anchors.every((anchor) => anchor.classList.contains("contents"))).toBe(true)
    expect(screen.queryByRole("article")).toBeNull()
  })
})
