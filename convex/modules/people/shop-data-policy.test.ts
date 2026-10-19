import { describe, expect, it } from "vitest"

import { anonymizeReferences, directlyOwned, exportableRecord, referencesIn, shapeFor, type DataRecord } from "./dataInventory"

const draft: DataRecord = { _id: "shop_1", _creationTime: 1, networkId: "network_1", ownerPersonId: "person_1", preparedByPersonId: "person_1", draftName: "Mon atelier", draftDescription: "Présentation en cours", draftLogoStorageId: "storage_1", model: "products", storefront: "draft", visibility: "network", createdAt: 1, updatedAt: 2 }

describe("données d'une boutique — propriété, traces et effacement", () => {
  it("exporte le brouillon à son seul propriétaire", () => {
    expect(exportableRecord("shops", draft, "person_1")).toEqual(draft)
    expect(exportableRecord("shops", draft, "person_other")).toBeNull()
    expect(directlyOwned("shops", draft, "person_1")).toBe(true)
  })

  it("une préparation ancienne ne donne pas l'état actuel d'une page à son ancien gérant", () => {
    const shop = { ...draft, ownerPersonId: undefined, pageId: "page_1", specialty: "Une nouvelle spécialité", decisionReason: "Motif privé de l'équipe", publicConsentByPersonId: "person_other", publicConsentAt: 12, publicConsentTextVersion: "current" }
    expect(exportableRecord("shops", shop, "person_1")).toEqual({ _id: "shop_1", _creationTime: 1, networkId: "network_1", createdAt: 1, preparedByPersonId: "person_1" })
    expect(directlyOwned("shops", shop, "person_1")).toBe(false)
  })

  it("n'exporte au consentant que sa trace, sans la présentation ni le consentement d'autrui", () => {
    const shop = { ...draft, ownerPersonId: undefined, pageId: "page_1", publicConsentByPersonId: "person_2", publicConsentAt: 12, publicConsentTextVersion: "current", publicConsentRevokedAt: 16 }
    expect(exportableRecord("shops", shop, "person_2")).toEqual({ _id: "shop_1", _creationTime: 1, networkId: "network_1", createdAt: 1, publicConsentByPersonId: "person_2", publicConsentAt: 12, publicConsentTextVersion: "current", publicConsentRevokedAt: 16 })
    expect(exportableRecord("shops", shop, "person_unknown")).toBeNull()
  })

  it("un owner résiduel ne suffit jamais à exporter toute une boutique de page", () => {
    expect(exportableRecord("shops", { ...draft, pageId: "page_1", preparedByPersonId: "person_other" }, "person_1")).toBeNull()
  })

  it("l'inventaire dérivé inclut le logo du brouillon pour sa purge", () => {
    expect(referencesIn(draft, shapeFor("shops"))).toContainEqual({ table: "_storage", id: "storage_1" })
  })

  it("efface les références personnelles facultatives sans effacer la boutique d'une page", () => {
    const shop = { ...draft, ownerPersonId: undefined, pageId: "page_1", publicConsentByPersonId: "person_1", publicConsentAt: 12 }
    const anonymized = anonymizeReferences(shop, shapeFor("shops"), "person_1", "person_anonymous") as Record<string, unknown>
    expect(anonymized.pageId).toBe("page_1")
    expect(anonymized.preparedByPersonId).toBeUndefined()
    expect(anonymized.publicConsentByPersonId).toBeUndefined()
    expect(anonymized.publicConsentAt).toBe(12)
  })
})
