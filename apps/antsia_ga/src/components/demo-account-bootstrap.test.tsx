// @vitest-environment jsdom
// Automate d'accueil des comptes de démonstration : l'accueil réel rejoué, puis l'équipement de l'acteur.
import { createAppI18n } from "@antsia/social-features/i18n"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { status: "loading" } as Record<string, unknown>,
  calls: [] as { name: string; args: unknown }[],
  failOn: null as string | null,
  success: vi.fn(),
  failure: vi.fn(),
}))

vi.mock("@convex/_generated/api", () => ({
  api: { modules: {
    people: { consents: { recordConsent: "recordConsent" }, preferences: { setMyPreferences: "setMyPreferences" }, profile: { publishMyProfile: "publishMyProfile" } },
    platform: { demoAccounts: { equipMyDemoAccount: "equipMyDemoAccount" } },
  } },
}))
vi.mock("convex/react", () => ({
  useMutation: (name: string) => async (args: unknown) => {
    state.calls.push({ name, args })
    if (state.failOn === name) throw new Error("refusé")
    return null
  },
}))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.failure } }))
vi.mock("@/components/use-session-state", () => ({ useSessionState: () => state.session }))

import { appResources } from "@/i18n/resources"
import { pendingDemoAccount, rememberDemoAccount } from "@/lib/demo-accounts"
import { DemoAccountBootstrap } from "./demo-account-bootstrap"

const PRESSE = { actor: "presse", email: "presse@demo.antsia.test", profile: { handle: "presse.demo", displayName: "Sylvie OYANE", headline: "Journaliste" } } as const
const ROOT = { _id: "root", slug: "antsia" }

let root: Root | undefined
let container: HTMLDivElement

async function mount() {
  const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "antsia" })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<I18nextProvider i18n={i18n}><DemoAccountBootstrap /></I18nextProvider>))
  // L'automate est asynchrone : laisser ses appels se dérouler.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  state.calls = []
  state.failOn = null
  state.success.mockReset()
  state.failure.mockReset()
  window.sessionStorage.clear()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container?.remove()
  window.sessionStorage.clear()
})

describe("DemoAccountBootstrap", () => {
  it("sans compte de démonstration en attente, ne fait rien", async () => {
    state.session = { status: "welcome", person: { published: false, consentsInForce: [] }, root: ROOT }
    await mount()
    expect(state.calls).toEqual([])
  })

  it("rejoue l'accueil réel dans l'ordre, puis équipe l'acteur et oublie l'attente", async () => {
    rememberDemoAccount(PRESSE)
    state.session = { status: "welcome", person: { published: false, consentsInForce: [] }, root: ROOT }
    await mount()
    expect(state.calls).toEqual([
      { name: "recordConsent", args: { purpose: "social_profile", origin: "onboarding" } },
      { name: "setMyPreferences", args: { locale: "fr", timeZone: "Africa/Libreville" } },
      { name: "publishMyProfile", args: { handle: "presse.demo", displayName: "Sylvie OYANE", headline: "Journaliste" } },
      { name: "equipMyDemoAccount", args: { actor: "presse" } },
    ])
    expect(state.success).toHaveBeenCalledWith("Compte de démonstration prêt : Sylvie OYANE.")
    expect(pendingDemoAccount()).toBeNull()
  })

  it("un compte déjà accueilli n'est qu'équipé (rejouable)", async () => {
    rememberDemoAccount(PRESSE)
    state.session = { status: "member", person: { published: true, consentsInForce: ["social_profile"] }, root: ROOT }
    await mount()
    expect(state.calls).toEqual([{ name: "equipMyDemoAccount", args: { actor: "presse" } }])
  })

  it("le nouvel arrivant garde l'accueil à remplir : rien n'est appelé", async () => {
    rememberDemoAccount({ actor: "nouveau", email: "nouveau@demo.antsia.test", profile: null } as never)
    state.session = { status: "welcome", person: { published: false, consentsInForce: [] }, root: ROOT }
    await mount()
    expect(state.calls).toEqual([])
    expect(pendingDemoAccount()).toBeNull()
  })

  it("un refus du serveur est annoncé et l'attente oubliée", async () => {
    rememberDemoAccount(PRESSE)
    state.failOn = "equipMyDemoAccount"
    state.session = { status: "member", person: { published: true, consentsInForce: ["social_profile"] }, root: ROOT }
    await mount()
    expect(state.failure).toHaveBeenCalledWith("La connexion de démonstration n’a pas abouti. Réessayez dans quelques instants.")
    expect(pendingDemoAccount()).toBeNull()
  })

  it("attend la session : rien tant qu'elle se charge", async () => {
    rememberDemoAccount(PRESSE)
    state.session = { status: "loading" }
    await mount()
    expect(state.calls).toEqual([])
    expect(pendingDemoAccount()).toEqual(PRESSE)
  })
})
