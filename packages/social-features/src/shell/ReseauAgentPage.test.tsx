// Écrit pour le moteur (lot P5) : la page réseau RÉÉCRITE d'après socle/packages/agent-features/src/features/reseau-personnel/ReseauAgentPage.tsx @ ad2e7fdc2 (au socle, seuls des cliquets relisaient son texte) — bascule téléphone/bureau, volets servis (« Conférences » rabattu sur le fil), rail droit ouvert par iCom, composeurs ouverts en place ; l'état du fil et les volets des autres tranches sont simulés (leur comportement se vérifie dans leurs tranches).
// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FEED_SCOPE_DEFAULT } from "../features/reseau-personnel/feed-scopes"
import { initialFeedPages } from "../features/reseau-personnel/reseau-feed-pages"
import { EngineTestWrapper } from "../tests/engine-wrapper"

const mocks = vi.hoisted(() => {
  /** Une référence de fonction pour N'IMPORTE quel chemin de l'API : les lectures sont simulées. */
  const anyPath = (): unknown => new Proxy(() => undefined, { get: () => anyPath() })
  return {
    anyPath,
    mobile: false as boolean | null,
    tab: "fil" as string,
    goToTab: vi.fn(),
    push: vi.fn(),
  }
})

vi.mock("@antia/ui/overlay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@antia/ui/overlay")>()),
  useIsReseauMobile: () => mocks.mobile,
}))

vi.mock("@antia/api/engine", () => ({ api: mocks.anyPath() }))

