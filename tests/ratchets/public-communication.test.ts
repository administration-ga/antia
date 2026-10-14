import { describe, expect, it } from "vitest"

import { detectPublicClaims } from "./lib/detectors"
import { type Finding, formatFindings, listFiles, readRepoFile } from "./lib/source-files"

/**
 * Doctrine de communication publique du programme : aucun chiffre non mesuré,
 * aucun audit, aucune certification, aucun hébergement affirmé, aucun
 * superlatif ; le RGPD n'est pas le droit applicable au Gabon (il n'apparaît
 * que dans les textes légaux relus par un juriste).
 */
const NUMBER_CHECKED_PREFIXES = ["meta", "home", "about", "transparency", "landing"]
const LEGAL_PREFIXES = ["legal"]

describe("public-communication — ce que les pages publiques n'affirment pas", () => {
  it("aucune affirmation interdite dans les textes des applications et des surfaces", () => {
    const findings: Finding[] = []
    const locales = listFiles(["apps", "packages"], [".json"]).filter((file) => /\/i18n\/locales\/[a-z]{2}\//.test(file))
    for (const file of locales) {
      findings.push(
        ...detectPublicClaims(file, JSON.parse(readRepoFile(file)) as unknown, {
          numberCheckedPrefixes: NUMBER_CHECKED_PREFIXES,
          legalPrefixes: LEGAL_PREFIXES,
        }),
      )
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : pourcentage, audit, hébergement, superlatif, RGPD hors légal, chiffre public", () => {
    const messages = {
      home: { a: "99,9 % de disponibilité", b: "Plateforme auditée", c: "Données hébergées au Gabon", d: "12 000 membres", h: "Le journal d'audit des actes sensibles" },
      meta: { e: "Le réseau révolutionnaire" },
      app: { f: "Conforme au RGPD" },
      legal: { g: "Le RGPD s'applique aux résidents de l'Union européenne." },
    }
    const findings = detectPublicClaims("x.json", messages, { numberCheckedPrefixes: NUMBER_CHECKED_PREFIXES, legalPrefixes: LEGAL_PREFIXES })
    const keys = findings.map((finding) => finding.message.split(" : ")[0])
    expect(keys).toEqual(expect.arrayContaining(["home.a", "home.b", "home.c", "home.d", "meta.e", "app.f"]))
    expect(keys).not.toContain("legal.g")
    expect(keys).not.toContain("home.h")
  })
})
