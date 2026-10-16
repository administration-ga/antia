import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "@antsia/social-features/i18n"
import { appResources } from "@/i18n/resources"

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: false, isLoading: false }, person: null as unknown }))
vi.mock("@/components/providers", () => ({ CONVEX_URL: "configured" }))
vi.mock("@/lib/auth-client", () => ({ authClient: {} }))
vi.mock("convex/react", () => ({ useConvexAuth: () => mocks.auth, useQuery: () => mocks.person }))

import { ConsoleSession } from "./console-session"

function markup() {
  const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "admin" })
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}><ConsoleSession /></I18nextProvider>)
}

beforeEach(() => { mocks.auth = { isAuthenticated: false, isLoading: false }; mocks.person = null })

describe("console PA4 — session sans attribution d'autorité", () => {
  it("un anonyme peut ouvrir l'entrée de connexion", () => {
    expect(markup()).toContain('href="/entrer"')
    expect(markup()).toContain("Me connecter")
  })
  it("la connexion ne présente aucun outil d'administration", () => {
    mocks.auth.isAuthenticated = true
    mocks.person = { _id: "person" }
    const html = markup()
    expect(html).toContain("Session du moteur ouverte")
    expect(html).toContain("Me déconnecter partout")
    expect(html).toContain("ne donne pas de droits")
    expect(html).not.toContain("Créer un réseau")
  })
  it("un JWT sans personne vivante n'est pas présenté comme une session ouverte", () => {
    mocks.auth.isAuthenticated = true
    expect(markup()).toContain("Me connecter")
    expect(markup()).not.toContain("Session du moteur ouverte")
  })
  it("une session en cours de contrôle annonce son attente", () => {
    mocks.auth.isLoading = true
    expect(markup()).toContain('role="status"')
    expect(markup()).toContain("Vérification de la session")
  })
})
