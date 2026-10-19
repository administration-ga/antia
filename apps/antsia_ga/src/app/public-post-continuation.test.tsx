import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/access-home-screen", () => ({
  AccessHomeScreen: ({ publicPostId, intent }: { publicPostId?: string; intent?: string }) => (
    <main data-public-post={publicPostId} data-intent={intent} />
  ),
}))
vi.mock("@/components/welcome-screen", () => ({
  WelcomeScreen: ({ publicPostId }: { publicPostId?: string }) => <main data-public-post={publicPostId} />,
}))
vi.mock("@/i18n/server", () => ({ getAppT: () => ({ t: (key: string) => key }) }))

import WelcomePage from "./bienvenue/page"
import SignInPage from "./entrer/page"

const POST_ID = "jd7c7gw7f0nkf8kv8dazmw86ps8r4qgq"

describe("portes d'accès — continuation publique", () => {
  it("transmet le même identifiant depuis la connexion et l'inscription", async () => {
    for (const inscription of [undefined, "1"]) {
      const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ inscription, publication: POST_ID }) }))
      expect(html).toContain(`data-public-post="${POST_ID}"`)
      expect(html).toContain(`data-intent="${inscription === "1" ? "sign-up" : "sign-in"}"`)
    }
  })

  it("retrouve l'identifiant au retour du fournisseur d'identité sur bienvenue", async () => {
    const html = renderToStaticMarkup(await WelcomePage({ searchParams: Promise.resolve({ publication: POST_ID }) }))
    expect(html).toContain(`data-public-post="${POST_ID}"`)
  })

  it.each([undefined, [POST_ID], [POST_ID, POST_ID], "https://example.test", `${POST_ID}&returnTo=/elsewhere`].map((publication) => [publication] as const))("écarte un paramètre invalide aux deux portes : %j", async (publication) => {
    for (const Page of [SignInPage, WelcomePage]) {
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ publication }) }))
      expect(html).not.toContain("data-public-post")
    }
  })
})
