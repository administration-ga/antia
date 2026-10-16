// @vitest-environment jsdom
// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/directs-panel.test.ts @ ad2e7fdc2 — adaptations : rail paginé, droits réactifs et routes du moteur.
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { createAppI18n } from "../../i18n"
import { DirectsLiveRail } from "./DirectsLiveRail"

const mocks = vi.hoisted(() => ({ networkId: "network-a", empty: true, fail: false, done: false }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: mocks.networkId }), useRoutes: () => ({ conference: (id: string) => `/room/${id}`, profile: (handle: string) => `/person/${handle}` }) }))
vi.mock("@antsia/api/routing", () => ({ Link: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a> }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (_ref: unknown, args: { cursor?: unknown }) => ({
  data: { items: mocks.empty && !args.cursor ? [] : [{ sessionId: mocks.networkId, title: "Recette", startedAt: 1, host: { displayName: "Awa", handle: "awa", avatarUrl: null } }], nextCursor: !args.cursor && !mocks.done ? { startedAt: 1, sessionId: "next" } : null },
  isError: mocks.fail, isFetching: false, refetch: vi.fn(),
}) }))
const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "direct" })
const tree = () => <I18nextProvider i18n={i18n}><DirectsLiveRail now={60001} /></I18nextProvider>
beforeEach(() => { mocks.networkId = "network-a"; mocks.empty = true; mocks.fail = false; mocks.done = false })
afterEach(cleanup)
describe("rail F3c", () => {
  it("continue une fenêtre vide et rend deux liens frères", () => {
    const { container } = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    expect(screen.getByRole("link", { name: /Recette/ })).toHaveAttribute("href", "/room/network-a")
    expect(screen.getByRole("link", { name: "Profil de Awa" })).toHaveAttribute("href", "/person/awa")
    expect(container.querySelector("a a")).toBeNull()
  })
  it("efface la fenêtre lors du changement de réseau et masque les cartes en erreur", () => {
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    mocks.networkId = "network-b"; view.rerender(tree())
    expect(screen.queryByRole("link")).toBeNull()
    mocks.empty = false; view.rerender(tree())
    mocks.fail = true; view.rerender(tree())
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByRole("alert")).toBeTruthy()
  })
  it("reste silencieux seulement lorsque la dernière fenêtre est vide", () => {
    mocks.done = true
    render(tree())
    expect(screen.queryByRole("region")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
