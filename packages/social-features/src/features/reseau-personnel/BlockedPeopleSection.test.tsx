// @vitest-environment jsdom
import { type api, type Id } from "@antsia/api/engine"
import { NetworkProvider, useNetwork } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName, type FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { useEffect, useMemo } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

type BlockPage = FunctionReturnType<typeof api.modules.graph.blocks.paginateMine>
type BlockRow = BlockPage["page"][number]
type Source = "intents" | "legacy"
interface QueryMock {
  data: BlockPage | undefined
  isPending: boolean
  isError: boolean
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  pages: new Map<string, QueryMock>(),
  pending: new Map<string, QueryMock>(),
  active: new Set<string>(),
  query: vi.fn(),
  mutationRefs: vi.fn(),
  unblock: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

const BLOCK_QUERY = "modules/graph/blocks:paginateMine"
const UNBLOCK_MUTATION = "modules/graph/connections:unblockPerson"
const BASE_DATE = Date.UTC(2026, 9, 1)

function key(source: Source, cursor: string | null = null, networkId: string = TEST_NETWORK_ID, personId: string = TEST_PERSON_ID) {
  return JSON.stringify([networkId, personId, source, cursor])
}
function ok(data: BlockPage | undefined): QueryMock {
  return { data, isPending: false, isError: false, refetch: vi.fn().mockResolvedValue(undefined) }
}
function blocked(id: string, day = 0): BlockRow {
  return { targetPersonId: `persons_${id}` as Id<"persons">, at: BASE_DATE + day * 86_400_000 }
}
function page(rows: BlockRow[], cursor: string | null = null): BlockPage {
  return { page: rows, isDone: cursor === null, continueCursor: cursor ?? "" }
}
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: never, args: { networkId: string; source: Source; paginationOpts: { cursor: string | null; numItems: number } }) => {
    const { personId } = useNetwork()
    const name = getFunctionName(ref)
    if (name !== BLOCK_QUERY) throw new Error(`Unexpected query: ${name}`)
    const queryKey = key(args.source, args.paginationOpts.cursor, args.networkId, personId)
    mocks.query(name, args)
    useEffect(() => {
      mocks.active.add(queryKey)
      return () => { mocks.active.delete(queryKey) }
    }, [queryKey])
    if (!mocks.pending.has(queryKey)) mocks.pending.set(queryKey, { ...ok(undefined), isPending: true })
    return mocks.pages.get(queryKey) ?? mocks.pending.get(queryKey)!
  },
}))
vi.mock("convex/react", () => ({
  useMutation: (ref: never) => {
    mocks.mutationRefs(getFunctionName(ref))
    return mocks.unblock
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

import { BlockedPeopleSection } from "./BlockedPeopleSection"

const translations = {
  fr: createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" }).getFixedT("fr", "reseau"),
  en: createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "social" }).getFixedT("en", "reseau"),
}
const t = translations.fr

function Fixture({ networkId = TEST_NETWORK_ID, personId = TEST_PERSON_ID, locale = "fr" }: {
  networkId?: Id<"networks">
  personId?: Id<"persons">
  locale?: "fr" | "en"
}) {
  const i18n = useMemo(() => createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "social" }), [locale])
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter().implementation}>
        <NetworkProvider networkId={networkId} personId={personId} slug="test" charte="antsia" routes={TEST_ROUTES}>
          <BlockedPeopleSection />
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

function beginConfirmation(index = 0) {
  fireEvent.click(screen.getAllByRole("button", { name: t("peoplePanel.blocks.unblock") })[index]!)
  return screen.getByRole("dialog", { name: t("peoplePanel.blocks.confirmTitle") })
}
function confirmButton() {
  return within(screen.getByRole("dialog")).getByRole("button", { name: t("peoplePanel.blocks.unblock") })
}

beforeEach(() => {
  mocks.pages.clear()
  mocks.pending.clear()
  mocks.active.clear()
  mocks.query.mockClear()
  mocks.mutationRefs.mockClear()
  mocks.unblock.mockReset().mockResolvedValue(null)
  mocks.success.mockClear()
  mocks.error.mockClear()
  mocks.pages.set(key("intents"), ok(page([])))
  mocks.pages.set(key("legacy"), ok(page([])))
})
afterEach(cleanup)

