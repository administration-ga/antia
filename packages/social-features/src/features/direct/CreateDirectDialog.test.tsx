// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { CreateDirectDialog } from "./CreateDirectDialog"

const mocks = vi.hoisted(() => ({ create: vi.fn(), push: vi.fn(), close: vi.fn() }))
vi.mock("@antia/api/network", () => ({
  useNetwork: () => ({ networkId: "network-test", charte: "antia" }),
  useRoutes: () => ({ conference: (id: string) => `/conference/${id}` }),
}))
vi.mock("@antia/api/routing", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("convex/react", () => ({ useMutation: () => mocks.create }))
vi.mock("@antia/ui/espace-kit", () => ({ EspaceDialog: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div> }))
const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "direct" })
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ sessionId: "session-test", created: true }) })
afterEach(cleanup)

describe("création d'un direct — confidentialité et rejeu", () => {
  it("ne coche ni enregistrement ni annonce et garde les relations par défaut", async () => {
    render(<I18nextProvider i18n={i18n}><CreateDirectDialog onClose={mocks.close} /></I18nextProvider>)
    expect(screen.getByRole("checkbox", { name: "Enregistrer cette conférence" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Publier une annonce dans le fil" })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Conférence locale" } })
    fireEvent.click(screen.getByRole("button", { name: "Préparer la conférence" }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ networkId: "network-test", audience: "connections", replay: false, announce: false }))
    expect(mocks.push).toHaveBeenCalledWith("/conference/session-test")
  })

  it("conserve le fil source et ses invités sans jamais annoncer une audience nominative", async () => {
    render(<I18nextProvider i18n={i18n}><CreateDirectDialog onClose={mocks.close} prefill={{ title: "Discussion", userIds: ["person-test", "person-test"], sourceThreadId: "group-test" }} /></I18nextProvider>)
    expect(screen.queryByRole("checkbox", { name: "Publier une annonce dans le fil" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Préparer la conférence" }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      audience: "invitees", announce: false, sourceThreadId: "group-test",
      invitees: [{ personId: "person-test", stageRole: "speaker" }],
    }))
  })

  it("réutilise la clé du brouillon après un échec de réseau sans rejouer le démarrage", async () => {
    mocks.create.mockRejectedValueOnce(new Error("transport"))
    render(<I18nextProvider i18n={i18n}><CreateDirectDialog onClose={mocks.close} /></I18nextProvider>)
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Conférence locale" } })
    fireEvent.click(screen.getByRole("button", { name: "Préparer la conférence" }))
    await screen.findByRole("alert")
    expect(mocks.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Préparer la conférence" }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.create.mock.calls[0]?.[0].idempotencyKey).toBe(mocks.create.mock.calls[1]?.[0].idempotencyKey)
  })
})
