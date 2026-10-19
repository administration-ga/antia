import { describe, expect, it } from "vitest"
import { routes, shopContactFromLocation } from "./routes"
import { parseShopContactContinuation, shopContactFromSearch } from "./shop-contact-continuation"

const contact = { kind: "shop_contact", handle: "atelier-libreville", offerRef: "pro.ga:offer:0123456789ABCDEFGHJKMNPQRST" } as const
describe("P10 — retour fermé vers un contact commercial", () => {
  it("conserve boutique et offre entre connexion et accueil", () => {
    expect(parseShopContactContinuation(contact)).toEqual(contact)
    const login = new URL(routes.signIn("sign-up", undefined, undefined, contact), "https://example.test")
    expect(login.searchParams.get("inscription")).toBe("1")
    expect(shopContactFromSearch(Object.fromEntries(login.searchParams))).toEqual(contact)
    const welcome = new URL(routes.welcome(undefined, undefined, contact), "https://example.test")
    expect(shopContactFromSearch(Object.fromEntries(welcome.searchParams))).toEqual(contact)
  })
  it.each([null, [], { ...contact, next: "https://example.test" }, { ...contact, kind: "url" }, { ...contact, handle: "//example.test" }, { ...contact, handle: "a/b" }, { ...contact, handle: "a?b" }, { ...contact, offerRef: "pro.ga:shop:0123456789ABCDEFGHJKMNPQRST" }, { ...contact, offerRef: [contact.offerRef] }])("refuse une continuation étrangère ou ambiguë", (value) => {
    expect(parseShopContactContinuation(value)).toBeUndefined()
  })
  it("reprend une entrée membre directe sans redirection libre", () => {
    const target = new URL(routes.shopContact(contact.handle, contact.offerRef), "https://example.test")
    expect(shopContactFromLocation(target.pathname, target.search)).toEqual(contact)
    expect(shopContactFromLocation(`${target.pathname}/autre`, target.search)).toBeUndefined()
    expect(shopContactFromLocation(target.pathname, `${target.search}&offre=${contact.offerRef}`)).toBeUndefined()
    expect(shopContactFromLocation("/boutique/%252F/contacter", "")).toBeUndefined()
  })
  it("refuse les paramètres répétés et ne confère aucun droit", () => {
    expect(shopContactFromSearch({ contactBoutique: [contact.handle, "autre"] })).toBeUndefined()
    expect(routes.shopContact(contact.handle, contact.offerRef)).toContain(encodeURIComponent(contact.handle))
  })
  it("conserve la priorité des liens de publication et notification existants", () => {
    expect(routes.signIn(undefined, "publication-1", undefined, contact)).not.toContain("contactBoutique")
    expect(routes.welcome("publication-1", undefined, contact)).not.toContain("contactBoutique")
    expect(routes.signIn(undefined, undefined, "notification-1", contact)).not.toContain("contactBoutique")
  })
})
