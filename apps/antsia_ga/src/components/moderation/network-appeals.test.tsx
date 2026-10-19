import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ data: undefined as undefined | { page: { appealId: string; reportId: string; reason: string; createdAt: number; decisionReason: string | null; sanctions: { kind: string; until: number | null }[]; canDecide: boolean }[]; isDone: boolean; continueCursor: string }, error: null as unknown, calls: [] as unknown[] }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { moderation: { networkAppeals: { paginate: "appeals" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root" }) }))
vi.mock("@antsia/api/viewer-preferences", () => ({ useViewerTimeZone: () => "UTC" }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: unknown, args: unknown) => { state.calls.push([reference, args]); return { data: state.data, error: state.error, refetch: vi.fn() } } }))
vi.mock("./moderation-guard", () => ({ useModerationGuard: () => ({ pending: false }) }))
vi.mock("./moderation-forms", () => ({ AppealDecision: ({ canDecide }: { canDecide: boolean }) => <button disabled={!canDecide}>decision</button> }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }))

import { NetworkAppealRows } from "./network-appeals"
const tree = () => <NetworkAppealRows cursor="opaque" onFirst={() => undefined} onNext={() => undefined} />
beforeEach(() => { state.data = undefined; state.error = null; state.calls = [] })

describe("file de recours réseau", () => {
  it("borne la lecture à vingt dossiers sans argument d'équipe ou d'identité", () => {
    renderToStaticMarkup(tree())
    expect(state.calls).toEqual([["appeals", { networkId: "root", paginationOpts: { numItems: 20, cursor: "opaque", maximumRowsRead: 50, maximumBytesRead: 262_144 } }]])
  })
  it("une page filtrée vide ne termine pas la file", () => {
    state.data = { page: [], isDone: false, continueCursor: "next" }
    const html = renderToStaticMarkup(tree())
    expect(html).toContain("moderation.emptyWindow"); expect(html).toContain("common.next"); expect(html).not.toContain("common.end")
  })
  it("une erreur ferme les données même si un ancien résultat reste en mémoire", () => {
    state.data = { page: [], isDone: true, continueCursor: "" }; state.error = new Error("denied")
    const html = renderToStaticMarkup(tree())
    expect(html).toContain("common.retry"); expect(html).not.toContain("moderation.empty"); expect(html).not.toContain("common.end")
  })
  it("un recours non indépendant rend sa commande fermée", () => {
    state.data = { page: [{ appealId: "appeal", reportId: "report", reason: "Motif", createdAt: 1_700_000_000_000, decisionReason: "Motif initial", sanctions: [{ kind: "warning", until: null }], canDecide: false }], isDone: true, continueCursor: "" }
    const html = renderToStaticMarkup(tree())
    expect(html).toContain('disabled=""'); expect(html).toContain("moderation.initialSanctions"); expect(html).toContain("common.end")
  })
})
