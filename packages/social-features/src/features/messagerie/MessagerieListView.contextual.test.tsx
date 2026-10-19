// @vitest-environment jsdom
/**
 * CC-5 — le filtre « Mises en relation » de la vue Conversations, servi seulement par une liste
 * injectée, dans les deux présentations (écrit le 19/10/2026, NON EXÉCUTÉ). Aucun fil personnel ni
 * aucune invitation de groupe n'y entre ; la recherche est transmise à la liste injectée.
 */
import { cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID, TEST_PERSON_ID } from "../../tests/engine-wrapper"

vi.mock("./MessagerieGroupeInvitations", () => ({ MessagerieGroupeInvitations: () => <div data-testid="group-invitations" /> }))
vi.mock("./messagerie-styles", () => ({ MessagerieStyles: () => null }))
vi.mock("./IcomBrickHeader", () => ({ IcomBrickHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div> }))
vi.mock("../reseau-personnel/Avatar", () => ({ Avatar: () => null }))
vi.mock("./GroupeAvatar", () => ({ GroupeAvatar: () => null }))

import { MessagerieListView } from "./MessagerieListView"
import { __resetListStatesForTests, activateListSession, messagerieListScope, readListState } from "./messagerie-list-state"
import type { MessagerieSource, MessagerieThread } from "./messagerie-source"

const nav = { openConversation: vi.fn(), openCompose: vi.fn(), openComposeGroupe: vi.fn(), back: vi.fn() }
const scope = messagerieListScope(String(TEST_NETWORK_ID), String(TEST_PERSON_ID), "phone")

const personalThread = {
  threadId: "personal", counterpart: { personId: "p-1", handle: "nadia", displayName: "Nadia personnelle", headline: null, avatarUrl: null, source: "published" },
  lastMessageAt: 1_700_000_000_000, lastMessageText: "Bonjour", lastMessageByMe: false, lastMessageKind: "text", lastMessageAttachmentCount: null,
  lastMessageId: null, lastMessageReadByCounterpart: null, lastMessageDeleted: false, unreadCount: 0, unreadCapped: false,
} as unknown as MessagerieThread

const status = { isLoading: false, isError: false, error: null, isFetching: false, enabled: true, refetch: vi.fn() }
const source: MessagerieSource = {
  espace: "personnel", supporteBrouillon: true, supporteGroupes: true,
  useMessageWrites: () => { throw new Error("La liste ne doit pas envoyer de message") },
  useThreads: () => ({ ...status, data: [personalThread] }),
  useThreadsPage: () => ({ ...status, data: [personalThread], hasMore: false, isLoadingMore: false, loadMore: vi.fn() }),
  useThreadById: () => ({ data: undefined, isLoading: false, isError: false, enabled: false }),
  useGroupThreads: () => ({ ...status, data: [] }),
  useUnreadTotals: () => ({ directs: { total: 0, capped: false }, groupes: { total: 0, capped: false }, total: { total: 0, capped: false }, isLoading: false, isError: false, refetch: vi.fn() }),
  useStartCall: () => ({ appeler: vi.fn(), isPending: false }),
}

const renderContextualList = vi.fn((query: string) => <div data-testid="contextual-list">{`liste:${query}`}</div>)

beforeEach(() => {
  vi.clearAllMocks()
  __resetListStatesForTests()
  activateListSession(JSON.stringify([TEST_NETWORK_ID, TEST_PERSON_ID]))
})
afterEach(() => { cleanup(); __resetListStatesForTests() })

describe("filtre « Mises en relation » (CC-5)", () => {
  it("n'existe pas sans liste injectée", () => {
    renderWithEngine(<MessagerieListView variant="page" nav={nav} unread={0} source={source} destinationMode stateScope={scope} />)
    expect(screen.queryByRole("button", { name: "Mises en relation" })).toBeNull()
  })

  it("destinations : rend la liste injectée avec la recherche, sans fil personnel ni invitation, et s'en souvient", () => {
    renderWithEngine(<MessagerieListView variant="page" nav={nav} unread={0} source={source} destinationMode stateScope={scope} renderContextualList={renderContextualList} />)
    expect(screen.getByTestId("group-invitations")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Mises en relation" }))
    expect(screen.getByRole("button", { name: "Mises en relation" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByTestId("contextual-list").textContent).toBe("liste:")
    expect(screen.queryByText("Nadia personnelle")).toBeNull()
    expect(screen.queryByTestId("group-invitations")).toBeNull()
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher une mise en relation" }), { target: { value: "atelier" } })
    expect(screen.getByTestId("contextual-list").textContent).toBe("liste:atelier")
    expect(readListState(scope).filter).toBe("mises_en_relation")
  })

  it("volets : offert aussi, à côté des filtres historiques", () => {
    renderWithEngine(<MessagerieListView variant="page" nav={nav} unread={0} source={source} renderContextualList={renderContextualList} />)
    expect(screen.getByText("Individuels")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Mises en relation" }))
    expect(screen.getByTestId("contextual-list")).toBeTruthy()
    expect(screen.queryByText("Nadia personnelle")).toBeNull()
  })
})
