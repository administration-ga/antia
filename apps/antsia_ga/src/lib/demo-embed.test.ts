import { afterEach, describe, expect, it, vi } from "vitest"

import { canonicalHttpsOrigin, demoEmbedOrigin, demoParentOrigin } from "./demo-embed"

const MAIN_ORIGIN = "https://antsia.vercel.app"
const DEMO_ORIGIN = "https://antsia-demo.vercel.app"
const DEMO_BACKEND = "https://vivid-hedgehog-655.convex.cloud"

afterEach(() => vi.unstubAllEnvs())

describe("origines fermées du cadre démo", () => {
  it.each([MAIN_ORIGIN, DEMO_ORIGIN, "https://example.test"])("admet une origine HTTPS canonique : %s", (origin) => {
    expect(canonicalHttpsOrigin(origin)).toBe(origin)
  })

  it.each([
    undefined, "", "https:", "http://antsia-demo.vercel.app", "//antsia-demo.vercel.app",
    `${DEMO_ORIGIN}/`, `${DEMO_ORIGIN}/entrer`, `${DEMO_ORIGIN}:443`, `${DEMO_ORIGIN}:8443`,
    `${DEMO_ORIGIN}?mode=demo`, `${DEMO_ORIGIN}#demo`, "https://user:password@antsia-demo.vercel.app",
    ` ${DEMO_ORIGIN}`, `${DEMO_ORIGIN} `, `${DEMO_ORIGIN}\n`, "https://antsia-demo.vercel.app\t",
    "https://*.vercel.app", "https://ANTSIA-DEMO.vercel.app", "https://antsia-demo.vercel.app\\",
    "https://antsia-demo.vercel.app/../", "https://antsia-demo.vercel.app?", "https://antsia-demo.vercel.app#",
  ])("refuse toute normalisation ou permission élargie : %s", (origin) => {
    expect(canonicalHttpsOrigin(origin)).toBeNull()
  })

  it("reste fermé par défaut et exige le site principal valide", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", "")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", MAIN_ORIGIN)
    expect(demoEmbedOrigin()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", DEMO_ORIGIN)
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "")
    expect(demoEmbedOrigin()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${MAIN_ORIGIN}/`)
    expect(demoEmbedOrigin()).toBeNull()
  })

  it("exige deux origines distinctes, sans accepter une URL fournie par le navigateur", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", MAIN_ORIGIN)
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", MAIN_ORIGIN)
    expect(demoEmbedOrigin()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", `${DEMO_ORIGIN}/entrer`)
    expect(demoEmbedOrigin()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", DEMO_ORIGIN)
    expect(demoEmbedOrigin()).toBe(DEMO_ORIGIN)
  })

  it("n'autorise le signal parent que sur le backend cloud démo exact", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", MAIN_ORIGIN)
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", DEMO_BACKEND)
    expect(demoParentOrigin()).toBe(MAIN_ORIGIN)
    vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", `${MAIN_ORIGIN}:443`)
    expect(demoParentOrigin()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", "")
    expect(demoParentOrigin()).toBeNull()
  })

  it.each([
    "", "http://127.0.0.1:3210", "http://localhost:3210", "https://diligent-avocet-585.convex.cloud",
    "https://other.convex.cloud", `${DEMO_BACKEND}/`, `${DEMO_BACKEND}:443`,
    `${DEMO_BACKEND}.evil.test`, `${DEMO_BACKEND}?demo=1`, "https://vivid-hedgehog-655.convex.cloud@evil.test",
  ])("ne signale rien hors du cloud démo déclaré : %s", (backend) => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", MAIN_ORIGIN)
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backend)
    expect(demoParentOrigin()).toBeNull()
  })
})