describe("BlockedPeopleSection — protections personnelles neutres", () => {
  it.each(["fr", "en"] as const)("monte seulement les deux sources natives, sans identité ou lien en %s", (locale) => {
    mocks.pages.set(key("intents"), ok(page([blocked("secret_intent")])))
    mocks.pages.set(key("legacy"), ok(page([blocked("secret_legacy", 1)])))
    const { container } = render(<Fixture locale={locale} />)
    const translated = translations[locale]

    expect(screen.getByRole("heading", { name: translated("peoplePanel.blocks.title") })).toBeTruthy()
    expect(screen.getByText(translated("peoplePanel.blocks.globalScope"))).toBeTruthy()
    expect(screen.getAllByText(translated("peoplePanel.blocks.neutral"))).toHaveLength(2)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(container.textContent).not.toContain("secret_intent")
    expect(container.textContent).not.toContain("secret_legacy")
    expect(new Set(mocks.query.mock.calls.map(([name]) => name))).toEqual(new Set([BLOCK_QUERY]))
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([UNBLOCK_MUTATION]))
    expect(mocks.active).toEqual(new Set([key("intents"), key("legacy")]))
    for (const [, args] of mocks.query.mock.calls) {
      expect(args).toMatchObject({ networkId: TEST_NETWORK_ID, paginationOpts: { cursor: null, numItems: 12 } })
      expect(["intents", "legacy"]).toContain(args.source)
    }
  })

  it("déduplique une cible dans les deux sources et conserve sa date canonique", () => {
    mocks.pages.set(key("intents"), ok(page([blocked("same")])))
    mocks.pages.set(key("legacy"), ok(page([blocked("same", 1), blocked("other", 2)])))
    const { container } = render(<Fixture />)

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect([...container.querySelectorAll("time")].map((node) => node.getAttribute("datetime"))).toEqual([
      new Date(BASE_DATE).toISOString(), new Date(BASE_DATE + 2 * 86_400_000).toISOString(),
    ])
  })

  it("n'annonce le vide qu'après les deux premières pages terminales", () => {
    mocks.pages.delete(key("legacy"))
    const view = render(<Fixture />)
    expect(screen.getByRole("status")).toHaveTextContent(t("peoplePanel.loading"))
    expect(screen.queryByText(t("peoplePanel.blocks.empty"))).toBeNull()
    mocks.pages.set(key("legacy"), ok(page([])))
    view.rerender(<Fixture />)
    expect(screen.getByText(t("peoplePanel.blocks.empty"))).toBeTruthy()
  })
})

