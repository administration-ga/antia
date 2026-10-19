// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { getAppT } from "@/i18n/server"
import type { PublicStorefront } from "@/lib/public-shops-data"
import { routes } from "@/lib/routes"
import { PublicStorefrontCard } from "./public-storefront-card"

const storefront: PublicStorefront = { handle: "atelier", name: "Atelier partagé", description: "Une présentation publique\nsur plusieurs lignes.", logoUrl: null, bannerUrl: null, model: "products", specialty: "Artisanat", serviceArea: "Libreville", hours: "Du lundi au vendredi", badge: "community", blocks: ["about"], publishedAt: 1_700_000_000_000, origin: { slug: "antsia", name: "ANTSIA" } }

describe("vitrine publique rendue sans fournisseur membre", () => {
  it.each(["fr", "en"] as const)("rend identité de page, origine et présentation complète en HTML initial (%s)", (locale) => {
    const { t } = getAppT(locale)
    const html = renderToStaticMarkup(<PublicStorefrontCard storefront={storefront} locale={locale} />)
    const container = document.createElement("div")
    container.innerHTML = html
    expect(container.querySelector("h1")?.textContent).toBe(storefront.name)
    expect(container.textContent).toContain(storefront.description)
    expect(container.textContent).toContain(t("shops:publicStorefront.origin", { name: "ANTSIA" }))
    expect(container.textContent).toContain(t("shops:badges.community"))
    expect(container.textContent).toContain(t("shops:models.products"))
    expect(container.querySelectorAll("dt").length).toBe(3)
    expect(container.querySelector("a")?.getAttribute("href")).toBe(routes.storefront("atelier"))
    expect(container.querySelector("button, form")).toBeNull()
    expect(html).not.toContain(routes.officialPage("atelier"))
  })

  it("ne crée aucune URL ni image pour les médias retenus projetés à null", () => {
    const html = renderToStaticMarkup(<PublicStorefrontCard storefront={storefront} locale="fr" />)
    expect(html).not.toContain("<img")
    expect(html).not.toContain("src=")
    expect(html).not.toContain("_storage")
  })

  it("rend seulement les médias gardés et garde le modèle services distinct sans inventer d’offre", () => {
    const value: PublicStorefront = { ...storefront, model: "quote_services", logoUrl: "https://media.example/logo.jpg", bannerUrl: "https://media.example/banner.jpg", hours: null }
    const html = renderToStaticMarkup(<PublicStorefrontCard storefront={value} locale="fr" />)
    const container = document.createElement("div")
    container.innerHTML = html
    expect(Array.from(container.querySelectorAll("img")).map((image) => image.getAttribute("src"))).toEqual([value.bannerUrl, value.logoUrl])
    expect(container.querySelectorAll("dt").length).toBe(2)
    expect(container.textContent).toContain(getAppT("fr").t("shops:models.quote_services"))
    expect(container.querySelector("button, form, [role=tablist]")).toBeNull()
  })

  it("échappe les textes usagers et distingue l’origine projetée d’une mention dans la description", () => {
    const value: PublicStorefront = { ...storefront, name: '<script>Atelier</script>', description: 'Origine : FAUSSE <img onerror="injection()">', origin: { slug: "antsia", name: '<svg onload="injection()">ANTSIA</svg>' } }
    const html = renderToStaticMarkup(<PublicStorefrontCard storefront={value} locale="fr" />)
    const container = document.createElement("div")
    container.innerHTML = html
    expect(container.querySelector("h1")?.textContent).toBe(value.name)
    expect(container.textContent).toContain(value.description)
    expect(container.textContent).toContain(getAppT("fr").t("shops:publicStorefront.origin", { name: value.origin.name }))
    expect(container.querySelector("script, img, svg, [onerror], [onload]")).toBeNull()
    expect(html).toContain("&lt;script&gt;")
  })
})
