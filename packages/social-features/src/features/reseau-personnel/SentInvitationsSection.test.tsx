// @vitest-environment jsdom
import type { api, Id } from "@antsia/api/engine"
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

type SentPage = FunctionReturnType<typeof api.modules.suggestions.suggestions.paginateSentInvitations>
type SentRow = SentPage["page"][number]
interface QueryMock {
  data: unknown
  isPending: boolean
  isFetching: boolean
  isError: boolean
  fetchStatus: "idle" | "fetching"
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  pages: new Map<string, QueryMock>(),
  pending: new Map<string, QueryMock>(),
  active: new Set<string>(),
  query: vi.fn(),
  mutationRefs: vi.fn(),
  cancel: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

const SENT_QUERY = "modules/suggestions/suggestions:paginateSentInvitations"
const CANCEL_MUTATION = "modules/graph/connections:cancelSentRequest"

function key(cursor: string | null, networkId: string = TEST_NETWORK_ID, personId: string = TEST_PERSON_ID) {
  return JSON.stringify([networkId, personId, cursor])
}
function ok(data: unknown): QueryMock {
  return { data, isPending: false, isFetching: false, isError: false, fetchStatus: "idle", refetch: vi.fn().mockResolvedValue(undefined) }
}
function request(handle: string, displayName = handle, at = 42): SentRow {
  return { connectionId: `connections_${handle}` as Id<"connections">, otherPersonId: `persons_${handle}` as Id<"persons">, displayName, handle, headline: null, avatarUrl: null, at }
}
function page(rows: SentRow[], cursor: string | null = null): SentPage {
  return { page: rows, isDone: cursor === null, continueCursor: cursor ?? "" }
}
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: never, args: { networkId: string; paginationOpts: { cursor: string | null; numItems: number } }) => {
    const { personId } = useNetwork()
    const name = getFunctionName(ref)
    mocks.query(name, args)
    if (name !== SENT_QUERY) throw new Error(`Unexpected query: ${name}`)
    const queryKey = key(args.paginationOpts.cursor, args.networkId, personId)
    useEffect(() => {
      mocks.active.add(queryKey)
      return () => { mocks.active.delete(queryKey) }
    }, [queryKey])
    if (!mocks.pending.has(queryKey)) mocks.pending.set(queryKey, { ...ok(undefined), isPending: true, isFetching: true, fetchStatus: "fetching" })
    return mocks.pages.get(queryKey) ?? mocks.pending.get(queryKey)!
  },
}))
vi.mock("convex/react", () => ({
  useMutation: (ref: never) => {
    mocks.mutationRefs(getFunctionName(ref))
    return mocks.cancel
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

import { SentInvitationsSection, type SentInvitationsSectionProps } from "./PeoplePanel"

interface FixtureProps extends SentInvitationsSectionProps {
  networkId?: Id<"networks">
  personId?: Id<"persons">
  locale?: "fr" | "en"
}
function Fixture({ networkId = TEST_NETWORK_ID, personId = TEST_PERSON_ID, locale = "fr", ...props }: FixtureProps) {
  const i18n = useMemo(() => createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "social" }), [locale])
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider implementation={memoryRouter().implementation}>
        <NetworkProvider networkId={networkId} personId={personId} slug="test" charte="antsia" routes={TEST_ROUTES}>
          <SentInvitationsSection {...props} />
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  mocks.pages.clear()
  mocks.pending.clear()
  mocks.active.clear()
  mocks.query.mockClear()
  mocks.mutationRefs.mockClear()
  mocks.cancel.mockReset().mockResolvedValue(null)
  mocks.success.mockClear()
  mocks.error.mockClear()
})
afterEach(cleanup)

describe("SentInvitationsSection — carte autonome", () => {
  it.each([
    { locale: "fr" as const, title: "Invitations envoyées", action: "Annuler la demande envoyée à Awa fictive", awaiting: "En attente de réponse." },
    { locale: "en" as const, title: "Invitations sent", action: "Cancel the request sent to Awa fictive", awaiting: "Awaiting a reply." },
  ])("rend la carte en $locale sans monter d'annuaire ni d'autre requête", ({ locale, title, action, awaiting }) => {
    mocks.pages.set(key(null), ok(page([request("awa", "Awa fictive")])))
    render(<Fixture locale={locale} />)
    expect(screen.getByRole("heading", { name: title })).toBeTruthy()
    expect(screen.getByRole("button", { name: action })).not.toBeDisabled()
    expect(screen.getByText(awaiting)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Awa fictive" }).getAttribute("href")).toBe(TEST_ROUTES.profile("awa"))
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(new Set(mocks.query.mock.calls.map(([name]) => name))).toEqual(new Set([SENT_QUERY]))
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([CANCEL_MUTATION]))
    for (const [, args] of mocks.query.mock.calls) expect(args).toEqual({ networkId: TEST_NETWORK_ID, paginationOpts: { numItems: 12, cursor: null } })
    const stylesheet = [...document.querySelectorAll("style")].find((style) => style.textContent?.includes("container-name: rp-people;"))
    expect(stylesheet?.textContent).toContain(".rp-person-tiles")
  })

  it("garde un profil retiré neutre et permet toujours d'annuler sa propre demande", async () => {
    mocks.pages.set(key(null), ok(page([{ ...request("private"), displayName: null, handle: null }])))
    render(<Fixture />)
    expect(screen.getByText("Personne du réseau")).toBeTruthy()
    expect(screen.getByText("Profil non publié")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à Personne du réseau" })) })
    expect(mocks.cancel).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, connectionId: "connections_private", expectedRequestedAt: 42 })
  })

  it("garde l'état vide existant sans inventer de sortie par défaut", () => {
    mocks.pages.set(key(null), ok(page([])))
    render(<Fixture />)
    expect(screen.getByText("Aucune demande en attente de réponse.")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("propose le lien de découverte explicitement fourni dans le même état vide", () => {
    mocks.pages.set(key(null), ok(page([])))
    render(<Fixture discover={{ href: "/membres?pays=FR", label: "Découvrir des membres" }} />)
    expect(screen.getByText("Aucune demande en attente de réponse.")).toBeTruthy()
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Découvrir des membres" }).getAttribute("href")).toBe("/membres?pays=FR")
  })
})

describe("SentInvitationsSection — pagination réactive", () => {
  it("garde les anciennes pages abonnées et retire une demande résolue sur la première", () => {
    mocks.pages.set(key(null), ok(page([request("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([request("ben")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(mocks.active).toEqual(new Set([key(null), key("second")]))
    mocks.pages.set(key(null), ok(page([], "second")))
    view.rerender(<Fixture />)
    expect(screen.queryByText("awa")).toBeNull()
    expect(screen.getByText("ben")).toBeTruthy()
  })

  it("dédoublonne les demandes et garde la version amont", () => {
    mocks.pages.set(key(null), ok(page([request("awa", "Version récente", 43)], "second")))
    mocks.pages.set(key("second"), ok(page([request("awa", "Version périmée", 42), request("ben")])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByText("Version périmée")).toBeNull()
    expect(screen.getByText("Version récente")).toBeTruthy()
  })

  it("abandonne les descendants quand une frontière change, même après trois pages", () => {
    mocks.pages.set(key(null), ok(page([request("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([request("old")], "third")))
    mocks.pages.set(key("third"), ok(page([request("deep")])))
    mocks.pages.set(key("replacement"), ok(page([request("new")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(screen.getByText("deep")).toBeTruthy()
    mocks.pages.set(key(null), ok(page([request("awa")], "replacement")))
    view.rerender(<Fixture />)
    expect(screen.queryByText("old")).toBeNull()
    expect(screen.queryByText("deep")).toBeNull()
    expect(screen.getByText("new")).toBeTruthy()
    expect(mocks.active).toEqual(new Set([key(null), key("replacement")]))
  })

  it("une page vide non terminale reste continuable sans annoncer le vide", () => {
    mocks.pages.set(key(null), ok(page([], "second")))
    mocks.pages.set(key("second"), ok(page([request("awa")])))
    render(<Fixture />)
    expect(screen.queryByText("Aucune demande en attente de réponse.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(screen.getByText("awa")).toBeTruthy()
  })

  it("continue aussi après une page intermédiaire vide", () => {
    mocks.pages.set(key(null), ok(page([request("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([], "third")))
    mocks.pages.set(key("third"), ok(page([request("ben")])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(screen.getByText("ben")).toBeTruthy()
  })

  it("ne boucle pas sur un curseur serveur répété", () => {
    mocks.pages.set(key(null), ok(page([], "second")))
    mocks.pages.set(key("second"), ok(page([], "second")))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(mocks.active).toEqual(new Set([key(null), key("second")]))
    expect(screen.queryByRole("button", { name: "Voir plus d'invitations envoyées" })).toBeNull()
  })

  it("annonce le chargement suivant et conserve les demandes déjà lisibles", () => {
    mocks.pages.set(key(null), ok(page([request("awa")], "second")))
    const { container } = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    expect(screen.getByRole("button", { name: "Chargement…" })).toBeDisabled()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByText("1+")).toBeTruthy()
  })

  it("une panne initiale n'est pas un état vide et offre Réessayer", () => {
    const error = { ...ok(undefined), isError: true }
    mocks.pages.set(key(null), error)
    render(<Fixture />)
    expect(screen.getByRole("alert").textContent).toContain("Invitations envoyées indisponibles")
    expect(screen.queryByText("Aucune demande en attente de réponse.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(error.refetch).toHaveBeenCalledTimes(1)
  })

  it("une panne aval garde les lignes valides et peut reprendre sans rejet non traité", async () => {
    mocks.pages.set(key(null), ok(page([request("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([request("ben")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    const error = { ...ok(undefined), isError: true, refetch: vi.fn().mockRejectedValue(new Error("private trace")) }
    mocks.pages.set(key("second"), error)
    view.rerender(<Fixture />)
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByText("ben")).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Réessayer" })) })
    expect(error.refetch).toHaveBeenCalledTimes(1)
    expect(mocks.pages.get(key(null))!.refetch).toHaveBeenCalledTimes(1)
    mocks.pages.set(key("second"), ok(page([request("recovered")])))
    view.rerender(<Fixture />)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText("ben")).toBeNull()
    expect(screen.getByText("recovered")).toBeTruthy()
  })
})

describe("SentInvitationsSection — annulation versionnée", () => {
  it("verrouille les doubles clics et retire la demande seulement après le succès", async () => {
    const pending = deferred()
    mocks.cancel.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([request("awa", "Awa", 123)])))
    render(<Fixture />)
    const button = screen.getByRole("button", { name: "Annuler la demande envoyée à Awa" })
    act(() => { button.click(); button.click() })
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(mocks.cancel).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, connectionId: "connections_awa", expectedRequestedAt: 123 })
    expect(button).toBeDisabled()
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(screen.getByText("Awa")).toBeTruthy()
    await act(async () => { pending.resolve(); await pending.promise })
    expect(screen.queryByText("Awa")).toBeNull()
    expect(mocks.success).toHaveBeenCalledWith("Demande annulée.")
  })

  it("la mutation d'une ligne ne verrouille pas toutes les autres demandes", async () => {
    const pending = deferred()
    mocks.cancel.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([request("awa"), request("ben")])))
    render(<Fixture />)
    const rows = screen.getAllByRole("listitem")
    fireEvent.click(within(rows[0]!).getByRole("button"))
    expect(within(rows[1]!).getByRole("button")).not.toBeDisabled()
    await act(async () => { pending.resolve(); await pending.promise })
  })

  it("un refus après acceptation reste indistinct, conserve la ligne et permet une nouvelle tentative", async () => {
    mocks.cancel.mockRejectedValueOnce(new ConvexError({ code: "notFound", message: "private accepted state" }))
    mocks.pages.set(key(null), ok(page([request("awa")])))
    render(<Fixture />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })) })
    expect(mocks.error).toHaveBeenCalledWith("Cette ressource est introuvable ou n'est pas accessible.")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })).not.toBeDisabled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })) })
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("awa")).toBeNull()
  })

  it("une exception imprévue donne le message générique et déverrouille la ligne", async () => {
    mocks.cancel.mockRejectedValueOnce(new Error("private trace"))
    mocks.pages.set(key(null), ok(page([request("awa")])))
    render(<Fixture />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })) })
    expect(mocks.error).toHaveBeenCalledWith("La demande n’a pas pu être annulée.")
    expect(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })).not.toBeDisabled()
  })

  it("une ancienne résolution ne retire pas la demande réémise sur la même ligne", async () => {
    const pending = deferred()
    mocks.cancel.mockReturnValueOnce(pending.promise)
    mocks.pages.set(key(null), ok(page([request("awa", "Awa", 42)])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à Awa" }))
    mocks.pages.set(key(null), ok(page([request("awa", "Awa", 43)])))
    view.rerender(<Fixture />)
    await act(async () => { pending.resolve(); await pending.promise })
    expect(screen.getByText("Awa")).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à Awa" })) })
    expect(mocks.cancel).toHaveBeenLastCalledWith({ networkId: TEST_NETWORK_ID, connectionId: "connections_awa", expectedRequestedAt: 43 })
  })

  it.each(["network", "person"] as const)("réinitialise les pages et curseurs après changement de %s", (changed) => {
    mocks.pages.set(key(null), ok(page([request("old")], "second")))
    mocks.pages.set(key("second"), ok(page([request("old-deep")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus d'invitations envoyées" }))
    const networkId = changed === "network" ? "networks_other" as Id<"networks"> : TEST_NETWORK_ID
    const personId = changed === "person" ? "persons_other" as Id<"persons"> : TEST_PERSON_ID
    view.rerender(<Fixture networkId={networkId} personId={personId} />)
    expect(screen.queryByText("old")).toBeNull()
    expect(screen.queryByText("old-deep")).toBeNull()
    expect(screen.getByText("Chargement…")).toBeTruthy()
    expect(mocks.active).toEqual(new Set([key(null, networkId, personId)]))
  })

  it.each(["success", "error"] as const)("ignore la résolution %s d'une annulation de l'ancien lecteur", async (result) => {
    const pending = deferred()
    mocks.cancel.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([request("awa")])))
    const other = "persons_other" as Id<"persons">
    mocks.pages.set(key(null, TEST_NETWORK_ID, other), ok(page([request("awa")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" }))
    view.rerender(<Fixture personId={other} />)
    await act(async () => {
      if (result === "success") pending.resolve()
      else pending.reject(new Error("old private trace"))
      try { await pending.promise } catch { /* Refus observé par la carte démontée. */ }
    })
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Annuler la demande envoyée à awa" })).not.toBeDisabled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
