import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ person: { published: true, handle: "awa.ndong" as string | undefined, displayName: "Awa Ndong" } }))

vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }))
vi.mock("@/components/network-shell", () => ({ useMemberSession: () => ({ person: state.person }) }))
vi.mock("@/lib/sign-out", () => ({ signOutAndRedirect: vi.fn() }))
vi.mock("@antsia/social-features/shell/appearance", () => ({ AppearanceControl: () => <div data-appearance="" /> }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { meEntries } from "./me-model"
import { routes } from "@/lib/routes"
import { MemberMeScreen } from "./me-screen"

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"))
}

beforeEach(() => {
  state.person = { published: true, handle: "awa.ndong", displayName: "Awa Ndong" }
})

describe("Profil — l'écran rend chaque entrée du modèle, l'apparence et la sortie", () => {
  it("titre, groupes nommés, toutes les entrées en liens, dans l'ordre du modèle", () => {
    const html = renderToStaticMarkup(<MemberMeScreen />)
    expect(html).toContain("<h1")
    expect(html).toContain("me.title")
    for (const key of ["me.activityTitle", "me.preferencesTitle", "me.accountTitle"]) expect(html).toContain(key)
    expect(hrefsOf(html)).toEqual(meEntries("awa.ndong").map((entry) => entry.href))
  })

  it("garde l'apparence et la déconnexion par la porte partagée", () => {
    const html = renderToStaticMarkup(<MemberMeScreen />)
    expect(html).toContain("data-appearance")
    expect(html).toMatch(/<button[^>]*>.*nav\.signOut<\/button>/)
  })

  it("sans identifiant publié, ni pseudo affiché ni lien vers un profil inexistant", () => {
    state.person = { published: true, handle: undefined, displayName: "Awa Ndong" }
    const html = renderToStaticMarkup(<MemberMeScreen />)
    expect(html).not.toContain("@")
    expect(hrefsOf(html)).toEqual(meEntries(null).map((entry) => entry.href))
  })

  // P15 — écrit, non exécuté : l'entrée « Mes candidatures » est rendue depuis Profil.
  it("ouvre boutique, panier, achats et Mes candidatures", () => {
    const html = renderToStaticMarkup(<MemberMeScreen />)
    expect(hrefsOf(html)).toContain(routes.myShops())
    expect(html).toContain("memberNetwork:commerce.myShop")
    expect(hrefsOf(html)).toContain(routes.cart())
    expect(hrefsOf(html)).toContain(routes.purchases())
    expect(hrefsOf(html)).toContain(routes.myApplications())
    expect(html).toContain("jobs:applications.title")
  })
})
