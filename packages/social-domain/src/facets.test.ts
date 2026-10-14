import { describe, expect, it } from "vitest"

import { canReadFacetField, type FacetSchema, FACET_SCHEMA_LIMITS, projectFacets, validateFacetSchema, validateFacetValues } from "./facets"

const diaspora: FacetSchema = {
  fields: [
    { key: "countryOfResidence", kind: "country", required: true, defaultVisibility: "network", excludedValues: ["GA"] },
    { key: "city", kind: "text", required: false, defaultVisibility: "network", maxLength: 80 },
    { key: "associations", kind: "textList", required: false, defaultVisibility: "hidden", maxItems: 3 },
    { key: "arrivedAt", kind: "year", required: false, defaultVisibility: "hidden" },
    { key: "helpAvailable", kind: "boolean", required: false, defaultVisibility: "network" },
    { key: "status", kind: "enum", required: false, defaultVisibility: "root", enumValues: ["etudiant", "salarie"] },
  ],
}

describe("validateFacetSchema", () => {
  it("accepte un schéma borné", () => {
    expect(validateFacetSchema(diaspora)).toEqual([])
  })

  it("refuse clés invalides ou doublées, énumération vide, dépassement de bornes", () => {
    const errors = validateFacetSchema({
      fields: [
        { key: "Bad-Key", kind: "text", required: false, defaultVisibility: "hidden" },
        { key: "a", kind: "text", required: false, defaultVisibility: "hidden" },
        { key: "a", kind: "text", required: false, defaultVisibility: "hidden" },
        { key: "e", kind: "enum", required: false, defaultVisibility: "hidden" },
        { key: "big", kind: "text", required: false, defaultVisibility: "hidden", maxLength: FACET_SCHEMA_LIMITS.maxTextLength + 1 },
      ],
    }).map((error) => `${error.key}:${error.problem}`)
    expect(errors).toEqual(["Bad-Key:invalid_key", "a:duplicate_key", "e:enum_without_values", "big:limit_exceeded"])
  })

  it("refuse un schéma sans fin", () => {
    const fields = Array.from({ length: FACET_SCHEMA_LIMITS.maxFields + 1 }, (_, index) => ({
      key: `f${index}`,
      kind: "boolean" as const,
      required: false,
      defaultVisibility: "hidden" as const,
    }))
    expect(validateFacetSchema({ fields }).map((error) => error.problem)).toContain("too_many_fields")
  })
})

describe("validateFacetValues", () => {
  it("accepte des valeurs conformes", () => {
    expect(validateFacetValues(diaspora, { countryOfResidence: "FR", city: "Lyon", associations: ["a"], arrivedAt: 2019, helpAvailable: true, status: "etudiant" })).toEqual([])
  })

  it("exige les champs obligatoires et refuse les champs inconnus", () => {
    expect(validateFacetValues(diaspora, { unknown: "x" })).toEqual([
      { key: "unknown", problem: "unknown_field" },
      { key: "countryOfResidence", problem: "required" },
    ])
  })

  it("refuse le Gabon comme pays de résidence de la diaspora", () => {
    expect(validateFacetValues(diaspora, { countryOfResidence: "GA" })).toEqual([{ key: "countryOfResidence", problem: "not_allowed" }])
  })

  it("vérifie le type, la longueur et le nombre d'éléments", () => {
    const errors = validateFacetValues(diaspora, {
      countryOfResidence: "fr",
      city: "x".repeat(81),
      associations: ["a", "b", "c", "d"],
      arrivedAt: 1800,
      helpAvailable: "oui",
      status: "autre",
    }).map((error) => `${error.key}:${error.problem}`)
    expect(errors).toEqual([
      "countryOfResidence:wrong_type",
      "city:too_long",
      "associations:too_many_items",
      "arrivedAt:wrong_type",
      "helpAvailable:wrong_type",
      "status:not_allowed",
    ])
  })
})

describe("projection allowlistée des facettes", () => {
  const values = { countryOfResidence: "FR", city: "Lyon", associations: ["a"], status: "etudiant" }

  it("soi-même voit tout", () => {
    expect(projectFacets(diaspora, values, {}, "self")).toEqual(values)
  })

  it("un membre du réseau ne voit ni le caché ni rien hors schéma", () => {
    expect(projectFacets(diaspora, values, {}, "network_member")).toEqual({ countryOfResidence: "FR", city: "Lyon", status: "etudiant" })
  })

  it("un membre de la racine ne voit que le public", () => {
    expect(projectFacets(diaspora, values, {}, "root_member")).toEqual({ status: "etudiant" })
  })

  it("le choix de la personne l'emporte sur le défaut", () => {
    expect(projectFacets(diaspora, values, { city: "hidden", associations: "root" }, "root_member")).toEqual({ associations: ["a"], status: "etudiant" })
  })

  it("table de lecture", () => {
    expect(canReadFacetField("hidden", "network_member")).toBe(false)
    expect(canReadFacetField("network", "network_member")).toBe(true)
    expect(canReadFacetField("network", "root_member")).toBe(false)
    expect(canReadFacetField("root", "root_member")).toBe(true)
    expect(canReadFacetField("hidden", "self")).toBe(true)
  })
})
