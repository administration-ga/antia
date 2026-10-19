// @vitest-environment jsdom
/**
 * P14B — fiche d'UNE candidature, destination ciblée d'un avis de suivi. Tests ÉCRITS, NON
 * EXÉCUTÉS (décision du propriétaire du 18/10/2026 : « Continuer sans vérifier »).
 */
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ data: undefined as unknown, error: false, read: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { jobApplications: { myApplication: "myApplication" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-a", personId: "person-a" }) }))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: string, args: unknown) => {
    mocks.read(ref, args)
    return { data: mocks.data, isError: mocks.error, isPending: mocks.data === undefined && !mocks.error, isFetching: false, refetch: vi.fn() }
  },
}))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }) }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

import { MyApplicationScreen } from "./my-application-screen"

const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "jobs" })
const NOW = Date.UTC(2026, 9, 19, 9)
let root: Root, container: HTMLDivElement

function detail(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      applicationId: "candidature-1", jobRef: "pro.ga:job_opening:01JA00000000000000000000J1", jobTitle: "Comptable confirmé",
      shopHandle: "cabinet-demo", shopName: "Cabinet employeur", state: "submitted", candidateState: "interview", rejection: null,
      remoteUnconfirmed: false, submittedAt: NOW, remoteUpdatedAt: NOW + 60_000, createdAt: NOW, files: [],
      actions: { withdraw: true, retry: false, refresh: true }, ...overrides,
    },
    civilName: { firstName: "Jean-Rémy Éloïse", lastName: "NDONG MBA" }, motivation: "Motivation privée", consentTextVersion: "2026-10-18-p15-v1", consentedAt: NOW,
  }
}

async function render(children: ReactNode = <MyApplicationScreen applicationId="candidature-1" />) {
  await act(async () => root.render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>))
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.data = undefined; mocks.error = false; mocks.read.mockClear()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe("fiche d'une candidature (ouverture ciblée)", () => {
  it("relit SA candidature par le serveur et montre l'état autorisé, jamais un motif ni ses données transmises", async () => {
    mocks.data = detail()
    await render()
    expect(mocks.read).toHaveBeenCalledWith("myApplication", { networkId: "network-a", applicationId: "candidature-1" })
    expect(container.textContent).toContain("Comptable confirmé")
    expect(container.textContent).toContain(i18n.t("applications.candidateState.interview"))
    expect(container.textContent).not.toContain("NDONG")
    expect(container.textContent).not.toContain("Motivation privée")
    const links = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    expect(links).toContain(routes.myApplications())
    expect(links).toContain(routes.shopJob("cabinet-demo", "pro.ga:job_opening:01JA00000000000000000000J1"))
  })

  it("candidature d'autrui, retirée de la session ou inconnue : le même repli neutre, sans détail", async () => {
    mocks.data = null
    await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.t("applications.detailUnavailable"))
    expect(container.textContent).not.toContain("Comptable")
  })

  it("une erreur de lecture propose seulement de réessayer", async () => {
    mocks.error = true
    await render()
    expect(container.textContent).toContain(i18n.t("applications.detailUnavailable"))
    expect(container.querySelector("button")?.textContent).toBe(i18n.t("directory.retry"))
  })

  it("une candidature retirée dit « Retirée », sans réouvrir aucun geste ici", async () => {
    mocks.data = detail({ state: "withdrawn", candidateState: "withdrawn", actions: { withdraw: false, retry: false, refresh: false } })
    await render()
    expect(container.textContent).toContain(i18n.t("applications.state.withdrawn"))
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })
})
