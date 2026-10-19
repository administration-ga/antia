import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { optionalAnalyticsOrigin, readEnvFile } from "./next-config.mjs"

describe("optional analytics CSP origin", () => {
  const token = `phc_${"a".repeat(24)}`
  it("n'ouvre aucune origine sans configuration complète", () => {
    expect(optionalAnalyticsOrigin("", token)).toBeNull()
    expect(optionalAnalyticsOrigin("https://usage.example.test", "")).toBeNull()
    expect(optionalAnalyticsOrigin("https://usage.example.test", `phx_${"a".repeat(24)}`)).toBeNull()
  })
  it("admet le cloud UE ou un relais explicitement déclaré, jamais un HTTPS arbitraire", () => {
    expect(optionalAnalyticsOrigin("https://eu.i.posthog.com", token)).toBe("https://eu.i.posthog.com")
    expect(optionalAnalyticsOrigin("https://usage.example.test", token)).toBeNull()
    expect(optionalAnalyticsOrigin("https://us.i.posthog.com", token)).toBeNull()
    expect(optionalAnalyticsOrigin("https://usage.example.test", token, "https://usage.example.test")).toBe("https://usage.example.test")
    expect(optionalAnalyticsOrigin("https://usage.example.test", token, "https://usage.example.test/path")).toBeNull()
    for (const host of ["http://usage.example.test", "https://name:secret@usage.example.test", "https://usage.example.test/path", "https://usage.example.test?key=1", "https://usage.example.test#fragment", "https://usage.example.test 'unsafe-inline'"]) {
      expect(optionalAnalyticsOrigin(host, token)).toBeNull()
    }
  })
})

describe("readEnvFile", () => {
  it("lit le format écrit par le CLI Convex (commentaires, lignes vides)", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"))
    const file = join(dir, ".env.local")
    writeFileSync(file, "# Deployment used by `npx convex dev`\nCONVEX_DEPLOYMENT=anonymous:exemple # commentaire\n\nCONVEX_URL=http://127.0.0.1:3210\nCONVEX_SITE_URL=\"http://127.0.0.1:3211\"\n")
    expect(readEnvFile(file)).toEqual({
      CONVEX_DEPLOYMENT: "anonymous:exemple",
      CONVEX_URL: "http://127.0.0.1:3210",
      CONVEX_SITE_URL: "http://127.0.0.1:3211",
    })
  })

  it("rend un objet vide quand le fichier n'existe pas", () => {
    expect(readEnvFile(join(tmpdir(), "absent-antsia", ".env.local"))).toEqual({})
  })
})
