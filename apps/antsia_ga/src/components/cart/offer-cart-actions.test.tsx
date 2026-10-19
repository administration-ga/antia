// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appResources } from "@/i18n/resources"
import { routes } from "@/lib/routes"
import { cartDraftKey } from "@/lib/cart-draft"
import { catalogOfferFixture, OFFER_REF, VARIANT_REF } from "@/components/checkout/checkout-fixtures.test-support"
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-a", personId: "person-a" }) }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => children }))
import { OfferCartActions, OfferShareButton } from "./offer-cart-actions"
const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "cart" })
let root: Root, container: HTMLDivElement
async function render(children: ReactNode) { await act(async () => root.render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)) }
beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); sessionStorage.clear(); window.history.replaceState({}, "", "/"); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe("fiche offre vers panier et partage public", () => {
  it("exige la variante explicite puis persiste seulement les références et la quantité", async () => {
    await render(<OfferCartActions offer={catalogOfferFixture()} />)
    const form = container.querySelector("form")!
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(sessionStorage.getItem(cartDraftKey("network-a", "person-a"))).toBeNull()
    await act(async () => { const select = container.querySelector("select")!; select.value = VARIANT_REF; select.dispatchEvent(new Event("change", { bubbles: true })) })
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    const raw = sessionStorage.getItem(cartDraftKey("network-a", "person-a"))!
    expect(JSON.parse(raw).items).toEqual([{ offerRef: OFFER_REF, variantRef: VARIANT_REF, quantity: 1 }])
    expect(raw).not.toContain("Sac artisanal"); expect(raw).not.toContain("address"); expect(raw).not.toContain("consent")
  })
  it("ne crée pas de choix de prix pour une offre sur devis", async () => {
    await render(<OfferCartActions offer={catalogOfferFixture({ variants: [], price: { mode: "quote", currency: "XAF" } })} />)
    expect(container.querySelector("form")).toBeNull(); expect(container.textContent).toContain(i18n.t("quoteClosed"))
  })
  it("partage exclusivement l'offre publique sur l'origine configurée", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://social.example.test")
    const share = vi.fn().mockResolvedValue(undefined); vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { share }))
    window.history.replaceState({}, "", "/mes-achats/private?token=secret")
    await render(<OfferShareButton handle="atelier" offerRef={OFFER_REF} />)
    await act(async () => container.querySelector("button")!.click())
    expect(share).toHaveBeenCalledWith({ url: `https://social.example.test${routes.publicShopOffer("atelier", OFFER_REF)}` })
    expect(JSON.stringify(share.mock.calls)).not.toMatch(/mes-achats|token|secret|panier/)
    vi.unstubAllGlobals()
  })
})
