// @vitest-environment jsdom
/**
 * CC-5 — la liste « Mises en relation » (écrit le 19/10/2026, NON EXÉCUTÉ : « Continuer sans
 * vérifier »). Source factice injectée, i18n réelle (FR). Mes fils ou ceux d'une page, une panne
 * jamais présentée comme une liste vide, une recherche locale dite comme telle.
 */
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("./messagerie-styles", () => ({ MessagerieStyles: () => null }))

import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"
import type { ContextualMessagingSource, ContextualThread } from "./contextual-messaging-source"
import { ContextualConversationList } from "./ContextualConversationList"
import type { SourcePageListe } from "./messagerie-source"

const PAGE_CARD = { pageId: "pages_mbolo", networkId: TEST_NETWORK_ID, handle: "atelier-mbolo", name: "Atelier Mbolo", shortName: null, logoUrl: null, badge: null, ownerKind: "association", country: null }

function contextThread(overrides: Record<string, unknown>): ContextualThread {
  return {
    threadId: "thread-1",
    networkId: TEST_NETWORK_ID,
    kind: "diasporaServiceRequest",
    object: { kind: "diasporaServiceRequest", id: "request-1" },
    viewer: { side: "requester", voice: "person" },
    counterpart: { kind: "page", page: PAGE_CARD },
    state: { kind: "open" },
    capabilities: { canSend: true, canAttach: true, canClose: true, canSetCallConsent: false, canCall: false },
    sendRefusal: null,
    callConsent: false,
    callTargets: [],
    callSettings: { outsideRelationsSilenceWaived: false, dndUntil: null, meetingSilence: false, callWaitingOff: false, incomingPushOff: false },
    unread: false,
    revision: 1,
    lastMessageAt: Date.UTC(2026, 9, 19, 9, 0),
    createdAt: Date.UTC(2026, 9, 19, 8, 0),
    ...overrides,
  } as unknown as ContextualThread
}

const SERVICE = contextThread({ threadId: "thread-service", unread: true })
const MENTORING = contextThread({
  threadId: "thread-mentoring",
  kind: "diasporaMentoring",
  object: { kind: "diasporaMentoring", id: "mentoring-1" },
  counterpart: { kind: "person", label: { displayName: "Bilal", handle: "bilal", avatarUrl: null } },
  state: { kind: "read_only", reason: "closed" },
})

function list(overrides: Partial<SourcePageListe<ContextualThread>> = {}): SourcePageListe<ContextualThread> {
  return { data: [SERVICE, MENTORING], isLoading: false, isError: false, error: null, refetch: vi.fn(), isFetching: false, enabled: true, hasMore: false, loadMore: vi.fn(), isLoadingMore: false, ...overrides }
}

function sourceWith(mine: SourcePageListe<ContextualThread>, page: SourcePageListe<ContextualThread> = list()) {
  const calls = { mine: [] as unknown[], page: [] as unknown[] }
  const source: ContextualMessagingSource = {
    espace: "contextuel",
    useMyThreadsPage: (kind) => {
      calls.mine.push(kind)
      return mine
    },
    usePageThreadsPage: (pageId, kind) => {
      calls.page.push([pageId, kind])
      return page
    },
    useThread: () => {
      throw new Error("La liste ne lit aucun fil")
    },
    useThreadForObject: () => {
      throw new Error("La liste ne lit aucun objet")
    },
    useMessages: () => {
      throw new Error("La liste ne lit aucun message")
    },
    useWrites: () => {
      throw new Error("La liste n'écrit rien")
    },
  }
  return { source, calls }
}

describe("liste « Mises en relation » (CC-5)", () => {
  it("rend mes fils : l'autre côté, la nature, l'état, le non-lu — et ouvre une conversation", () => {
    const { source, calls } = sourceWith(list())
    const onOpen = vi.fn()
    renderWithEngine(<ContextualConversationList source={source} onOpen={onOpen} activeThreadId="thread-mentoring" />)
    expect(calls.page).toEqual([])
    const service = screen.getByRole("button", { name: /Atelier Mbolo/ })
    expect(within(service).getByText("Demande de service · Ouverte")).toBeInTheDocument()
    expect(within(service).getByText("Messages non lus")).toHaveClass("sr-only")
    expect(service.getAttribute("data-unread")).toBe("true")
    const mentoring = screen.getByRole("button", { name: /Bilal/ })
    expect(within(mentoring).getByText("Mentorat · Fermée")).toBeInTheDocument()
    expect(mentoring.getAttribute("aria-current")).toBe("true")
    fireEvent.click(service)
    expect(onOpen).toHaveBeenCalledWith("thread-service")
  })

  it("cherche localement, et le dit", () => {
    const { source } = sourceWith(list())
    renderWithEngine(<ContextualConversationList source={source} onOpen={vi.fn()} query="mentorat" />)
    expect(screen.getByText("Recherche sur les mises en relation déjà chargées.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Atelier Mbolo/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Bilal/ })).toBeInTheDocument()
  })

  it("une recherche sans résultat chargé propose d'aller au bout de la liste", () => {
    const loadMore = vi.fn()
    const { source } = sourceWith(list({ hasMore: true, loadMore }))
    renderWithEngine(<ContextualConversationList source={source} onOpen={vi.fn()} query="introuvable" />)
    expect(screen.getByText("Aucune mise en relation chargée ne correspond à « introuvable ».")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de mises en relation" }))
    expect(loadMore).toHaveBeenCalledOnce()
  })

  it("une liste vide se dit vide ; une panne se dit panne, avec Réessayer", () => {
    const empty = sourceWith(list({ data: [] }))
    const first = renderWithEngine(<ContextualConversationList source={empty.source} onOpen={vi.fn()} />)
    expect(screen.getByText(/Aucune mise en relation pour l'instant/)).toBeInTheDocument()
    first.unmount()
    const refetch = vi.fn()
    const broken = sourceWith(list({ data: undefined, isError: true, error: new Error("panne"), refetch }))
    renderWithEngine(<ContextualConversationList source={broken.source} onOpen={vi.fn()} />)
    expect(screen.getByText("Mises en relation indisponibles")).toBeInTheDocument()
    expect(screen.queryByText(/Aucune mise en relation pour l'instant/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(refetch).toHaveBeenCalled()
  })

  it("avec une page, lit les fils de la page (signataire vivant), jamais les miens", () => {
    const pageId = "pages_mbolo" as NonNullable<Parameters<ContextualMessagingSource["usePageThreadsPage"]>[0]>
    const { source, calls } = sourceWith(list({ data: [] }), list({ data: [MENTORING] }))
    renderWithEngine(<ContextualConversationList source={source} onOpen={vi.fn()} pageId={pageId} kind="diasporaMentoring" />)
    expect(calls.mine).toEqual([])
    expect(calls.page.at(-1)).toEqual([pageId, "diasporaMentoring"])
    expect(screen.getByRole("button", { name: /Bilal/ })).toBeInTheDocument()
  })
})
