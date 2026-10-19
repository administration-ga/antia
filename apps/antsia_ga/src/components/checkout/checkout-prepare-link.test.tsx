import { createAppI18n } from "@antsia/social-features/i18n"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vitest"
import fr from "@/i18n/locales/fr/checkout.json"
import en from "@/i18n/locales/en/checkout.json"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ error: false, available: true, quote: false, pending: null as null | { attemptId: string } }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { checkout: { context: "context" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ isError: mocks.error, isPending: false, data: { available: mocks.available, pending: mocks.pending, offer: { variants: [], price: { mode: mocks.quote ? "quote" : "fixed" } } } }) }))
vi.mock("@/components/shops/shop-ui", () => ({ ShopLink: ({ href, children }: { href: string; children: string }) => <a href={href}>{children}</a> }))

import { CheckoutPrepareLink } from "./checkout-prepare-link"
const i18n = createAppI18n({ locale: "fr", appResources: { fr: { checkout: fr }, en: { checkout: en } }, defaultNS: "checkout" })
const html = () => renderToStaticMarkup(<I18nextProvider i18n={i18n}><CheckoutPrepareLink handle="atelier" offerRef="offer-a" /></I18nextProvider>)
beforeEach(() => { mocks.error = false; mocks.available = true; mocks.quote = false; mocks.pending = null })
describe("entrée membre de préparation", () => {
  it("ouvre uniquement le parcours privé de l'offre localement admissible", () => {
    expect(html()).toContain(routes.checkoutPrepare("atelier", "offer-a"))
    expect(html()).toContain("Préparer une commande")
  })
  it("masque le lien sur refus, erreur ou offre sans montant exact", () => {
    mocks.available = false; expect(html()).toBe("")
    mocks.available = true; mocks.error = true; expect(html()).toBe("")
    mocks.error = false; mocks.quote = true; expect(html()).toBe("")
  })
  it("propose le suivi existant avant une nouvelle préparation", () => {
    mocks.pending = { attemptId: "already-pending" }
    expect(html()).toContain(routes.checkoutAttempt("already-pending"))
    expect(html()).not.toContain(routes.checkoutPrepare("atelier", "offer-a"))
  })
})
