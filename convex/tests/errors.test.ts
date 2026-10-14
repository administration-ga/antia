import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { assertHandle } from "@antia/social-domain/content"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { checked, rethrowDomain } from "../lib/errors"

describe("bord du domaine : une violation de règle devient invalidArgument", () => {
  it("porte le code de la règle et ses bornes, jamais la valeur saisie", () => {
    let caught: unknown = null
    try {
      checked(() => assertHandle("ab"))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ConvexError)
    expect(engineErrorCode(caught)).toBe("invalidArgument")
    expect(engineErrorRule(caught)).toEqual({ rule: "HANDLE_LENGTH", params: { min: 3, max: 30 } })
    expect(JSON.stringify((caught as { data: unknown }).data)).not.toContain("\"ab\"")
  })

  it("laisse passer la valeur quand la règle tient", () => {
    expect(checked(() => assertHandle(" A.Ndong "))).toBe("a.ndong")
  })

  it("relance telle quelle une erreur qui n'est pas une violation", () => {
    const boom = new Error("panne")
    expect(() => rethrowDomain(boom)).toThrow(boom)
  })
})
