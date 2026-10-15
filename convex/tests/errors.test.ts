import { engineErrorAppRule, engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { assertHandle } from "@antia/social-domain/content"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { checked, fail, failAppRule, rethrowDomain } from "../lib/errors"

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

describe("refus métier d'une application (tranche) : un code fermé, jamais une phrase", () => {
  function caught(run: () => unknown): unknown {
    try {
      run()
    } catch (error) {
      return error
    }
    return null
  }

  it("porte le code de l'application et ses paramètres numériques, sous policyRefused par défaut", () => {
    const error = caught(() => failAppRule("sponsor_too_recent", { availableAt: 1_760_000_000_000 }))
    expect(error).toBeInstanceOf(ConvexError)
    expect(engineErrorCode(error)).toBe("policyRefused")
    expect(engineErrorAppRule(error)).toEqual({ appRule: "sponsor_too_recent", appParams: { availableAt: 1_760_000_000_000 } })
    expect(engineErrorRule(error)).toBeNull()
    expect(engineErrorCode(caught(() => failAppRule("attestation_pending", {}, "conflict")))).toBe("conflict")
  })

  it("un code mal formé est une faute de programmation, pas une erreur pour l'écran", () => {
    const error = caught(() => failAppRule("Vous ne pouvez pas parrainer"))
    expect(error).not.toBeInstanceOf(ConvexError)
    expect(engineErrorCode(error)).toBeNull()
    expect(caught(() => fail("policyRefused", { appRule: "Phrase" }))).not.toBeInstanceOf(ConvexError)
  })
})