describe("BlockedPeopleSection — deux chaînes réactives", () => {
  it("charge la suite propre à chaque source et conserve leurs abonnements antérieurs", () => {
    mocks.pages.set(key("intents"), ok(page([blocked("a")], "intents-2")))
    mocks.pages.set(key("legacy"), ok(page([blocked("b", 1)], "legacy-2")))
    mocks.pages.set(key("intents", "intents-2"), ok(page([blocked("c", 2)])))
    mocks.pages.set(key("legacy", "legacy-2"), ok(page([blocked("d", 3)])))
    const { container, rerender } = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(mocks.active).toEqual(new Set([key("intents"), key("legacy"), key("intents", "intents-2"), key("legacy", "legacy-2")]))
    mocks.pages.set(key("intents"), ok(page([blocked("a", 9)], "intents-2")))
    rerender(<Fixture />)
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(BASE_DATE + 9 * 86_400_000).toISOString())
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })

  it.each(["intents", "legacy"] as const)("une page vide non terminale de %s garde sa continuation", (source) => {
    mocks.pages.set(key(source), ok(page([], "second")))
    mocks.pages.set(key(source, "second"), ok(page([blocked("a")], "third")))
    mocks.pages.set(key(source, "third"), ok(page([])))
    render(<Fixture />)
    expect(screen.queryByText(t("peoplePanel.blocks.empty"))).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    expect(screen.queryByRole("button", { name: t("peoplePanel.blocks.loadMore") })).toBeNull()
  })

  it("une page intermédiaire vide laisse atteindre la page suivante", () => {
    mocks.pages.set(key("legacy"), ok(page([blocked("a")], "second")))
    mocks.pages.set(key("legacy", "second"), ok(page([], "third")))
    mocks.pages.set(key("legacy", "third"), ok(page([blocked("b", 1)])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("rebase une source sans abandonner les pages valides de l'autre et ignore l'ancienne réponse", () => {
    mocks.pages.set(key("intents"), ok(page([blocked("base")], "old")))
    mocks.pages.set(key("intents", "old"), ok(page([blocked("abandoned", 1)], "deep")))
    mocks.pages.set(key("intents", "deep"), ok(page([blocked("deep", 2)])))
    mocks.pages.set(key("intents", "new"), ok(page([blocked("new", 3)])))
    mocks.pages.set(key("legacy"), ok(page([blocked("legacy", 4)], "legacy-2")))
    mocks.pages.set(key("legacy", "legacy-2"), ok(page([blocked("legacy-deep", 5)])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    expect(screen.getAllByRole("listitem")).toHaveLength(5)
    mocks.pages.set(key("intents"), ok(page([blocked("base")], "new")))
    view.rerender(<Fixture />)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(mocks.active).toEqual(new Set([key("intents"), key("intents", "new"), key("legacy"), key("legacy", "legacy-2")]))
    mocks.pages.set(key("intents", "old"), ok(page([blocked("late", 10)])))
    view.rerender(<Fixture />)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(document.querySelector(`time[datetime="${new Date(BASE_DATE + 10 * 86_400_000).toISOString()}"]`)).toBeNull()
  })

  it("annonce le chargement suivant, conserve les lignes et bloque les doubles ajouts", () => {
    mocks.pages.set(key("intents"), ok(page([blocked("a")], "second")))
    const { container } = render(<Fixture />)
    const load = screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") })
    act(() => { load.click(); load.click() })
    expect(screen.getByRole("button", { name: t("peoplePanel.loading") })).toBeDisabled()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(mocks.active).toEqual(new Set([key("intents"), key("intents", "second"), key("legacy")]))
  })

  it("une erreur initiale d'une source ne masque pas les données de l'autre et propose Réessayer", async () => {
    const failure = { ...ok(undefined), isError: true, refetch: vi.fn().mockRejectedValue(new Error("PRIVATE_READ_FAILURE")) }
    mocks.pages.set(key("intents"), failure)
    mocks.pages.set(key("legacy"), ok(page([blocked("a")])))
    render(<Fixture />)
    expect(screen.getByRole("alert")).toHaveTextContent(t("peoplePanel.blocks.errorTitle"))
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.queryByText(t("peoplePanel.blocks.empty"))).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("reseauQueryError.retry") })) })
    expect(failure.refetch).toHaveBeenCalledTimes(1)
    expect(mocks.pages.get(key("legacy"))!.refetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("PRIVATE_READ_FAILURE")).toBeNull()
  })

  it("conserve les lignes d'une page en erreur puis les remplace à la reprise", () => {
    mocks.pages.set(key("intents"), ok(page([blocked("a")], "second")))
    mocks.pages.set(key("intents", "second"), ok(page([blocked("b", 1)])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    const failure = { ...ok(undefined), isError: true }
    mocks.pages.set(key("intents", "second"), failure)
    view.rerender(<Fixture />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: t("reseauQueryError.retry") }))
    expect(failure.refetch).toHaveBeenCalledTimes(1)
    mocks.pages.set(key("intents", "second"), ok(page([])))
    view.rerender(<Fixture />)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })
})

