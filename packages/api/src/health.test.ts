import { describe, expect, it } from "vitest"

import { computeHealth } from "./health"

describe("computeHealth", () => {
  it("est « ok » quand le moteur est configuré", () => {
    expect(computeHealth({ NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210" }, "app")).toEqual({
      status: "ok",
      application: "app",
      version: "dev",
      backend: "configured",
    })
  })

  it("se déclare dégradée sans URL du moteur", () => {
    const report = computeHealth({}, "app")
    expect(report.status).toBe("degraded")
    expect(report.backend).toBe("missing")
  })

  it("rapporte le commit de construction quand il est connu", () => {
    expect(computeHealth({ NEXT_PUBLIC_BUILD_SHA: "abc1234" }, "app").version).toBe("abc1234")
  })
})
