/** Contrat source PA10/P09, écrit sans exécution : indicateur optionnel, sans lecture de catalogue. */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("projection de l'indicateur d'offre du fil", () => {
  it("n'expose que le booléen optionnel quand la référence existe", () => {
    const source = readFileSync(new URL("./posts.ts", import.meta.url), "utf8")
    expect(source).toContain("hasCommerceOffer: v.optional(v.boolean())")
    expect(source).toContain("...(post.commerceOffer === undefined ? {} : { hasCommerceOffer: true })")
    expect(source).not.toMatch(/import[^\n]+(?:catalog|readPostOffer)/u)
  })
})
