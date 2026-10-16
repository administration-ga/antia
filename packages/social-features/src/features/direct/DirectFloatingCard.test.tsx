// @vitest-environment jsdom
// Dupliqué de socle/packages/agent-features/src/features/direct/direct-floating.test.ts @ ad2e7fdc2 — adaptations : présentation sans salle/audio supplémentaires et gestes explicites du moteur.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noDirectPermissions } from "@antia/social-domain/live/permissions"
import { createAppI18n } from "../../i18n"
import { directSessionStore } from "../../stores/direct-session-store"
import type { DirectSession } from "./DirectPage"
import { DirectFloatingCard } from "./DirectFloatingCard"

const mocks = vi.hoisted(() => ({ mobile: false as boolean | null, room: null as unknown, leave: vi.fn(), mutation: vi.fn() }))
vi.mock("@antia/api/network", () => ({ useNetwork: () => ({ networkId: "network-a", charte: "antia", storagePrefix: "antia:a:" }), useRoutes: () => ({ conference: (id: string) => `/room/${id}` }) }))
vi.mock("@antia/api/routing", () => ({ Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock("@antia/ui/overlay", () => ({ useIsReseauMobile: () => mocks.mobile }))
vi.mock("../../stores/direct-room-registry", () => ({ useDirectRoom: () => mocks.room }))
vi.mock("@antia/ui/espace-kit", () => ({ EspaceDialog: ({ children, title }: { children: ReactNode; title: string }) => <div role="dialog" aria-label={title}>{children}</div> }))
vi.mock("convex/react", () => ({ useMutation: () => mocks.mutation }))
const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "direct" })
const session = { sessionId: "session-a", title: "Recette", status: "live", viewerRole: "host", permissions: noDirectPermissions(), speakers: [], spotlight: null } as unknown as DirectSession
const tree = (value = session) => <I18nextProvider i18n={i18n}><DirectFloatingCard session={value} onLeave={mocks.leave} /></I18nextProvider>
beforeEach(() => { vi.clearAllMocks(); mocks.mobile = false; directSessionStore.__resetForTests(); directSessionStore.prepare("session-a" as never); directSessionStore.setCredentials({ sessionId: "session-a" as never, token: "fictitious", wsUrl: "wss://test.invalid", role: "speaker" }); directSessionStore.setPhase("connected") })
afterEach(() => { cleanup(); directSessionStore.__resetForTests() })
describe("carte flottante F3c", () => {
  it("réduit la présentation sans quitter ni remplacer les credentials", () => {
    const credentials = directSessionStore.getState().credentials
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Réduire" }))
    expect(screen.getByRole("button", { name: "Déplier" })).toBeTruthy()
    expect(directSessionStore.getState().credentials).toBe(credentials)
    expect(mocks.leave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Déplier" }))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(directSessionStore.getState().cardMinimized).toBe(true)
  })
  it("bascule la caméra sur sa valeur effective et protège la sortie de l'hôte", () => {
    directSessionStore.setIntent({ audioOnly: true, cameraEnabled: true })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Allumer la caméra" }))
    expect(directSessionStore.getState().intent).toMatchObject({ audioOnly: false, cameraEnabled: true })
    fireEvent.click(screen.getByRole("button", { name: "Quitter la salle" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(mocks.leave).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Terminer pour tous" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans terminer" }))
    expect(mocks.leave).toHaveBeenCalledTimes(1)
  })
  it("garde une bande mobile avec retour et sortie immédiate du spectateur", () => {
    mocks.mobile = true
    render(tree({ ...session, viewerRole: "viewer" }))
    expect(screen.getByRole("complementary")).toHaveAttribute("data-pose", "mobile")
    expect(screen.queryByRole("button", { name: "Allumer la caméra" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Quitter la salle" }))
    expect(mocks.leave).toHaveBeenCalledTimes(1)
  })
})


it("ne quitte pas une nouvelle salle après la réponse tardive de fin", async () => {
  let resolve!: (value: unknown) => void
  mocks.mutation.mockReturnValue(new Promise((answer) => { resolve = answer }))
  const view = render(tree({ ...session, permissions: { ...noDirectPermissions(), endOrTransfer: true } }))
  fireEvent.click(screen.getByRole("button", { name: "Quitter la salle" }))
  fireEvent.click(screen.getByRole("button", { name: "Terminer pour tous" }))
  view.unmount()
  directSessionStore.prepare("session-next" as never)
  await act(async () => resolve({ ended: true }))
  expect(mocks.leave).not.toHaveBeenCalled()
  expect(directSessionStore.getState().sessionId).toBe("session-next")
})
