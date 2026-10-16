// @vitest-environment jsdom
import type { Id } from "@antsia/api/engine"
import { NetworkProvider, useNetwork } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { useEffect, useMemo } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import type { FollowRow, FollowsPage } from "./follows-pagination"

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
  counts: new Map<string, QueryMock>(),
  active: new Set<string>(),
  query: vi.fn(),
  mutationRefs: vi.fn(),
  unfollow: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

const FOLLOW_QUERY = "modules/graph/follows:paginateMyFollows"
const COUNT_QUERY = "modules/graph/follows:myFollowerCount"
const UNFOLLOW_MUTATION = "modules/graph/follows:unfollow"

function key(cursor: string | null, networkId: string = TEST_NETWORK_ID, personId: string = TEST_PERSON_ID) {
  return JSON.stringify([networkId, personId, cursor])
}

function ok(data: unknown): QueryMock {
  return { data, isPending: false, isFetching: false, isError: false, fetchStatus: "idle", refetch: vi.fn().mockResolvedValue(undefined) }
}

function person(handle: string, displayName = handle): FollowRow {
  return { targetPersonId: `persons_${handle}` as Id<"persons">, displayName, handle, headline: null, avatarUrl: null, badges: [], since: 1 }
}

function page(rows: FollowRow[], cursor: string | null = null): FollowsPage {
  return { page: rows, isDone: cursor === null, continueCursor: cursor ?? "" }
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: never, args: { networkId: string; paginationOpts?: { cursor: string | null; numItems: number } }) => {
    const { personId } = useNetwork()
    const name = getFunctionName(ref)
    const cursor = args.paginationOpts?.cursor ?? null
    const queryKey = key(cursor, args.networkId, personId)
    mocks.query(name, args)
    useEffect(() => {
      if (name !== FOLLOW_QUERY) return
      mocks.active.add(queryKey)
      return () => { mocks.active.delete(queryKey) }
    }, [name, queryKey])
    if (name === COUNT_QUERY) {
      if (!mocks.counts.has(queryKey)) mocks.counts.set(queryKey, ok(3))
      return mocks.counts.get(queryKey)!
    }
    if (name !== FOLLOW_QUERY) throw new Error(`Unexpected query: ${name}`)
    if (!mocks.pending.has(queryKey)) mocks.pending.set(queryKey, { ...ok(undefined), isPending: true, isFetching: true, fetchStatus: "fetching" })
    return mocks.pages.get(queryKey) ?? mocks.pending.get(queryKey)!
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: never) => {
    mocks.mutationRefs(getFunctionName(ref))
    return mocks.unfollow
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

import { FollowsSection, type FollowsSectionProps } from "./PeoplePanel"

interface FixtureProps extends FollowsSectionProps {
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
          <FollowsSection {...props} />
        </NetworkProvider>
      </RouterProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  mocks.pages.clear()
  mocks.pending.clear()
  mocks.counts.clear()
  mocks.active.clear()
  mocks.query.mockClear()
  mocks.mutationRefs.mockClear()
  mocks.unfollow.mockReset().mockResolvedValue(undefined)
  mocks.success.mockClear()
  mocks.error.mockClear()
})
afterEach(cleanup)

