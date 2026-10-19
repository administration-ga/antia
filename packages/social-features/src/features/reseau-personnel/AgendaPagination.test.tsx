// @vitest-environment jsdom
// Scénarios de sources écrits sans exécution pour DG-023.
import type { Id } from "@antsia/api/engine"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { StrictMode, useState, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { AgendaPagination, type AgendaPaginationValue } from "./AgendaPagination"
import type { AgendaRow, AssociationAgendaItem } from "./association-agenda"
import type { CursorPage } from "./cursor-pages"
import type { EvenementListItem } from "./evenements-list"

interface NativeArgs {
  readonly networkId: string
  readonly expectedReaderPersonId: string
  readonly source: "organized" | "participations"
  readonly period: "upcoming" | "history"
  readonly anchor: number
  readonly paginationOpts: { readonly cursor: string | null; readonly numItems: number }
}
interface Snapshot {
  readonly data: CursorPage<AgendaRow> | undefined
  readonly isPending: boolean
  readonly isFetching: boolean
  readonly isLoading: boolean
  readonly isError: boolean
}

const mocks = vi.hoisted(() => ({
  networkId: "network-a", personId: "reader-a", requests: [] as NativeArgs[],
  windows: new Map<string, Snapshot>(),
  empty: { page: [], isDone: true, continueCursor: "" } as CursorPage<AgendaRow>,
  refetch: vi.fn<() => Promise<unknown>>(),
}))

vi.mock("@antsia/api/engine", () => ({ api: { modules: { events: { events: { paginateMyAgenda: "paginateMyAgenda" } } } } }))
vi.mock("@antsia/api/network", async (original) => ({
  ...await original<typeof import("@antsia/api/network")>(),
  useNetwork: () => ({ networkId: mocks.networkId, personId: mocks.personId }),
}))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (_query: unknown, args: NativeArgs) => {
    mocks.requests.push(args)
    const key = JSON.stringify([args.networkId, args.expectedReaderPersonId, args.source, args.period, args.anchor, args.paginationOpts.cursor])
    const snapshot = mocks.windows.get(key) ?? { data: mocks.empty, isPending: false, isFetching: false, isLoading: false, isError: false }
    return { ...snapshot, refetch: mocks.refetch }
  },
}))

const NOW = Date.UTC(2026, 9, 18, 12)
const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr", "reseau")
const MORE = t("associationAgenda.pagination.more")

function personal(id: string, startAt = NOW + 3_600_000): AgendaRow {
  const event: EvenementListItem = {
    eventId: id as Id<"events">, title: id, description: null, location: null, startAt, endAt: startAt + 3_600_000,
    timeZone: "UTC", status: "scheduled", cancelledAt: null, isOrganizer: true, myParticipation: null,
    organizer: { personId: "person" as Id<"persons">, displayName: "Awa NDONG", handle: "awa", headline: null, avatarUrl: null, source: "published" },
    participantCount: 0, acceptedCount: 0, announcePostId: null, createdAt: NOW,
  }
  return { kind: "personal", event }
}
function collective(id: string): AgendaRow {
  const event: AssociationAgendaItem = {
    kind: "association", eventId: id as Id<"events">, pageId: "page" as Id<"pages">, title: id, description: null, location: null,
    startAt: NOW + 7_200_000, endAt: NOW + 10_800_000, timeZone: "UTC", status: "scheduled", cancelledAt: null,
    version: 1, organizer: { name: "Association", handle: "association" }, registration: "waitlisted",
  }
  return { kind: "association", event }
}
function ready(page: readonly AgendaRow[] = [], continueCursor = "", isDone = true): Snapshot {
  return { data: { page, continueCursor, isDone }, isPending: false, isFetching: false, isLoading: false, isError: false }
}
function windowKey(source: NativeArgs["source"], period: NativeArgs["period"], cursor: string | null = null, anchor = NOW) {
  return JSON.stringify([mocks.networkId, mocks.personId, source, period, anchor, cursor])
}
function setWindow(source: NativeArgs["source"], period: NativeArgs["period"], snapshot: Snapshot, cursor: string | null = null, anchor = NOW) {
  mocks.windows.set(windowKey(source, period, cursor, anchor), snapshot)
}
function ProbeContent({ value }: { readonly value: AgendaPaginationValue }) {
  const [draft, setDraft] = useState("")
  const rows = [...(value.data?.items ?? []), ...(value.data?.associationItems ?? [])]
  return <>
    <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <output data-testid="flags">{JSON.stringify({ loading: value.isLoading, error: value.isError, more: value.canLoadMore })}</output>
    {value.isError ? <button onClick={value.refetch}>Retry</button> : null}
    {value.data && rows.length === 0 && !value.canLoadMore ? <p data-testid="empty">Empty</p> : null}
    <ul>{rows.map((row) => <li key={row.eventId}>{row.title}</li>)}</ul>
    {value.controls}
  </>
}
function Probe({ now = NOW }: { readonly now?: number }) { return <AgendaPagination now={now}>{(value) => <ProbeContent value={value} />}</AgendaPagination> }
function environment(children: ReactNode) { return <I18nextProvider i18n={i18n}>{children}</I18nextProvider> }
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  mocks.networkId = "network-a"
  mocks.personId = "reader-a"
  mocks.requests = []
  mocks.windows.clear()
  mocks.refetch.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { cleanup() })

