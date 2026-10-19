// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { IappelJournalProps } from "../iappel/IappelJournal"
import { journalEntryOf, type CallHistoryRow } from "../iappel/call-journal"

const state = vi.hoisted(() => ({ props: undefined as IappelJournalProps | undefined, current: true, query: vi.fn(), direct: vi.fn(), commercial: vi.fn(), outgoing: vi.fn(), refused: vi.fn(), error: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { calls: { direct: { callMember: "direct" } }, commercialMessaging: { threads: { getThread: "get" }, calls: { startCall: "commercial" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network", personId: "viewer" }) }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useConvex: () => ({ query: state.query }), useMutation: (reference: unknown) => reference === "direct" ? state.direct : state.commercial }))
vi.mock("./use-conversation-send", () => ({ useConversationSend: () => ({ isCurrent: () => state.current }) }))
vi.mock("../iappel/IappelJournal", () => ({ IappelJournal: (props: IappelJournalProps) => { state.props = props; return null } }))
vi.mock("../../stores/call-store", () => ({ useCallStore: () => ({ openOutgoingCall: state.outgoing, openRefusedCall: state.refused }) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("sonner", () => ({ toast: { error: state.error } }))

import { IcomAppelJournal } from "./IcomAppelJournal"

let root: Root | undefined
let container: HTMLDivElement
const threadId = "commercial-thread" as NonNullable<CallHistoryRow["commercialThreadId"]>
async function mount(commercial = true) { root = createRoot(container); await act(async () => { root?.render(<IcomAppelJournal commercial={commercial} onOpenCommercialThread={vi.fn()} />) }) }
async function callBack() { await act(async () => { state.props?.onCommercialCallBack?.({ threadId, counterpartPersonId: "respondent", name: "Chosen name", mediaType: "audio" }) }) }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div"); document.body.append(container)
  state.props = undefined; state.current = true
  state.query.mockReset().mockResolvedValue({ viewerKind: "requester", capabilities: { canCall: true }, respondents: [{ personId: "respondent", callConsent: true }] })
  state.direct.mockReset(); state.commercial.mockReset().mockResolvedValue({ admitted: true, callId: "call", calleePersonId: "respondent", mediaType: "audio" }); state.outgoing.mockReset(); state.refused.mockReset(); state.error.mockReset()
})
afterEach(async () => { await act(async () => { root?.unmount() }); root = undefined; container.remove() })

describe("origine commerciale conservée dans le journal", () => {
  it("conserve la référence sur la projection sans ajouter de champ aux lignes personnelles", () => {
    const row: CallHistoryRow = { callId: "call" as CallHistoryRow["callId"], kind: "direct", category: "outgoing", reason: null, mediaType: "audio", startedAt: 1, durationMs: null, declineNote: null, counterpart: null, group: null, createdByMe: true }
    expect(journalEntryOf(row)).not.toHaveProperty("commercialThreadId")
    expect(journalEntryOf({ ...row, commercialThreadId: threadId }).commercialThreadId).toBe(threadId)
  })
  it("ferme les gestes commerciaux sans injection", async () => {
    await mount(false)
    expect(state.props?.onCommercialCallBack).toBeUndefined()
    expect(state.props?.onCommercialWrite).toBeUndefined()
  })
  it("rappelle un répondant via startCall après relecture, sans appel personnel", async () => {
    await mount(); await callBack()
    expect(state.query).toHaveBeenCalledWith("get", { networkId: "network", threadId })
    expect(state.commercial).toHaveBeenCalledWith({ networkId: "network", threadId, respondentPersonId: "respondent", mediaType: "audio" })
    expect(state.direct).not.toHaveBeenCalled()
    expect(state.outgoing).toHaveBeenCalledTimes(1)
  })
  it("côté vendeur laisse le serveur cibler le demandeur", async () => {
    state.query.mockResolvedValue({ viewerKind: "shop", capabilities: { canCall: true }, respondents: [] })
    await mount(); await callBack()
    expect(state.commercial).toHaveBeenCalledWith({ networkId: "network", threadId, mediaType: "audio" })
    expect(state.direct).not.toHaveBeenCalled()
  })
  it("un droit perdu ou une session partie ferme le rappel", async () => {
    state.query.mockResolvedValue({ viewerKind: "requester", capabilities: { canCall: false }, respondents: [] })
    await mount(); await callBack()
    expect(state.commercial).not.toHaveBeenCalled()
    expect(state.direct).not.toHaveBeenCalled()
    state.query.mockImplementationOnce(async () => { state.current = false; return { viewerKind: "requester", capabilities: { canCall: true }, respondents: [{ personId: "respondent", callConsent: true }] } })
    await callBack()
    expect(state.commercial).not.toHaveBeenCalled()
    expect(state.outgoing).not.toHaveBeenCalled()
  })
})
