// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { DirectsPanel } from "./DirectsPanel"

const mocks = vi.hoisted(() => ({ networkId: "network-a", fail: false, emptyFirst: false }))
vi.mock("@antia/api/network", () => ({
  useNetwork: () => ({ networkId: mocks.networkId }),
  useRoutes: () => ({ conference: (id: string) => `/conference/${id}` }),
}))
vi.mock("@antia/api/routing", () => ({ Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock("./CreateDirectDialog", () => ({ CreateDirectDialog: () => null }))
vi.mock("@antia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: Parameters<typeof getFunctionName>[0], args: "skip" | { networkId: string; cursor?: { sessionId: string } }) => {
    const first = args !== "skip" && !args.cursor
    const title = args !== "skip" ? `${args.networkId}-conférence` : ""
    return {
      data: args === "skip" ? undefined : {
        items: mocks.emptyFirst && first ? [] : [{ sessionId: `${args.networkId}-${first ? "a" : "b"}`, title: `${title}-${first ? "a" : "b"}` }],
        nextCursor: first && getFunctionName(ref).endsWith(":listLive") ? { startedAt: 1, sessionId: "cursor-next" } : null,
      },
      isError: mocks.fail, isPending: false, isFetching: false, refetch: vi.fn(),
    }
  },
}))
const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "direct" })
const tree = () => <I18nextProvider i18n={i18n}><DirectsPanel /></I18nextProvider>
beforeEach(() => { mocks.networkId = "network-a"; mocks.fail = false; mocks.emptyFirst = false })
afterEach(cleanup)

describe("conférences — curseurs et frontière du réseau", () => {
  it("continue une page vide lorsque le serveur rend un curseur", () => {
    mocks.emptyFirst = true
    render(tree())
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    expect(screen.getByRole("link", { name: /network-a-conférence-b/ })).toBeTruthy()
  })

  it("ne conserve pas les cartes des pages précédentes lors d'un changement de réseau", () => {
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    expect(screen.getAllByRole("link")).toHaveLength(2)
    mocks.networkId = "network-b"
    view.rerender(tree())
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(screen.queryByRole("link", { name: /network-a/ })).toBeNull()
  })

  it("retire les cartes mémorisées lorsqu'une lecture est refusée", () => {
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }))
    mocks.fail = true
    view.rerender(tree())
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
