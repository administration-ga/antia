import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

async function headersFor(backend: string, parent: string) {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backend)
  vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", "https://demo.example.test")
  vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", parent)
  vi.resetModules()
  const { default: config } = await import("../../next.config")
  return (await config.headers?.())?.[0]?.headers ?? []
}

describe("intégration démo — frontière du déploiement", () => {
  it("garde les pages réelles non intégrables même avec une origine parent configurée", async () => {
    const headers = await headersFor("https://diligent-avocet-585.convex.cloud", "https://app.example.test")
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" })
    const csp = headers.find(({ key }) => key === "Content-Security-Policy")?.value
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("frame-src https://demo.example.test")
  })

  it("permet l'origine parent exacte seulement sur la démo cloud approuvée", async () => {
    const headers = await headersFor("https://vivid-hedgehog-655.convex.cloud", "https://app.example.test")
    expect(headers.some(({ key }) => key === "X-Frame-Options")).toBe(false)
    expect(headers.find(({ key }) => key === "Content-Security-Policy")?.value).toContain("frame-ancestors https://app.example.test")
  })

  it.each(["https://vivid-hedgehog-655.convex.cloud/", "https://vivid-hedgehog-655.convex.cloud.evil.test", "http://localhost:3210"])("refuse une autre cible ou une cible déguisée : %s", async (backend) => {
    const headers = await headersFor(backend, "https://app.example.test")
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" })
  })

  it("refuse une origine parent normalisée ou élargie sur le backend démo", async () => {
    const headers = await headersFor("https://vivid-hedgehog-655.convex.cloud", "https://app.example.test:443")
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" })
  })
})
