import { describe, expect, it } from "vitest"
import { parseMessagesSegments } from "./messages-route"
import { routes } from "./routes"
import { parseShopContactContinuation } from "./shop-contact-continuation"

const offerRef = "pro.ga:offer:01JQ9ZGVBFW2S8R0A4HD6NKX5M"
describe("routes P10 réellement montées", () => {
  it("adresse la conversation commerciale distincte", () => {
    expect(parseMessagesSegments(["commerce", "commercial-id"])).toEqual({ kind: "commerce", id: "commercial-id" })
    expect(parseMessagesSegments(["commerce", "commercial-id", "extra"])).toBeNull()
    expect(routes.commercialConversation("commercial/id")).toBe("/messages/commerce/commercial%2Fid")
  })
  it("préserve le contexte d'offre par la continuation auth fermée", () => {
    const contact = { kind: "shop_contact" as const, handle: "atelier", offerRef }
    expect(parseShopContactContinuation(contact)).toEqual(contact)
    const href = routes.shopContact("atelier", offerRef)
    expect(href).toBe(`/boutique/atelier/contacter?${new URLSearchParams({ offre: offerRef })}`)
    const auth = routes.signIn(undefined, undefined, undefined, contact)
    expect(auth).toContain("contactBoutique=atelier")
    expect(auth).toContain(`contactOffre=${encodeURIComponent(offerRef)}`)
    expect(parseShopContactContinuation({ ...contact, next: "https://external.invalid" })).toBeUndefined()
  })
})
