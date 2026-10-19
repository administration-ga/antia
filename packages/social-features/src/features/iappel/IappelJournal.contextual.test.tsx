// @vitest-environment jsdom
/**
 * CC-5 (aligné sur CC-4) — un appel de conversation CONTEXTUELLE se rappelle PAR sa conversation,
 * jamais par l'appel personnel (`callMember`) ni par un fil personnel : journal, écran de fin et ajout
 * de participant. Écrit le 19/10/2026, NON EXÉCUTÉ (« Continuer sans vérifier »).
 */
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ rows: [] as unknown[], markSeen: vi.fn() }))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: () => ({ data: { calls: state.rows, truncated: false }, isLoading: false, isError: false }),
}))
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useMutation: () => state.markSeen,
}))

import { renderWithEngine } from "../../tests/engine-wrapper"
import { callEndActions } from "./call-end-actions"
import { journalEntryOf, type CallHistoryRow } from "./call-journal"
import { IappelJournal } from "./IappelJournal"

const AWA: CounterpartLabel = { displayName: "Awa", handle: "awa", headline: null, avatarUrl: null, source: "published" }

function contextualRow(over: Partial<CallHistoryRow> = {}): CallHistoryRow {
  return {
    callId: "calls_ctx" as CallHistoryRow["callId"],
    contextualThreadId: "thread-ctx" as NonNullable<CallHistoryRow["contextualThreadId"]>,
    kind: "direct",
    category: "missed",
    reason: null,
    mediaType: "audio",
    startedAt: Date.now() - 60_000,
    durationMs: null,
    declineNote: null,
    counterpart: { personId: "persons_awa" as NonNullable<CallHistoryRow["counterpart"]>["personId"], label: AWA },
    group: null,
    createdByMe: false,
    ...over,
  }
}

beforeEach(() => {
  state.rows = []
  state.markSeen.mockReset()
})

describe("journal : une ligne contextuelle se rappelle par sa conversation", () => {
  it("garde l'origine contextuelle sans l'ajouter aux lignes personnelles", () => {
    expect(journalEntryOf(contextualRow()).contextualThreadId).toBe("thread-ctx")
    const { contextualThreadId: _absent, ...personal } = contextualRow()
    expect(journalEntryOf(personal as CallHistoryRow)).not.toHaveProperty("contextualThreadId")
  })

  it("« Rappeler » et « Écrire » ouvrent la conversation ; jamais l'appel ni le fil personnels", () => {
    state.rows = [contextualRow()]
    const onCallBack = vi.fn()
    const onWrite = vi.fn()
    const onContextualOpen = vi.fn()
    renderWithEngine(<IappelJournal onCallBack={onCallBack} onWrite={onWrite} onContextualOpen={onContextualOpen} />)
    expect(screen.getByText(/Mise en relation/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Rappeler Awa depuis la mise en relation" }))
    fireEvent.click(screen.getByRole("button", { name: "Écrire à Awa dans la mise en relation" }))
    expect(onContextualOpen.mock.calls).toEqual([["thread-ctx"], ["thread-ctx"]])
    expect(onCallBack).not.toHaveBeenCalled()
    expect(onWrite).not.toHaveBeenCalled()
  })

  it("sans conversation injectée, la ligne contextuelle n'offre aucun geste — jamais un rappel personnel", () => {
    state.rows = [contextualRow()]
    const onCallBack = vi.fn()
    renderWithEngine(<IappelJournal onCallBack={onCallBack} onWrite={vi.fn()} />)
    const callBack = screen.getByRole("button", { name: "Rappeler Awa depuis la mise en relation" })
    expect(callBack).toBeDisabled()
    fireEvent.click(callBack)
    expect(onCallBack).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Écrire à Awa dans la mise en relation" })).toBeNull()
  })
})

describe("fin d'un appel contextuel", () => {
  const routes = { messages: () => "/messages" }
  const base = { kind: "direct" as const, peer: { userId: "persons_awa", handle: "awa" }, routes }

  it("ni rappel personnel, ni fil personnel, ni ajout de participant : retour à la conversation", () => {
    expect(callEndActions({ ...base, meeting: { contextualThreadId: "thread-ctx" } })).toEqual({
      retryAvailable: false,
      writeHref: "/messages/mise-en-relation/thread-ctx",
      addParticipantAvailable: false,
    })
  })

  it("un appel personnel garde ses gestes", () => {
    expect(callEndActions({ ...base, meeting: {} })).toEqual({ retryAvailable: true, writeHref: "/messages/a/awa", addParticipantAvailable: true })
  })
})
