import { describe, expect, it } from "vitest"

import { decodeRouteSegment } from "./route-params"

describe("decodeRouteSegment — un segment d'adresse dynamique", () => {
  it("décode une fois", () => {
    expect(decodeRouteSegment("awa.demo")).toBe("awa.demo")
    expect(decodeRouteSegment("x%20y")).toBe("x y")
    expect(decodeRouteSegment("%2541")).toBe("%41")
  })

  it("refuse le vide et l'encodage mal formé (introuvable, jamais une exception)", () => {
    expect(decodeRouteSegment("")).toBeNull()
    expect(decodeRouteSegment("%E0%A4%A")).toBeNull()
  })
})
