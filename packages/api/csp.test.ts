import { describe, expect, it } from "vitest"

import { buildContentSecurityPolicy, convexOrigins, livekitOrigins, securityHeaders } from "./csp.mjs"

describe("convexOrigins", () => {
  it("dérive les origines HTTP, WebSocket et .convex.site d'un déploiement cloud", () => {
    expect(convexOrigins("https://exemple-123.convex.cloud")).toEqual([
      "https://exemple-123.convex.cloud",
      "wss://exemple-123.convex.cloud",
      "https://exemple-123.convex.site",
    ])
  })

  it("dérive le port des actions HTTP d'un déploiement local", () => {
    expect(convexOrigins("http://127.0.0.1:3210")).toEqual([
      "http://127.0.0.1:3210",
      "ws://127.0.0.1:3210",
      "http://127.0.0.1:3211",
    ])
  })

  it("ne rend rien pour une URL absente ou invalide", () => {
    expect(convexOrigins(undefined)).toEqual([])
    expect(convexOrigins("pas une url")).toEqual([])
  })
})

describe("buildContentSecurityPolicy", () => {
  it("n'autorise eval qu'en développement", () => {
    expect(buildContentSecurityPolicy({ isDev: true })).toContain("'unsafe-eval'")
    expect(buildContentSecurityPolicy({ isDev: false })).not.toContain("'unsafe-eval'")
  })

  it("interdit l'encadrement et les objets", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, convexUrl: "https://x.convex.cloud" })
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("connect-src 'self' https://x.convex.cloud wss://x.convex.cloud")
  })

  it("pose HSTS hors développement seulement", () => {
    const keys = (isDev: boolean) => securityHeaders({ isDev }).map((h) => h.key)
    expect(keys(false)).toContain("Strict-Transport-Security")
    expect(keys(true)).not.toContain("Strict-Transport-Security")
  })
})

describe("livekitOrigins — le serveur média des appels", () => {
  it("dérive la signalisation (wss) et l'origine HTTPS d'un serveur sécurisé", () => {
    expect(livekitOrigins("wss://media.exemple.ga")).toEqual(["wss://media.exemple.ga", "https://media.exemple.ga"])
  })

  it("garde le port d'un serveur local", () => {
    expect(livekitOrigins("ws://127.0.0.1:7880")).toEqual(["ws://127.0.0.1:7880", "http://127.0.0.1:7880"])
  })

  it("n'ouvre rien sans variable, ni pour une URL invalide ou d'un autre protocole", () => {
    expect(livekitOrigins(undefined)).toEqual([])
    expect(livekitOrigins("")).toEqual([])
    expect(livekitOrigins("pas une url")).toEqual([])
    expect(livekitOrigins("ftp://media.exemple.ga")).toEqual([])
  })

  it("ajoute le serveur média à connect-src, et le stockage du déploiement à media-src", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, convexUrl: "https://x.convex.cloud", livekitUrl: "wss://media.exemple.ga" })
    expect(csp).toContain("wss://media.exemple.ga https://media.exemple.ga")
    expect(csp).toContain("media-src 'self' blob: https://x.convex.cloud")
  })
})
