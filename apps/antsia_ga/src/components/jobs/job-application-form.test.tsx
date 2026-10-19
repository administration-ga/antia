// @vitest-environment jsdom
/**
 * P18b (A19) — aucun formulaire imbriqué : le dépôt d'une pièce n'envoie ni ne
 * valide la candidature ; l'accord et le bouton d'envoi, placés après le
 * gestionnaire de pièces, restent rattachés au formulaire de candidature.
 */
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  generateUploadUrl: vi.fn(),
  registerFile: vi.fn(),
  retireFile: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      shops: {
        jobApplications: { apply: "apply" },
        jobFiles: { myFiles: "myFiles", generateUploadUrl: "generateUploadUrl", registerFile: "registerFile", retireFile: "retireFile" },
      },
    },
  },
}))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: () => ({ data: [], isPending: false, isFetching: false, isError: false, error: null, refetch: vi.fn() }),
}))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: (reference: "apply" | "generateUploadUrl" | "registerFile" | "retireFile") => mocks[reference],
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// La coque membre, importée par `shop-ui` mais jamais rendue par ce formulaire, lit au chargement
// des références du moteur absentes de la maquette partielle ci-dessus (`api.modules.graph…`).
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

import { appResources } from "@/i18n/resources"
import { JobApplicationForm } from "./job-application-form"
import type { JobDto } from "./job-model"

const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "jobs" })
const JOB = { shopHandle: "atelier", jobRef: "job-1" } as JobDto

let root: Root
let container: HTMLDivElement

async function render() {
  await act(async () => root.render(<I18nextProvider i18n={i18n}><JobApplicationForm job={JOB} /></I18nextProvider>))
}

/** Saisie d'un champ non contrôlé (React Hook Form), par le setter natif. */
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

async function fillValidApplication() {
  const [last, first] = [...container.querySelectorAll<HTMLInputElement>("input[autocomplete='family-name'], input[autocomplete='given-name']")]
  await type(last!, "NDONG")
  await type(first!, "Awa")
  await act(async () => container.querySelector<HTMLInputElement>("input[type='checkbox'][form]")!.click())
}

async function chooseAndUploadPdf() {
  const input = container.querySelector<HTMLInputElement>("input[type='file']")!
  const file = new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" })
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] })
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  const uploadForm = input.closest("form")!
  await act(async () => {
    uploadForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  })
  // Laisse aboutir la chaîne asynchrone du dépôt (adresse, envoi, enregistrement).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.apply.mockResolvedValue({ applicationId: "application-1" })
  mocks.generateUploadUrl.mockResolvedValue("https://depot.test/televersement")
  mocks.registerFile.mockResolvedValue({ fileId: "file-1" })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ storageId: "storage-1" }) }))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe("candidature et dépôt de pièce (P18b, A19)", () => {
  it("rend deux formulaires distincts, jamais l'un dans l'autre", async () => {
    await render()
    expect(container.querySelectorAll("form")).toHaveLength(2)
    expect(container.querySelector("form form")).toBeNull()
  })

  it("un dépôt de pièce n'appelle pas apply, même quand la candidature est valide", async () => {
    await render()
    await fillValidApplication()
    await chooseAndUploadPdf()

    expect(mocks.generateUploadUrl).toHaveBeenCalledOnce()
    expect(mocks.registerFile).toHaveBeenCalledOnce()
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("un dépôt de pièce ne déclenche pas la validation de la candidature", async () => {
    await render()
    await chooseAndUploadPdf()

    expect(mocks.apply).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(i18n.t("apply.nameRequired"))
    expect(container.textContent).not.toContain(i18n.t("apply.consentRequired"))
  })

  it("l'accord et le bouton d'envoi, hors du <form>, restent rattachés à la candidature et l'envoient", async () => {
    await render()
    const applicationForm = container.querySelectorAll("form")[0]!
    const submit = container.querySelector<HTMLButtonElement>("button[type='submit'][form]")!
    expect(submit.form).toBe(applicationForm)
    expect(container.querySelector<HTMLInputElement>("input[type='checkbox'][form]")!.form).toBe(applicationForm)

    await fillValidApplication()
    await act(async () => submit.click())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mocks.apply).toHaveBeenCalledOnce()
    expect(mocks.apply.mock.calls[0]![0]).toMatchObject({ networkId: "network", handle: "atelier", jobRef: "job-1", firstName: "Awa", lastName: "NDONG", consent: true })
    expect(mocks.generateUploadUrl).not.toHaveBeenCalled()
  })
})