describe("FollowsSection — surface autonome", () => {
  it.each([
    { locale: "fr" as const, heading: "Personnes suivies", action: "Ne plus suivre", count: "3 personnes suivent vos publications." },
    { locale: "en" as const, heading: "People you follow", action: "Unfollow", count: "3 people follow your posts." },
  ])("rend la carte et ses seuls contrats autorisés en $locale", ({ locale, heading, action, count }) => {
    mocks.pages.set(key(null), ok(page([person("awa", "Awa fictive")])))
    render(<Fixture locale={locale} />)
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy()
    expect(screen.getByRole("button", { name: action })).toBeTruthy()
    expect(screen.getByText(count)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Awa fictive" }).getAttribute("href")).toBe(TEST_ROUTES.profile("awa"))
    expect(new Set(mocks.query.mock.calls.map(([name]) => name))).toEqual(new Set([FOLLOW_QUERY, COUNT_QUERY]))
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([UNFOLLOW_MUTATION]))
    for (const [name, args] of mocks.query.mock.calls) {
      expect(args.networkId).toBe(TEST_NETWORK_ID)
      if (name === FOLLOW_QUERY) expect(args.paginationOpts).toEqual({ numItems: 12, cursor: null })
    }
    // React 19 peut hisser la feuille et réécrire son attribut href. Ce sont
    // bien les règles de la carte autonome qui doivent exister dans le DOM.
    const stylesheet = [...document.querySelectorAll("style")].find((style) => style.textContent?.includes("container-name: rp-people;"))
    expect(stylesheet?.textContent).toContain(".rp-person-tiles")
    expect(stylesheet?.textContent).toContain(".rp-person-action:focus-visible")
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("conserve un profil non publié neutre, sans lien ni identité inventée", () => {
    mocks.pages.set(key(null), ok(page([{ ...person("private"), displayName: null, handle: null }])))
    render(<Fixture />)
    expect(screen.getByText("Personne du réseau")).toBeTruthy()
    expect(screen.getByText("Profil non publié")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).toBeTruthy()
  })

  it("garde la sortie vide par défaut du volet existant", () => {
    mocks.pages.set(key(null), ok(page([])))
    render(<Fixture />)
    expect(screen.getByText(/Vous ne suivez personne/)).toBeTruthy()
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute("href")).toContain("vue=suggestions")
  })

  it("remplace seulement le lien de l'état vide par la découverte fournie", () => {
    mocks.pages.set(key(null), ok(page([])))
    render(<Fixture discover={{ href: "/membres?pays=FR", label: "Rencontrer des membres" }} />)
    expect(screen.getByText(/Vous ne suivez personne/)).toBeTruthy()
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Rencontrer des membres" }).getAttribute("href")).toBe("/membres?pays=FR")
  })
})

describe("FollowsSection — pages réactives", () => {
  it("garde les deux pages abonnées et actualise une personne de la première", () => {
    mocks.pages.set(key(null), ok(page([person("awa", "Ancien nom")], "second")))
    mocks.pages.set(key("second"), ok(page([person("ben", "Ben fictif")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(mocks.active).toEqual(new Set([key(null), key("second")]))
    mocks.pages.set(key(null), ok(page([person("awa", "Nom actualisé")], "second")))
    view.rerender(<Fixture />)
    expect(screen.queryByText("Ancien nom")).toBeNull()
    expect(screen.getByText("Nom actualisé")).toBeTruthy()
    expect(screen.getByText("Ben fictif")).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("dédoublonne la personne avec les informations de la page amont", () => {
    mocks.pages.set(key(null), ok(page([person("awa", "Nom récent")], "second")))
    mocks.pages.set(key("second"), ok(page([person("awa", "Nom périmé"), person("ben")])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("Nom récent")).toBeTruthy()
    expect(screen.queryByText("Nom périmé")).toBeNull()
  })

  it("déplace la frontière et retire les descendants abandonnés", () => {
    mocks.pages.set(key(null), ok(page([person("awa")], "old")))
    mocks.pages.set(key("old"), ok(page([person("abandoned")], "third")))
    mocks.pages.set(key("third"), ok(page([person("deep")])))
    mocks.pages.set(key("replacement"), ok(page([person("new")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(screen.getByText("deep")).toBeTruthy()
    mocks.pages.set(key(null), ok(page([person("awa")], "replacement")))
    view.rerender(<Fixture />)
    expect(screen.queryByText("abandoned")).toBeNull()
    expect(screen.queryByText("deep")).toBeNull()
    expect(screen.getByText("new")).toBeTruthy()
    expect(mocks.active).toEqual(new Set([key(null), key("replacement")]))
  })

  it("une première page vide non terminale offre Voir plus sans faux état vide", () => {
    mocks.pages.set(key(null), ok(page([], "second")))
    mocks.pages.set(key("second"), ok(page([person("awa")])))
    render(<Fixture />)
    expect(screen.queryByText(/Vous ne suivez personne/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(screen.getByText("awa")).toBeTruthy()
  })

  it("une page intermédiaire vide non terminale reste continuable", () => {
    mocks.pages.set(key(null), ok(page([person("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([], "third")))
    mocks.pages.set(key("third"), ok(page([person("ben")])))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(screen.getByText("ben")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Voir plus de personnes suivies" })).toBeNull()
  })

  it("ne boucle pas si le serveur répète son curseur", () => {
    mocks.pages.set(key(null), ok(page([], "second")))
    mocks.pages.set(key("second"), ok(page([], "second")))
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    expect(mocks.active).toEqual(new Set([key(null), key("second")]))
    expect(screen.queryByRole("button", { name: "Voir plus de personnes suivies" })).toBeNull()
  })

  it("annonce le chargement suivant et bloque les doubles ajouts", () => {
    mocks.pages.set(key(null), ok(page([person("awa")], "second")))
    const { container } = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    const loading = screen.getByRole("button", { name: "Chargement…" })
    expect(loading).toBeDisabled()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByText("1+")).toBeTruthy()
    expect(mocks.active.size).toBe(2)
  })

  it("une panne initiale propose Réessayer sans afficher le vide", () => {
    const error = { ...ok(undefined), isError: true }
    mocks.pages.set(key(null), error)
    render(<Fixture />)
    expect(screen.getByRole("alert").textContent).toContain("Personnes suivies indisponibles")
    expect(screen.queryByText(/Vous ne suivez personne/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(error.refetch).toHaveBeenCalledTimes(1)
  })

  it("une panne après données garde les pages valides et permet une reprise", async () => {
    mocks.pages.set(key(null), ok(page([person("awa")], "second")))
    mocks.pages.set(key("second"), ok(page([person("ben")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    const error = { ...ok(undefined), isError: true, refetch: vi.fn().mockRejectedValue(new Error("private trace")) }
    mocks.pages.set(key("second"), error)
    view.rerender(<Fixture />)
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByText("ben")).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Réessayer" })) })
    expect(error.refetch).toHaveBeenCalledTimes(1)
    expect(mocks.pages.get(key(null))!.refetch).toHaveBeenCalledTimes(1)
    mocks.pages.set(key("second"), ok(page([person("recovered")])))
    view.rerender(<Fixture />)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText("ben")).toBeNull()
    expect(screen.getByText("recovered")).toBeTruthy()
  })
})

describe("FollowsSection — désabonnement et contexte", () => {
  it("verrouille immédiatement la ligne, la garde jusqu'au succès puis la retire", async () => {
    const pending = deferred()
    mocks.unfollow.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([person("awa")])))
    render(<Fixture />)
    const button = screen.getByRole("button", { name: "Ne plus suivre" })
    act(() => { button.click(); button.click() })
    expect(mocks.unfollow).toHaveBeenCalledTimes(1)
    expect(mocks.unfollow).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, targetPersonId: "persons_awa" })
    expect(button).toBeDisabled()
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(screen.getByText("awa")).toBeTruthy()
    await act(async () => { pending.resolve(); await pending.promise })
    expect(screen.queryByText("awa")).toBeNull()
    expect(mocks.success).toHaveBeenCalledWith("Suivi retiré.")
  })

  it("ne verrouille pas les autres lignes pendant un désabonnement", async () => {
    const pending = deferred()
    mocks.unfollow.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([person("awa"), person("ben")])))
    render(<Fixture />)
    const rows = screen.getAllByRole("listitem")
    fireEvent.click(within(rows[0]!).getByRole("button", { name: "Ne plus suivre" }))
    expect(within(rows[1]!).getByRole("button", { name: "Ne plus suivre" })).not.toBeDisabled()
    await act(async () => { pending.resolve(); await pending.promise })
  })

  it("traduit le refus du moteur, conserve la personne et permet de réessayer", async () => {
    mocks.unfollow.mockRejectedValueOnce(new ConvexError({ code: "notFound", message: "private engine trace" }))
    mocks.pages.set(key(null), ok(page([person("awa")])))
    render(<Fixture />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" })) })
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(mocks.error.mock.calls[0]![0]).not.toContain("private engine trace")
    expect(mocks.error).toHaveBeenCalledWith("Cette ressource est introuvable ou n'est pas accessible.")
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).not.toBeDisabled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" })) })
    expect(mocks.unfollow).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("awa")).toBeNull()
  })

  it("un rejet inattendu reste générique et réactive le bouton", async () => {
    mocks.unfollow.mockRejectedValueOnce(new Error("private trace"))
    mocks.pages.set(key(null), ok(page([person("awa")])))
    render(<Fixture />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" })) })
    expect(mocks.error).toHaveBeenCalledWith("Le retrait n'a pas pu être enregistré.")
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).not.toBeDisabled()
  })

  it.each(["network", "person"] as const)("réinitialise immédiatement pages et curseurs au changement de %s", (changed) => {
    mocks.pages.set(key(null), ok(page([person("old")], "second")))
    mocks.pages.set(key("second"), ok(page([person("old-deep")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de personnes suivies" }))
    const networkId = changed === "network" ? "networks_other" as Id<"networks"> : TEST_NETWORK_ID
    const personId = changed === "person" ? "persons_other" as Id<"persons"> : TEST_PERSON_ID
    view.rerender(<Fixture networkId={networkId} personId={personId} />)
    expect(screen.queryByText("old")).toBeNull()
    expect(screen.queryByText("old-deep")).toBeNull()
    expect(screen.getByText("Chargement…")).toBeTruthy()
    expect(mocks.active).toEqual(new Set([key(null, networkId, personId)]))
  })

  it.each(["success", "error"] as const)("ignore la résolution %s d'une mutation de l'ancien lecteur", async (result) => {
    const pending = deferred()
    mocks.unfollow.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok(page([person("awa")])))
    const other = "persons_other" as Id<"persons">
    mocks.pages.set(key(null, TEST_NETWORK_ID, other), ok(page([person("awa")])))
    const view = render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" }))
    view.rerender(<Fixture personId={other} />)
    await act(async () => {
      if (result === "success") pending.resolve()
      else pending.reject(new Error("old private trace"))
      try { await pending.promise } catch { /* Refus observé par la carte démontée. */ }
    })
    expect(screen.getByText("awa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).not.toBeDisabled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
