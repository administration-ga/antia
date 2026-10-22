import { describe, expect, it } from "vitest"

import type { ShowcaseStorefront } from "@/components/marketplace/shop-showcase-card"
import { memberDestinationFor, routes } from "@/lib/routes"
import { foodStorefronts } from "./food-universe-screen"

const storefront = (handle: string, template: ShowcaseStorefront["template"], model: ShowcaseStorefront["model"] = "products"): ShowcaseStorefront => ({
  handle, name: handle, logoUrl: null, bannerUrl: null, model, template, specialty: null, serviceArea: null, badge: "community", publishedAt: 1,
})

describe("Univers « Alimentation et restauration »", () => {
  it("ne garde que les vitrines au gabarit d'alimentation, jamais la mode ni les prestataires", () => {
    const page = [storefront("epicerie", "food"), storefront("mode", "fashion"), storefront("atelier", "local", "quote_services"), storefront("traiteur", "food")]
    expect(foodStorefronts(page).map(item => item.handle)).toEqual(["epicerie", "traiteur"])
  })

  it("a sa propre adresse, rangée sous Découvrir comme la marketplace", () => {
    expect(routes.foodUniverse()).toBe("/restauration")
    expect(memberDestinationFor(routes.foodUniverse(), new URLSearchParams())).toEqual({ id: "decouvrir", current: "section" })
  })
})
