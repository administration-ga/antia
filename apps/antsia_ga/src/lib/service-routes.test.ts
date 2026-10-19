/** P14 — adresses des services (membre seulement). Écrit, NON exécuté (décision du propriétaire du 18/10/2026). */
import { describe, expect, it } from "vitest"

import { memberDestinationFor, routes } from "./routes"

const none = { get: () => null }

describe("P14 — routes des services", () => {
  it("encode chaque segment et reste sous la vitrine membre", () => {
    expect(routes.serviceQuote("x/y?z", "offer/a?b")).toBe("/boutique/x%2Fy%3Fz/devis/offer%2Fa%3Fb")
    expect(routes.serviceBooking("x/y?z", "offer/a?b")).toBe("/boutique/x%2Fy%3Fz/rendez-vous/offer%2Fa%3Fb")
    expect(routes.serviceOrder("x/y?z", "offer/a?b")).toBe("/boutique/x%2Fy%3Fz/prestation/offer%2Fa%3Fb")
    expect(routes.serviceRequests()).toBe("/mes-demandes")
    expect(routes.serviceRequest("x/y?z")).toBe("/mes-demandes/x%2Fy%3Fz")
    expect(routes.serviceDirectory()).toBe(`${routes.memberDiscover()}#services`)
  })
  it("range Mes demandes sous Profil et les parcours d'une offre sous Découvrir", () => {
    expect(memberDestinationFor(routes.serviceRequests(), none)).toEqual({ id: "profil", current: "section" })
    expect(memberDestinationFor(routes.serviceRequest("abc"), none)).toEqual({ id: "profil", current: "section" })
    expect(memberDestinationFor(routes.serviceBooking("salon", "offre"), none)).toEqual({ id: "decouvrir", current: "section" })
    expect(memberDestinationFor(routes.serviceQuote("salon", "offre"), none)).toEqual({ id: "decouvrir", current: "section" })
    expect(memberDestinationFor("/mes-demandes-autres", none)).toBeUndefined()
  })
})
