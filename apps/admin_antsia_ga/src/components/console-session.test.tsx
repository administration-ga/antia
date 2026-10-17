// @vitest-environment jsdom
import { api } from "@antsia/api/engine"
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  operator: undefined as unknown,
  failure: null as unknown,
  record: vi.fn(),
  dashboard: vi.fn(),
  queries: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock("@/components/providers", () => ({ CONVEX_URL: "configured" }))
vi.mock("@/lib/sign-out", () => ({ signOutAndRedirect: mocks.signOut }))
vi.mock("./console-operations", () => ({ OperationsPanel: () => null }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: (reference: unknown) => {
    mocks.queries(reference)
    if (mocks.failure) throw mocks.failure
    return mocks.operator
  },
  useMutation: () => mocks.record,
}))
vi.mock("./console-dashboard", async (importOriginal) => {
  const original = await importOriginal<typeof import("./console-dashboard")>()
  return { ...original, ConsoleDashboard: (props: unknown) => { mocks.dashboard(props); return <div>admitted-tools</div> } }
})

import { ConsoleSession } from "./console-session"

function mount(strict = false) {
  const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "admin" })
  const element = <I18nextProvider i18n={i18n}><ConsoleSession /></I18nextProvider>
  return render(strict ? <StrictMode>{element}</StrictMode> : element)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: false, isLoading: false }
  mocks.operator = undefined
  mocks.failure = null
  mocks.record.mockResolvedValue(null)
  mocks.signOut.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("console PA7 — admission avant montage des données outils", () => {
  it("un anonyme n'interroge aucune donnée et peut ouvrir IDN", () => {
    mount()
    expect(screen.getByRole("link", { name: "Me connecter" }).getAttribute("href")).toBe("/entrer")
    expect(mocks.queries).not.toHaveBeenCalled()
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
  })
  it("la session en cours de contrôle annonce l'attente sans appeler myOperator", () => {
    mocks.auth.isLoading = true
    mount()
    expect(screen.getByRole("status").textContent).toContain("Vérification de la session")
    expect(mocks.queries).not.toHaveBeenCalled()
  })
  it("une connexion vivante attend l'habilitation, avec sortie accessible", () => {
    mocks.auth.isAuthenticated = true
    mount()
    expect(mocks.queries).toHaveBeenCalledWith(api.modules.platform.operatorAccess.myOperator)
    expect(screen.getByRole("button", { name: "Me déconnecter partout" })).toBeDefined()
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
  })
  it("le refus IDN/autorité n'expose aucun outil ; sortie et nouvelle connexion restent possibles", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.auth.isAuthenticated = true
    mocks.failure = { data: { code: "operatorRequired" } }
    mount()
    expect(screen.getByRole("alert").textContent).toContain("n’est pas autorisé")
    expect(screen.getByRole("link", { name: "Me connecter" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Me déconnecter partout" })).toBeDefined()
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
  it("une panne de vérification reste distincte du refus et peut être retentée", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.auth.isAuthenticated = true
    mocks.failure = new Error("transport unavailable")
    mount()
    expect(screen.getByRole("alert").textContent).toContain("ne peut pas être vérifiée")
    expect(screen.queryByText(/n’est pas autorisé/)).toBeNull()
    mocks.failure = null
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(screen.getByRole("status").textContent).toContain("Vérification")
    expect(mocks.dashboard).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
  it("aucun outil ne monte avant l'enregistrement de l'accès ; StrictMode n'envoie qu'une fois", async () => {
    mocks.auth.isAuthenticated = true
    mocks.operator = { personId: "person-one", displayName: "Opérateur", role: "platform_operator" }
    let resolve: (value: null) => void = () => undefined
    mocks.record.mockImplementation(() => new Promise<null>((done) => { resolve = done }))
    mount(true)
    expect(screen.getByRole("status").textContent).toContain("Enregistrement")
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.record).toHaveBeenCalledTimes(1)
    await act(async () => resolve(null))
    expect(screen.getByText("admitted-tools")).toBeDefined()
  })
  it("un refus au journal d'accès empêche les outils ; une panne du journal permet la reprise", async () => {
    mocks.auth.isAuthenticated = true
    mocks.operator = { personId: "person-one", displayName: null, role: "platform_admin" }
    mocks.record.mockRejectedValueOnce(new Error("network"))
    mount()
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("ne peut pas être vérifiée"))
    expect(mocks.dashboard).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await screen.findByText("admitted-tools")
    expect(mocks.record).toHaveBeenCalledTimes(2)
  })
  it("une nouvelle session de la même personne doit journaliser son propre accès", async () => {
    mocks.auth.isAuthenticated = true
    mocks.operator = { admissionId: "proof-one", personId: "person-one", displayName: null, role: "platform_admin" }
    const view = mount()
    await screen.findByText("admitted-tools")
    let resolve: (value: null) => void = () => undefined
    mocks.record.mockImplementationOnce(() => new Promise<null>((done) => { resolve = done }))
    mocks.operator = { admissionId: "proof-two", personId: "person-one", displayName: null, role: "platform_admin" }
    const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "admin" })
    view.rerender(<I18nextProvider i18n={i18n}><ConsoleSession /></I18nextProvider>)
    expect(screen.queryByText("admitted-tools")).toBeNull()
    expect(screen.getByRole("status").textContent).toContain("Enregistrement")
    expect(mocks.record).toHaveBeenCalledTimes(2)
    await act(async () => resolve(null))
    expect(screen.getByText("admitted-tools")).toBeDefined()
  })
  it("la sortie est accessible sur un refus même sans donnée personnelle", async () => {
    mocks.auth.isAuthenticated = true
    mount()
    await userEvent.click(screen.getByRole("button", { name: "Me déconnecter partout" }))
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })
})
