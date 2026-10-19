// @vitest-environment jsdom
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  status: "signedOut",
  callbackURL: undefined as string | undefined,
}))

// Comme celui de Next, le routeur reste le MÊME objet d'un rendu à l'autre : un nouveau rendu
// ne rejoue pas une redirection (dépendance `router` de l'effet), d'où « exactement une fois ».
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace }
  return { useRouter: () => router }
})
// Session conforme à `SessionState` : un état admis porte sa personne (aucun accord de mesure) et la racine.
vi.mock("@/components/use-session-state", () => ({
  useSessionState: () => mocks.status === "welcome" ? { status: mocks.status, person: null, root: { slug: "antsia" } }
    : mocks.status === "member" || mocks.status === "restricted" ? { status: mocks.status, person: { consentsInForce: [] }, root: { slug: "antsia" } }
    : { status: mocks.status },
}))
vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }))
vi.mock("@antsia/api/viewer-preferences", () => ({ useViewerTimeZone: () => "UTC" }))
vi.mock("@/lib/auth-client", () => ({ authClient: {} }))
vi.mock("@/lib/session-bridge-client", () => ({ fencedIdentityEntryClient: (client: unknown) => client }))
vi.mock("@antsia/social-features/identity", () => ({
  IdentityEntry: ({ callbackURL }: { callbackURL: string }) => {
    mocks.callbackURL = callbackURL
    return <form data-identity-entry="" />
  },
}))

import { UsagePermissionProvider } from "./analytics-permission"
import { SignInCard } from "./sign-in-screen"
import { WelcomeScreen } from "./welcome-screen"

const REFERENCE = "notification_job-1"
let root: Root | undefined
let host: HTMLDivElement | undefined

async function mount(children: ReactNode) {
  const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "antsia", defaultVariables: { brand: BRAND_NAME } })
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  // Même arbre que `Providers` : la bienvenue mesure l'entrée sous la permission d'usage.
  await act(async () => root!.render(<I18nextProvider i18n={i18n}><UsagePermissionProvider>{children}</UsagePermissionProvider></I18nextProvider>))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.status = "signedOut"
  mocks.callbackURL = undefined
})

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  host = undefined
})

describe("connexion — notification en attente de relecture", () => {
  it("conserve la référence dans le callback IDN et le lien d'inscription", async () => {
    await mount(<SignInCard notificationReference={REFERENCE} />)
    expect(mocks.callbackURL).toBe(routes.welcome(undefined, REFERENCE))
    expect(host?.querySelector("a")?.getAttribute("href")).toBe(routes.signIn("sign-up", undefined, REFERENCE))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("conserve la référence en revenant de l'inscription à la connexion", async () => {
    await mount(<SignInCard intent="sign-up" notificationReference={REFERENCE} />)
    expect(mocks.callbackURL).toBe(routes.welcome(undefined, REFERENCE))
    expect(host?.querySelector("a")?.getAttribute("href")).toBe(routes.signIn(undefined, undefined, REFERENCE))
  })

  it.each([
    ["member", routes.openNotification(REFERENCE)],
    ["welcome", routes.welcome(undefined, REFERENCE)],
    ["restricted", routes.personalControls()],
  ])("une session %s rejoint seulement sa porte autorisée", async (status, destination) => {
    mocks.status = status
    await mount(<SignInCard notificationReference={REFERENCE} />)
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(destination)
    expect(host?.querySelector("form")).toBeNull()
  })

  it("la référence de notification ne contourne pas la déconnexion incomplète", async () => {
    mocks.status = "member"
    await mount(<SignInCard notificationReference={REFERENCE} signOutIncomplete />)
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(host?.querySelector("form")).not.toBeNull()
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain("déconnexion complète n’a pas pu être confirmée")
  })

  it("un retour explicite de publication reste prioritaire sur une notification", async () => {
    const postId = "public-post-1"
    await mount(<SignInCard publicPostId={postId} notificationReference={REFERENCE} />)
    expect(mocks.callbackURL).toBe(routes.welcome(postId))
    expect(host?.querySelector("a")?.getAttribute("href")).toBe(routes.signIn("sign-up", postId))
  })

  it("une URL libre passée comme référence est abandonnée", async () => {
    await mount(<SignInCard notificationReference="https://example.test/private" />)
    expect(mocks.callbackURL).toBe(routes.welcome())
    expect(host?.querySelector("a")?.getAttribute("href")).toBe(routes.signIn("sign-up"))
  })
})

describe("bienvenue — retour à la porte de notification", () => {
  it.each([
    ["member", routes.openNotification(REFERENCE)],
    ["signedOut", routes.signIn(undefined, undefined, REFERENCE)],
    ["restricted", routes.personalControls()],
  ])("conserve le retour approprié pour une session %s", async (status, destination) => {
    mocks.status = status
    await mount(<WelcomeScreen notificationReference={REFERENCE} />)
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(destination)
  })

  it("un membre avec une référence invalide rejoint le fil sans destination libre", async () => {
    mocks.status = "member"
    await mount(<WelcomeScreen notificationReference="//example.test" />)
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(routes.feed())
  })
})