describe("BlockedPeopleSection — confirmation et déblocage", () => {
  it.each(["cancel", "close", "escape"] as const)("la fermeture %s annule la confirmation sans mutation", (method) => {
    mocks.pages.set(key("intents"), ok(page([blocked("a")])))
    render(<Fixture />)
    const dialog = beginConfirmation()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleDescription(t("peoplePanel.blocks.confirmBody"))
    expect(within(dialog).getByText(t("peoplePanel.blocks.globalScope"))).toBeTruthy()
    expect(mocks.unblock).not.toHaveBeenCalled()
    if (method === "escape") fireEvent.keyDown(document, { key: "Escape" })
    else fireEvent.click(within(dialog).getByRole("button", { name: t(`peoplePanel.blocks.${method}`) }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(mocks.unblock).not.toHaveBeenCalled()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })

  it("confirme une seule fois puis retire la cible des deux sources seulement après succès", async () => {
    const pending = deferred()
    mocks.unblock.mockReturnValue(pending.promise)
    mocks.pages.set(key("intents"), ok(page([blocked("same")], "intents-2")))
    mocks.pages.set(key("intents", "intents-2"), ok(page([blocked("other", 1)])))
    mocks.pages.set(key("legacy"), ok(page([blocked("same"), blocked("third", 2)])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    beginConfirmation()
    const confirm = confirmButton()
    act(() => { confirm.click(); confirm.click() })
    expect(mocks.unblock).toHaveBeenCalledExactlyOnceWith({ networkId: TEST_NETWORK_ID, targetPersonId: "persons_same" })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(mocks.success).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.getByRole("dialog")).toBeTruthy()
    await act(async () => { pending.resolve(); await pending.promise })

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(mocks.success).toHaveBeenCalledWith(t("peoplePanel.blocks.unblocked"))
  })

  it("ferme le message d'un refus, conserve la ligne et permet de réessayer", async () => {
    mocks.unblock.mockRejectedValueOnce(new ConvexError({ code: "notFound", message: "PRIVATE_BLOCK_FAILURE" }))
    mocks.pages.set(key("intents"), ok(page([blocked("a")])))
    render(<Fixture />)
    beginConfirmation()
    await act(async () => { fireEvent.click(confirmButton()) })
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(mocks.error.mock.calls[0]![0]).not.toContain("PRIVATE_BLOCK_FAILURE")
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(confirmButton()).not.toBeDisabled()
    await act(async () => { fireEvent.click(confirmButton()) })
    expect(mocks.unblock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("listitem")).toBeNull()
    expect(screen.getByText(t("peoplePanel.blocks.empty"))).toBeTruthy()
  })

  it("un rejet inattendu reste générique et réactive la confirmation", async () => {
    mocks.unblock.mockRejectedValueOnce(new Error("PRIVATE_TECHNICAL_FAILURE"))
    mocks.pages.set(key("legacy"), ok(page([blocked("a")])))
    render(<Fixture />)
    beginConfirmation()
    await act(async () => { fireEvent.click(confirmButton()) })
    expect(mocks.error).toHaveBeenCalledWith(t("peoplePanel.blocks.unblockFailed"))
    expect(confirmButton()).not.toBeDisabled()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })

  it("n'exige aucun droit de publication ou contexte de communication pour lire et retirer", async () => {
    mocks.pages.set(key("legacy"), ok(page([blocked("a")])))
    render(<Fixture />)
    beginConfirmation()
    await act(async () => { fireEvent.click(confirmButton()) })
    expect(mocks.unblock).toHaveBeenCalledExactlyOnceWith({ networkId: TEST_NETWORK_ID, targetPersonId: "persons_a" })
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([UNBLOCK_MUTATION]))
    expect(screen.getByText(t("peoplePanel.blocks.empty"))).toBeTruthy()
  })

  it.each(["network", "person"] as const)("remet à zéro pages, curseurs et confirmation au changement de %s", (changed) => {
    mocks.pages.set(key("intents"), ok(page([blocked("a")], "second")))
    mocks.pages.set(key("intents", "second"), ok(page([blocked("b", 1)])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: t("peoplePanel.blocks.loadMore") }))
    beginConfirmation()
    const networkId = changed === "network" ? "networks_other" as Id<"networks"> : TEST_NETWORK_ID
    const personId = changed === "person" ? "persons_other" as Id<"persons"> : TEST_PERSON_ID
    view.rerender(<Fixture networkId={networkId} personId={personId} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("listitem")).toBeNull()
    expect(screen.getByRole("status")).toHaveTextContent(t("peoplePanel.loading"))
    expect(mocks.active).toEqual(new Set([key("intents", null, networkId, personId), key("legacy", null, networkId, personId)]))
  })

  it.each(["success", "error"] as const)("ignore la résolution %s d'un déblocage de l'ancien lecteur", async (result) => {
    const pending = deferred()
    mocks.unblock.mockReturnValue(pending.promise)
    mocks.pages.set(key("intents"), ok(page([blocked("same")])))
    const other = "persons_other" as Id<"persons">
    mocks.pages.set(key("intents", null, TEST_NETWORK_ID, other), ok(page([blocked("same")])))
    mocks.pages.set(key("legacy", null, TEST_NETWORK_ID, other), ok(page([])))
    const view = render(<Fixture />)
    beginConfirmation()
    fireEvent.click(confirmButton())
    view.rerender(<Fixture personId={other} />)
    await act(async () => {
      if (result === "success") pending.resolve()
      else pending.reject(new Error("PRIVATE_OLD_FAILURE"))
      try { await pending.promise } catch { /* L'ancienne surface traite le rejet. */ }
    })
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByRole("button", { name: t("peoplePanel.blocks.unblock") })).not.toBeDisabled()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
