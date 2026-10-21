import { describe, expect, it } from "vitest"

import { demoCatalogProjectionAllowed } from "./demo-catalog-projection"

describe("origine fermée des illustrations du catalogue", () => {
  it.each(["http://127.0.0.1:3210", "http://localhost:3210", "https://vivid-hedgehog-655.convex.cloud"])("admet l'origine exacte %s", (backendUrl) => {
    expect(demoCatalogProjectionAllowed(backendUrl)).toBe(true)
  })
  it.each(["", "https://production.convex.cloud", "https://other.convex.cloud", "https://vivid-hedgehog-655.convex.cloud.evil.test", "https://evil.test/vivid-hedgehog-655.convex.cloud", "https://vivid-hedgehog-655.convex.cloud@evil.test", "https://vivid-hedgehog-655.convex.cloud/path", "https://vivid-hedgehog-655.convex.cloud?demo=1", "https://vivid-hedgehog-655.convex.cloud#demo", "https://vivid-hedgehog-655.convex.cloud:443", "https://vivid-hedgehog-655.convex.cloud/", "http://localhost:3211", "http://localhost:3210.evil.test", "http://127.0.0.1:3210@evil.test", "https://localhost:3210"])("refuse origine différente, déguisée ou élargie : %s", (backendUrl) => {
    expect(demoCatalogProjectionAllowed(backendUrl)).toBe(false)
  })
})
