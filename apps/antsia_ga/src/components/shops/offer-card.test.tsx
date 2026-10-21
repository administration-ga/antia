// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getAppT } from "@/i18n/server"
import { routes } from "@/lib/routes"
import { catalogAvailability, catalogVariantPrice } from "./catalog-model"
import { OfferCard, OfferDetails } from "./offer-card"
import { CATALOG_NOW, catalogOfferFixture, catalogVariantFixture } from "./__tests__/catalog-fixtures"

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(CATALOG_NOW) })
afterEach(() => vi.useRealTimers())
const translate = (locale: "fr" | "en") => (key: string, options?: Record<string, unknown>) => getAppT(locale).t(`shops:${key}`, options)
const dom = (html: string) => { const node = document.createElement("div"); node.innerHTML = html; return node }

describe("cartes et fiches d'offre communes au membre et au SSR", () => {
  it.each(["fr", "en"] as const)("rend titre, prix XAF, fraîcheur et vraie destination (%s)", (locale) => {
    const offer = catalogOfferFixture()
    const t = translate(locale)
    const node = dom(renderToStaticMarkup(<OfferCard offer={offer} audience="public" locale={locale} t={t} compact />))
    expect(node.textContent).toContain(offer.title)
    expect(node.textContent).toContain("XAF")
    expect(node.textContent).toContain(t("catalog.availability.title"))
    expect(node.textContent).toContain("2026")
    expect(node.querySelector("a")?.getAttribute("href")).toBe(routes.publicShopOffer(offer.shopHandle, offer.offerRef))
    expect(node.querySelector("button, form")).toBeNull()
  })
  it("une photo retenue ne reçoit jamais de src même si le DTO contient aussi une URL", () => {
    const offer = catalogOfferFixture({ media: [{ url: "https://must-never-appear.example/photo.jpg", altText: null, width: null, height: null, withheld: "fileQuarantined" }] })
    const html = renderToStaticMarkup(<OfferDetails offer={offer} audience="public" locale="fr" t={translate("fr")} />)
    expect(html).not.toContain("must-never-appear")
    expect(dom(html).querySelector("img")).toBeNull()
    expect(dom(html).textContent).toContain(translate("fr")("catalog.mediaWithheld"))
  })
  it("rend une photo admise sans URL de gestion ou image inventée", () => {
    const photo = { url: "https://media.example/photo.jpg", altText: "Sac en tissu", width: 800, height: 600, withheld: null }
    const offer = catalogOfferFixture({ media: [photo] })
    const node = dom(renderToStaticMarkup(<OfferCard offer={offer} audience="member" locale="fr" t={translate("fr")} />))
    expect(node.querySelector("img")?.getAttribute("src")).toBe(photo.url)
    expect(node.querySelector("img")?.getAttribute("alt")).toBe("Sac en tissu")
    expect(node.querySelector("a")?.getAttribute("href")).toBe(routes.shopOffer(offer.shopHandle, offer.offerRef))
  })
  it("un service sur devis reste explicitement sans montant et sans action de transaction", () => {
    const offer = catalogOfferFixture({ kind: "service", price: { mode: "quote", currency: "XAF" }, variants: [] })
    const node = dom(renderToStaticMarkup(<OfferDetails offer={offer} audience="public" locale="fr" t={translate("fr")} />))
    expect(node.textContent).toContain("Sur devis")
    expect(node.textContent).not.toContain("0 XAF")
    expect(node.querySelector("button, form, [data-checkout]")).toBeNull()
  })
  it("conserve intervalle, unité et prix exact de chaque variante dans le HTML initial", () => {
    const offer = catalogOfferFixture({ price: { mode: "range", currency: "XAF", minAmount: 10000, maxAmount: 20000, unit: "mètre" }, variants: [catalogVariantFixture({ amount: 17500, unit: "pièce" })] })
    const node = dom(renderToStaticMarkup(<OfferDetails offer={offer} audience="public" locale="fr" t={translate("fr")} />))
    expect(node.textContent?.replace(/[\u00a0\u202f]/g, " ")).toContain("10 000 XAF")
    expect(node.textContent?.replace(/[\u00a0\u202f]/g, " ")).toContain("20 000 XAF")
    expect(node.textContent?.replace(/[\u00a0\u202f]/g, " ")).toContain("17 500 XAF / pièce")
    expect(node.textContent).toContain("/ mètre")
    expect(node.querySelector("details")?.textContent).toContain("Rouge")
    expect(node.querySelector("h1")?.textContent).toBe(offer.title)
  })
  it("le booléen stale et l'âge local ferment l'affirmation de disponibilité sans polling", () => {
    const t = translate("fr")
    const availability = catalogOfferFixture().availability
    expect(catalogAvailability({ ...availability, stale: true }, t)).toBe(t("catalog.availability.stale"))
    expect(catalogAvailability(availability, t, "in_stock", CATALOG_NOW + 15 * 60 * 1000 + 1)).toBe(t("catalog.availability.stale"))
    expect(catalogAvailability({ ...availability, updatedAt: null }, t)).toBe(t("catalog.availability.unknown"))
    expect(catalogAvailability({ ...availability, state: null }, t)).toBe(t("catalog.availability.notShared"))
  })
  it("une variante garde son montant exact et hérite de l'unité du prix unitaire", () => {
    const variant = catalogVariantFixture()
    const offer = catalogOfferFixture({ price: { mode: "unit", amount: 15000, currency: "XAF", unit: "mètre" }, variants: [variant] })
    expect(catalogVariantPrice(offer.price, variant, "fr", translate("fr")).replace(/[\u00a0\u202f]/g, " ")).toBe("17 500 XAF / mètre")
    expect(catalogVariantPrice(offer.price, { ...variant, unit: "pièce" }, "fr", translate("fr"))).toContain("/ pièce")
  })
  it("échappe titre, description, options et libellés sans réécrire la marque", () => {
    const offer = catalogOfferFixture({ title: "<script>Atelier</script>", description: '<img onerror="injection()">', variants: [catalogVariantFixture({ label: "<b>Rouge</b>" })] })
    const node = dom(renderToStaticMarkup(<OfferDetails offer={offer} audience="public" locale="fr" t={translate("fr")} />))
    expect(node.textContent).toContain(offer.title)
    expect(node.textContent).toContain(offer.description)
    expect(node.querySelector("script, img, [onerror]")).toBeNull()
  })

  it.each(["member", "public"] as const)("identifie la boutique séparément du titre d'offre (%s)", audience => {
    const offer = catalogOfferFixture()
    const node = dom(renderToStaticMarkup(<OfferCard offer={offer} audience={audience} locale="fr" t={translate("fr")} compact />))
    const expected = audience === "public" ? routes.publicStorefront(offer.shopHandle) : routes.storefront(offer.shopHandle)
    const shop = Array.from(node.querySelectorAll("a")).find(link => link.getAttribute("href") === expected)
    expect(shop?.textContent).toContain(offer.shopHandle)
    expect(node.querySelector("button, form")).toBeNull()
  })

  it("ne rend jamais un slot d'action membre dans la fiche publique", () => {
    const offer = catalogOfferFixture()
    const publicHtml = renderToStaticMarkup(<OfferDetails offer={offer} audience="public" locale="fr" t={translate("fr")} actionSlot={<button>Action privée</button>} />)
    expect(publicHtml).not.toContain("Action privée")
    const memberHtml = renderToStaticMarkup(<OfferDetails offer={offer} audience="member" locale="fr" t={translate("fr")} actionSlot={<a href={routes.checkoutPrepare(offer.shopHandle, offer.offerRef)}>Préparation autorisée</a>} />)
    expect(memberHtml).toContain("Préparation autorisée")
    expect(memberHtml).not.toContain(">Payer<")
  })
})
