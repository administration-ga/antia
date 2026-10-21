import { describe, expect, it } from "vitest"
import { nativeRouteFromUrl } from "./routes"

describe("native routes", () => {
  it("requires the exact configured scheme and a closed reference path", () => {
    expect(nativeRouteFromUrl("owned-antsia://fil", "owned-antsia")).toEqual({ name: "feed" })
    expect(nativeRouteFromUrl("other://fil", "owned-antsia")).toBe(null)
    expect(nativeRouteFromUrl("owned-antsia://fil?token=private", "owned-antsia")).toBe(null)
    expect(nativeRouteFromUrl("owned-antsia://appel/aaaaaaaaaaaaaaaa", "owned-antsia")).toBe(null)
    expect(nativeRouteFromUrl("owned-antsia://conversation/aaaaaaaaaaaaaaaa", null)).toBe(null)
  })
})
