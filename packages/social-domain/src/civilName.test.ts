import { describe, expect, it } from "vitest"

import { type CivilNameParts, normalizeCivilName, normalizeFamilyName, normalizeGivenNames } from "./civilName"

describe("civilName — champs civils structurés", () => {
  it("met le patronyme en capitales et chaque segment du prénom en casse initiale", () => {
    expect(normalizeFamilyName(" ndong  mba ")).toBe("NDONG MBA")
    expect(normalizeGivenNames(" jEAN-rÉMY  éLOÏSE ")).toBe("Jean-Rémy Éloïse")
    expect(normalizeGivenNames("ŒDIPE")).toBe("Œdipe")
  })

  it.each([
    ["d'ARTAGNAN", "D'Artagnan"],
    ["d’ARTAGNAN l‘ÉON", "D’Artagnan L‘Éon"],
    ["ʻALANI dʼARTAGNAN", "ʻAlani DʼArtagnan"],
    ["marie\u2011CLAIRE anne\u2010SOPHIE", "Marie\u2011Claire Anne\u2010Sophie"],
  ])("conserve les séparateurs de « %s » et traite aussi le segment suivant", (raw, expected) => {
    expect(normalizeGivenNames(raw)).toBe(expected)
  })

  it("préserve les accents, apostrophes et tirets du patronyme", () => {
    expect(normalizeFamilyName(" n'gué ma d’ABÉ-mbéi dʼondo\u2011nzé ")).toBe("N'GUÉ MA D’ABÉ-MBÉI DʼONDO\u2011NZÉ")
  })

  it("rend la même forme NFC depuis les accents précomposés ou décomposés", () => {
    const composed = { firstName: "ÉLOÏSE-RÉMY", lastName: "NZÉ MBÉI" }
    const decomposed = { firstName: composed.firstName.normalize("NFD"), lastName: composed.lastName.normalize("NFD") }
    const expected = { firstName: "Éloïse-Rémy", lastName: "NZÉ MBÉI" }
    expect(normalizeCivilName(composed)).toEqual(expected)
    expect(normalizeCivilName(decomposed)).toEqual(expected)
  })

  it("canonicalise les espaces Unicode sans supprimer les séparateurs des noms", () => {
    expect(normalizeGivenNames("\u00a0JEAN\t  MARIE\nÉLOÏSE\u202f")).toBe("Jean Marie Éloïse")
    expect(normalizeFamilyName("\nndong\u00a0\u202fmba\t")).toBe("NDONG MBA")
    expect(normalizeCivilName({ firstName: " \t\n\u00a0", lastName: "" })).toEqual({ firstName: "", lastName: "" })
  })

  it("borne l'expansion de la capitale à l'initiale des prénoms", () => {
    expect(normalizeGivenNames("ßARAH jean-ßON")).toBe("Ssarah Jean-Sson")
    expect(normalizeFamilyName("straße")).toBe("STRASSE")
  })

  it("est idempotent et ne modifie pas la paire d'entrée, même figée", () => {
    const input: CivilNameParts = Object.freeze({ firstName: " ÉLOÏSE-jeAN d’ARTAGNAN ", lastName: " ndong\u00a0mba " })
    const original = { ...input }
    const result = normalizeCivilName(input)
    expect(result).toEqual({ firstName: "Éloïse-Jean D’Artagnan", lastName: "NDONG MBA" })
    expect(result).not.toBe(input)
    expect(input).toEqual(original)
    expect(normalizeCivilName(result)).toEqual(result)
    expect(normalizeGivenNames(result.firstName)).toBe(result.firstName)
    expect(normalizeFamilyName(result.lastName)).toBe(result.lastName)
    expect(normalizeGivenNames("Ssarah")).toBe("Ssarah")
  })
})
