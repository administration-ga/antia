import { describe, expect, it } from "vitest"

import { GABON_PROVINCES, isProvinceSlug, PROVINCE_SLUGS } from "./provinces"

describe("provinces — attribution volontaire stable", () => {
  it("déclare neuf adresses uniques dans l'ordre du référentiel", () => {
    expect(PROVINCE_SLUGS).toHaveLength(9)
    expect(new Set(PROVINCE_SLUGS).size).toBe(9)
    expect(GABON_PROVINCES.map((province) => province.slug)).toEqual(PROVINCE_SLUGS)
    expect(GABON_PROVINCES.map((province) => province.name)).toEqual([
      "Estuaire", "Haut-Ogooué", "Moyen-Ogooué", "Ngounié", "Nyanga",
      "Ogooué-Ivindo", "Ogooué-Lolo", "Ogooué-Maritime", "Woleu-Ntem",
    ])
  })

  it("admet chaque slug exact et refuse pays, variantes ou valeurs inconnues", () => {
    for (const slug of PROVINCE_SLUGS) expect(isProvinceSlug(slug)).toBe(true)
    for (const invalid of [undefined, null, 1, {}, "", "GA", "ga", "Estuaire", "estuaire ", "haut-ogooué", "paris"]) {
      expect(isProvinceSlug(invalid)).toBe(false)
    }
  })
})