vi.mock("@antia/api/hooks", () => ({
  useAuthenticatedConvexQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useAuthenticatedPaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

vi.mock("../features/reseau-personnel/useReseauFeedState", () => ({
  useReseauFeedState: () => ({
    now: 0,
    router: { push: mocks.push, replace: vi.fn() },
    tab: mocks.tab,
    view: { kind: "feed" },
    setView: vi.fn(),
    searchDraft: "",
    setSearchDraft: vi.fn(),
    groupSeed: null,
    scope: FEED_SCOPE_DEFAULT,
    pages: initialFeedPages(),
    setPages: vi.fn(),
    announcement: "",
    setAnnouncement: vi.fn(),
    reportTail: vi.fn(),
    rebaseAfterPage: vi.fn(),
    search: { data: undefined, isLoading: false },
    focused: { data: undefined, isLoading: false },
    connections: { data: [] },
    follows: { data: [] },
    myProfile: { data: { published: true, handle: "awa.ndong", displayName: "Awa Ndong", avatar: null } },
    goToTab: mocks.goToTab,
    goToScope: vi.fn(),
    openTag: vi.fn(),
    openTagFromGroups: vi.fn(),
    openMention: vi.fn(),
    openSearch: vi.fn(),
    backToFeed: vi.fn(),
    openGroup: vi.fn(),
    closeGroup: vi.fn(),
    tailCursor: null,
    pendingCount: 0,
    onboardingCopy: null,
    onboardingUrgent: false,
  }),
}))

/** Un volet ou un rail d'une autre tranche, réduit à son nom. */
function stub(name: string) {
  const Stub = () => <div data-testid={name} />
  Stub.displayName = name
  return Stub
}

vi.mock("../features/messagerie/MessagerieDock", () => ({ MessagerieDock: stub("MessagerieDock") }))
vi.mock("../features/messagerie/messagerie-source", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/messagerie/messagerie-source")>()),
  SOURCE_AGENT: {
    useUnreadTotals: () => ({
      directs: { total: 0, capped: false },
      groupes: { total: 0, capped: false },
      total: { total: 0, capped: false },
      isLoading: false,
      isError: false,
      refetch: () => {},
    }),
  },
}))
vi.mock("../features/notifications/NotificationBell", () => ({ NotificationBell: stub("NotificationBell") }))
vi.mock("../features/reseau-personnel/SuggestionsPanel", () => ({ SuggestionsPanel: stub("SuggestionsPanel") }))
vi.mock("../features/reseau-personnel/PagesSuggestionsRail", () => ({ PagesSuggestionsRail: stub("PagesSuggestionsRail") }))
vi.mock("../features/reseau-personnel/EvenementsRail", () => ({ EvenementsRail: stub("EvenementsRail") }))
vi.mock("../features/reseau-personnel/PeoplePanel", () => ({ PeoplePanel: stub("PeoplePanel") }))
vi.mock("../features/reseau-personnel/GroupsPanel", () => ({ GroupsPanel: stub("GroupsPanel") }))
vi.mock("../features/reseau-personnel/PagesPanel", () => ({ PagesPanel: stub("PagesPanel") }))
vi.mock("../features/reseau-personnel/EvenementsPanel", () => ({
  EvenementsPanel: ({ onCreateEvent }: { onCreateEvent?: () => void }) => <div data-testid="EvenementsPanel" data-create={onCreateEvent === undefined ? "absent" : "present"} />,
}))
vi.mock("../features/reseau-personnel/BookmarksPanel", () => ({ BookmarksPanel: stub("BookmarksPanel") }))
vi.mock("../features/reseau-personnel/FeedPages", () => ({ FeedPage: stub("FeedPage"), EmptyFeed: stub("EmptyFeed") }))
vi.mock("../features/reseau-personnel/PostCard", () => ({ PostCard: stub("PostCard") }))
vi.mock("../features/reseau-personnel/ProfileMiniCard", () => ({
  ProfileMiniCard: ({ action }: { action?: ReactNode }) => <div data-testid="ProfileMiniCard">{action}</div>,
}))
vi.mock("../features/stories/StoriesTray", () => ({ StoriesTray: stub("StoriesTray") }))
vi.mock("../features/stories/stories-styles", () => ({ StoriesStyles: () => null }))
vi.mock("../features/stories/StoryCreateSheet", () => ({
  StoryCreateSheet: ({ open }: { open: boolean }) => <div data-testid="StoryCreateSheet" data-open={String(open)} />,
}))
vi.mock("./mobile/PostComposerSheet", () => ({
  PostComposerSheet: ({ open }: { open: boolean }) => <div data-testid="PostComposerSheet" data-open={String(open)} />,
}))

import { ReseauAgentPage } from "./ReseauAgentPage"

function page() {
  return render(
    <EngineTestWrapper>
      <ReseauAgentPage />
    </EngineTestWrapper>,
  )
}

beforeEach(() => {
  mocks.mobile = false
  mocks.tab = "fil"
  mocks.goToTab.mockClear()
  mocks.push.mockClear()
  Element.prototype.scrollIntoView = vi.fn()
})

describe("ReseauAgentPage — la page réseau", () => {
  it("ne monte AUCUN arbre tant que la largeur n'est pas connue", () => {
    mocks.mobile = null
    page()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    expect(screen.queryByRole("tablist")).toBeNull()
  })

  it("monte l'arbre du téléphone sous 960 px, avec sa barre et son en-tête", () => {
    mocks.mobile = true
    page()
    expect(screen.getByRole("heading", { level: 1, name: "Réseau" })).toBeTruthy()
    expect(screen.getByRole("navigation", { name: "Navigation du réseau" })).toBeTruthy()
    expect(screen.queryByRole("tablist")).toBeNull()
    // Le fil du téléphone : déclencheur de publication et chaîne de pages.
    expect(screen.getByRole("button", { name: /Partager une information, Awa/ })).toBeTruthy()
    expect(screen.getByTestId("FeedPage")).toBeTruthy()
  })

  it("rend au bureau les volets SERVIS — jamais « Conférences » — et le fil ouvert", () => {
    page()
    const onglets = within(screen.getByRole("tablist", { name: "Volets du réseau" })).getAllByRole("tab")
    expect(onglets.map((onglet) => onglet.textContent)).toEqual(["Fil", "Relations", "Groupes", "Pages", "Évènements", "Enregistrements"])
    expect(screen.getByRole("tab", { name: "Fil" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("reseau-tab-fil")
    expect(screen.getByRole("heading", { level: 1, name: "Réseau" })).toBeTruthy()
    expect(screen.getByTestId("FeedPage")).toBeTruthy()
    expect(screen.getByTestId("StoriesTray")).toBeTruthy()
  })

  it("rabat une adresse de conférence sur le fil plutôt que sur un écran vide", () => {
    mocks.tab = "conferences"
    page()
    expect(screen.getByRole("tab", { name: "Fil" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("heading", { level: 2, name: "Fil" })).toBeTruthy()
    expect(screen.getByTestId("FeedPage")).toBeTruthy()
  })

  it("ouvre le rail droit par la carte iCom, puis la découverte", () => {
    page()
    // Par son nom : les rails ne s'allument que par des requêtes de
    // conteneur, que jsdom n'évalue pas — leur règle de base (`display: none`)
    // s'applique, et une `aside` n'y expose pas de rôle de repère.
    const rail = screen.getByLabelText("iCom et découverte du réseau")
    const modules = Array.from(rail.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"))
    expect(modules).toEqual(["MessagerieDock", "SuggestionsPanel", "PagesSuggestionsRail", "EvenementsRail"])
  })

  it("retire du rail ce que la colonne porte déjà", () => {
    mocks.tab = "evenements"
    page()
    expect(screen.getByTestId("EvenementsPanel")).toBeTruthy()
    const rail = screen.getByLabelText("iCom et découverte du réseau")
    expect(within(rail).queryByTestId("EvenementsRail")).toBeNull()
    // L'évènement se compose dans son volet : aucun bouton qui y renverrait.
    expect(screen.getByTestId("EvenementsPanel").getAttribute("data-create")).toBe("absent")
  })

  it("monte le volet demandé dans la colonne", () => {
    mocks.tab = "relations"
    const { unmount } = page()
    expect(screen.getByTestId("PeoplePanel")).toBeTruthy()
    expect(screen.queryByTestId("FeedPage")).toBeNull()
    unmount()

    mocks.tab = "pages"
    page()
    expect(screen.getByTestId("PagesPanel")).toBeTruthy()
  })

  it("change de volet par la tablist ou le rail-menu, sans naviguer lui-même", () => {
    page()
    fireEvent.click(screen.getByRole("tab", { name: "Groupes" }))
    expect(mocks.goToTab).toHaveBeenLastCalledWith("groupes")
    const menu = screen.getByRole("navigation", { name: "Menu du réseau", hidden: true })
    fireEvent.click(within(menu).getByRole("button", { name: "Relations", hidden: true }))
    expect(mocks.goToTab).toHaveBeenLastCalledWith("relations")
  })

  it("ouvre le composeur de publication EN PLACE depuis la carte épinglée", () => {
    page()
    expect(screen.getByTestId("PostComposerSheet").getAttribute("data-open")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "Publier" }))
    expect(screen.getByTestId("PostComposerSheet").getAttribute("data-open")).toBe("true")
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
