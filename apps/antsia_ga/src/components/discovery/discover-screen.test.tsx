import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
// L'annuaire garde ses propres tests avec la vraie query ; ce test porte la navigation du hub.
vi.mock("@/components/shops/member-shop-directory", () => ({ MemberShopDirectory: () => <section id="boutiques" data-shop-directory="" /> }))
// P15 : sans offre réelle confirmée par le moteur, ni onglet ni section Emplois (écrit, non exécuté).
vi.mock("@/components/jobs/member-job-directory", () => ({ MemberJobDirectory: () => null, useJobsDiscoverable: () => false }))
// P14 : sans offre de service publiée montrée par le moteur, ni onglet ni rubrique Services (écrit, non exécuté).
vi.mock("@/components/services/member-service-directory", () => ({ MemberServiceDirectory: () => null, useServicesDiscoverable: () => false }))

import { routes } from "@/lib/routes"
import { discoverHrefs } from "./discover-model"
import { MemberDiscoverScreen } from "./discover-screen"

/** Les adresses réellement rendues en liens, dans l'ordre du document. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"))
}

describe("Découvrir — l'écran rend chaque entrée du modèle, et rien d'autre", () => {
  const html = renderToStaticMarkup(<MemberDiscoverScreen />)

  it("titre, phrase de portée membre, et TOUTES les entrées en liens d'une seule pièce", () => {
    expect(html).toContain("<h1")
    expect(html).toContain("nav.discover")
    expect(html).toContain("discovery.memberScope")
    expect(hrefsOf(html)).toEqual([routes.memberDiscover(), routes.shopDirectory(), ...discoverHrefs().filter((href) => href !== routes.shopDirectory())])
  })

  it("garde le fil national, les provinces, les volets et la vue publique atteignables", () => {
    const hrefs = hrefsOf(html)
    expect(hrefs).toContain(routes.nationalFeed())
    expect(hrefs).toContain(routes.memberProvince("woleu-ntem"))
    expect(hrefs).toContain(routes.memberTab("groupes"))
    expect(hrefs).toContain(routes.memberTab("evenements"))
    expect(hrefs).toContain(routes.discover())
  })

  it("propose le mot-clé par un formulaire nommé, son libellé lié au champ", () => {
    expect(html).toMatch(/<form[^>]*aria-label="discoverHub.tagTitle"/)
    expect(html).toContain("discoverHub.tagLabel")
    expect(html).toMatch(/aria-describedby="[^"]*-hint"/)
  })

  it("branche la rubrique Boutiques P07 sans servir Services et Emplois", () => {
    expect(html).not.toContain('role="tablist"')
    expect(html).toContain("data-shop-directory")
    expect(hrefsOf(html)).toContain(routes.shopDirectory())
    expect(html).not.toMatch(/commerce\.(?:services|jobs)|emplois/i)
  })
})
