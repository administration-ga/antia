import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/access-home-screen", () => ({
  AccessHomeScreen: ({ intent, signOutIncomplete }: { intent?: "sign-in" | "sign-up"; signOutIncomplete?: boolean }) => (
    <main data-intent={intent ?? "sign-in"} data-sign-out-incomplete={String(signOutIncomplete ?? false)} />
  ),
}))
vi.mock("@/i18n/server", () => ({ getAppT: () => ({ t: (key: string) => key }) }))

import SignInPage from "./page"

describe("route d'accès — intentions explicites", () => {
  it("ouvre la connexion sans paramètre", async () => {
    const html = renderToStaticMarkup(await SignInPage({}))
    expect(html).toContain('data-intent="sign-in"')
    expect(html).toContain('data-sign-out-incomplete="false"')
  })

  it("ouvre directement l'inscription avec inscription=1", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ inscription: "1" }) }))
    expect(html).toContain('data-intent="sign-up"')
    expect(html).toContain('data-sign-out-incomplete="false"')
  })

  it("passe l'état de déconnexion incomplète à la porte d'accès", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ deconnexion: "incomplete" }) }))
    expect(html).toContain('data-intent="sign-in"')
    expect(html).toContain('data-sign-out-incomplete="true"')
  })

  it("conserve les deux intentions lorsqu'elles sont présentes ensemble", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ inscription: "1", deconnexion: "incomplete" }) }))
    expect(html).toContain('data-intent="sign-up"')
    expect(html).toContain('data-sign-out-incomplete="true"')
  })

  it("ne transforme pas une autre valeur de paramètre en intention", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ inscription: "0", deconnexion: "complete" }) }))
    expect(html).toContain('data-intent="sign-in"')
    expect(html).toContain('data-sign-out-incomplete="false"')
  })
})
