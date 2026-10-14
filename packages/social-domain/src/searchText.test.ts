/**
 * Repli des diacritiques — le module n'avait pas de test au socle (annexe A1
 * §2.2) : celui-ci fige les trois promesses de son en-tête.
 */
import { describe, expect, it } from "vitest"

import { buildSearchableText, foldDiacritics, foldSearchQuery } from "./searchText"

describe("searchText", () => {
  it("replie les diacritiques et la casse, sans toucher les lettres à part entière", () => {
    expect(foldDiacritics("Ménagère")).toBe("menagere")
    expect(foldDiacritics("ŒUVRE")).toBe("œuvre")
    expect(foldDiacritics("Straße")).toBe("straße")
  })

  it("indexe l'original ET son repli, seulement s'il diffère", () => {
    expect(buildSearchableText("Ménagère", undefined, null, "")).toBe("Ménagère menagere")
    expect(buildSearchableText("Marché", "public")).toBe("Marché public marche public")
    expect(buildSearchableText("sans accent")).toBe("sans accent")
    expect(buildSearchableText(undefined, "")).toBe("")
  })

  it("replie la requête pour rencontrer la moitié repliée de l'index", () => {
    expect(foldSearchQuery("  Ménagère ")).toBe("menagere")
  })
})