describe("AgendaPagination — quatre abonnements natifs", () => {
  it("rend les premières réponses sous StrictMode et fixe l'ancre malgré les ticks", () => {
    setWindow("organized", "upcoming", ready([personal("initial")]))
    const view = render(environment(<StrictMode><Probe /></StrictMode>))
    expect(screen.getByText("initial")).toBeTruthy()
    const streams = new Set(mocks.requests.map((args) => `${args.source}:${args.period}`))
    expect([...streams].sort()).toEqual(["organized:history", "organized:upcoming", "participations:history", "participations:upcoming"])
    expect(mocks.requests.every((args) => args.networkId === "network-a" && args.expectedReaderPersonId === "reader-a" && args.anchor === NOW && args.paginationOpts.numItems === 20)).toBe(true)
    view.rerender(environment(<StrictMode><Probe now={NOW + 60_000} /></StrictMode>))
    expect(new Set(mocks.requests.map((args) => args.anchor))).toEqual(new Set([NOW]))
    expect(screen.getByText("initial")).toBeTruthy()
  })

  it("garde la suite d'une page filtrée vide sans fabriquer un état vide ou une attente", () => {
    setWindow("organized", "upcoming", ready([], "filtered-next", false))
    setWindow("organized", "upcoming", ready([personal("visible-after-filter")]), "filtered-next")
    render(environment(<Probe />))
    expect(screen.queryByTestId("empty")).toBeNull()
    expect(screen.getByTestId("flags").textContent).toContain('"loading":false')
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getByText("visible-after-filter")).toBeTruthy()
    expect(mocks.requests).toContainEqual({ networkId: "network-a", expectedReaderPersonId: "reader-a", source: "organized", period: "upcoming", anchor: NOW, paginationOpts: { cursor: "filtered-next", numItems: 20 } })
  })

  it("charge plus de 200 lignes par pages natives20 et garde les pages actives", () => {
    for (let page = 0; page < 12; page += 1) {
      const rows = Array.from({ length: 20 }, (_, offset) => personal(`loaded-${page * 20 + offset}`))
      setWindow("organized", "upcoming", ready(rows, `native-${page + 1}`, page === 11), page === 0 ? null : `native-${page}`)
    }
    render(environment(<Probe />))
    for (let page = 1; page < 12; page += 1) fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getAllByRole("listitem")).toHaveLength(240)
    expect(new Set(mocks.requests.filter((args) => args.source === "organized" && args.period === "upcoming").map((args) => args.paginationOpts.cursor)).size).toBe(12)
    expect(screen.queryByRole("button", { name: MORE })).toBeNull()
  })

  it("ferme toutes les lignes pendant la relecture, puis verrouille un refus jusqu'à Réessayer", async () => {
    const cached = ready([collective("private-cached")])
    setWindow("organized", "upcoming", ready([personal("personal-cached")]))
    setWindow("participations", "upcoming", cached)
    const view = render(environment(<Probe />))
    expect(screen.getByText("private-cached")).toBeTruthy()
    setWindow("participations", "upcoming", { ...cached, isFetching: true })
    view.rerender(environment(<Probe />))
    expect(screen.queryByText("private-cached")).toBeNull()
    expect(screen.queryByText("personal-cached")).toBeNull()
    setWindow("participations", "upcoming", { ...cached, isError: true })
    view.rerender(environment(<Probe />))
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
    setWindow("participations", "upcoming", cached)
    view.rerender(environment(<Probe />))
    expect(screen.queryByText("private-cached")).toBeNull()

    // La reprise démarre avec une VRAIE erreur encore présente dans le cache.
    setWindow("participations", "upcoming", { ...cached, isError: true })
    const fresh = deferred()
    mocks.refetch.mockImplementation(() => fresh.promise)
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(4))
    expect(screen.queryByText("private-cached")).toBeNull()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    setWindow("participations", "upcoming", ready([collective("fresh-authorized")]))
    view.rerender(environment(<Probe />))
    expect(screen.queryByText("fresh-authorized")).toBeNull()
    await act(async () => { fresh.resolve(); await fresh.promise })
    expect(screen.getByText("fresh-authorized")).toBeTruthy()
    expect(screen.queryByText("private-cached")).toBeNull()
  })

  it("un rejet de reprise reste une erreur fermée sans restaurer le cache", async () => {
    const cached = ready([collective("must-stay-hidden")])
    setWindow("participations", "upcoming", { ...cached, isError: true })
    render(environment(<Probe />))
    mocks.refetch.mockRejectedValue(new Error("read refused"))
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy())
    expect(screen.queryByText("must-stay-hidden")).toBeNull()
  })

  it("vide l'identité et ses brouillons sur lecteur ou réseau changé et ignore une reprise tardive", async () => {
    setWindow("organized", "upcoming", ready([personal("old-reader")]))
    const view = render(environment(<Probe />))
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "old draft" } })
    setWindow("organized", "upcoming", { ...ready([personal("old-reader")]), isError: true })
    view.rerender(environment(<Probe />))
    const oldRequest = deferred()
    mocks.refetch.mockImplementation(() => oldRequest.promise)
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(4))
    mocks.personId = "reader-b"
    setWindow("organized", "upcoming", ready([personal("new-reader")]), null, NOW + 60_000)
    view.rerender(environment(<Probe now={NOW + 60_000} />))
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("")
    expect(screen.getByText("new-reader")).toBeTruthy()
    await act(async () => { oldRequest.resolve(); await oldRequest.promise })
    expect(screen.queryByText("old-reader")).toBeNull()
    mocks.networkId = "network-b"
    view.rerender(environment(<Probe now={NOW + 120_000} />))
    expect(screen.queryByText("new-reader")).toBeNull()
    expect(mocks.requests).toContainEqual({ networkId: "network-b", expectedReaderPersonId: "reader-b", source: "organized", period: "upcoming", anchor: NOW + 120_000, paginationOpts: { cursor: null, numItems: 20 } })
  })

  it("sans personne, ne lance aucune lecture et ne présente pas un squelette infini", () => {
    mocks.personId = ""
    render(environment(<Probe />))
    expect(mocks.requests).toEqual([])
    expect(screen.getByTestId("flags").textContent).toBe('{"loading":false,"error":false,"more":false}')
    expect(screen.queryByTestId("empty")).toBeNull()
  })
})
