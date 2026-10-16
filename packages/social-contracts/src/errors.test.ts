import { describe, expect, it } from "vitest"

import { DOMAIN_RULES } from "@antsia/social-domain/violation"

import { ENGINE_ERROR_CODES, engineErrorAppRule, engineErrorCode, engineErrorRule, isAppRule } from "./errors"
import en from "./i18n/locales/en/errors.json"
import enRules from "./i18n/locales/en/rules.json"
import fr from "./i18n/locales/fr/errors.json"
import frRules from "./i18n/locales/fr/rules.json"

describe("codes d'erreur du moteur", () => {
  it("chaque code a sa traduction, dans les deux langues, et rien de plus", () => {
    expect(Object.keys(fr).sort()).toEqual([...ENGINE_ERROR_CODES].sort())
    expect(Object.keys(en).sort()).toEqual([...ENGINE_ERROR_CODES].sort())
  })

  it("lit le code d'une erreur serveur, et seulement un code connu", () => {
    expect(engineErrorCode({ data: { code: "notFound" } })).toBe("notFound")
    expect(engineErrorCode({ data: { code: "secret" } })).toBeNull()
    expect(engineErrorCode(new Error("x"))).toBeNull()
  })

  it("chaque règle du domaine a sa traduction, dans les deux langues, et rien de plus", () => {
    expect(Object.keys(frRules).sort()).toEqual([...DOMAIN_RULES].sort())
    expect(Object.keys(enRules).sort()).toEqual([...DOMAIN_RULES].sort())
  })

  it("lit la règle enfreinte et ses bornes, et seulement une règle connue", () => {
    expect(engineErrorRule({ data: { code: "invalidArgument", rule: "POST_TOO_LONG", params: { max: 2000 } } })).toEqual({
      rule: "POST_TOO_LONG",
      params: { max: 2000 },
    })
    expect(engineErrorRule({ data: { code: "invalidArgument", rule: "INCONNUE" } })).toBeNull()
    expect(engineErrorRule({ data: { code: "notFound" } })).toBeNull()
    expect(engineErrorRule({ data: { code: "invalidArgument", rule: "POST_EMPTY", params: { max: "x" } } })).toEqual({
      rule: "POST_EMPTY",
      params: {},
    })
  })

  it("lit le refus métier d'une application : code bien formé, paramètres numériques seulement", () => {
    expect(
      engineErrorAppRule({ data: { code: "policyRefused", appRule: "sponsor_too_recent", appParams: { availableAt: 1_760_000_000_000, label: "x" } } }),
    ).toEqual({ appRule: "sponsor_too_recent", appParams: { availableAt: 1_760_000_000_000 } })
    expect(engineErrorAppRule({ data: { code: "policyRefused", appRule: "sponsor_quota_reached" } })).toEqual({ appRule: "sponsor_quota_reached", appParams: {} })
    // Une phrase, une majuscule ou un code vide ne passent jamais pour un code.
    expect(engineErrorAppRule({ data: { code: "policyRefused", appRule: "Vous ne pouvez pas parrainer" } })).toBeNull()
    expect(engineErrorAppRule({ data: { code: "policyRefused", appRule: "Sponsor" } })).toBeNull()
    expect(engineErrorAppRule({ data: { code: "policyRefused" } })).toBeNull()
    expect(engineErrorAppRule(new Error("x"))).toBeNull()
    expect(engineErrorAppRule({ data: { code: "policyRefused", appRule: "quota", appParams: { max: Number.NaN } } })).toEqual({ appRule: "quota", appParams: {} })
    expect(isAppRule("a")).toBe(false)
    expect(isAppRule(`a${"b".repeat(64)}`)).toBe(false)
  })
})
