import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ isError: false, data: null as unknown }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { commerceLinks: { linkStatus: "status", revokeLink: "revoke" }, commerceLinkActions: { beginLink: "begin", completeLink: "complete" } } } } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ data: state.data, isError: state.isError, refetch: vi.fn() }) }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root", personId: "reader" }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useMutation: () => vi.fn(), useAction: () => vi.fn() }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }))

import ShopLinkReturnPage, { metadata } from "@/app/(membre)/mes-boutiques/liaison/retour/page"
import { ShopCommerceLink } from "./shop-commerce-link"

const shopId = "shop_fixture" as Parameters<typeof ShopCommerceLink>[0]["shopId"]
beforeEach(() => { state.isError = false; state.data = { available: true, reason: null, link: null, pending: null, consentTextVersion: "2026-10-18" } })

describe("Liaison volontaire PRO.GA — surface ANTSIA", () => {
  it("demande un accord décoché, sans inventer une structure PRO ni un paiement", () => {
    const html = renderToStaticMarkup(<ShopCommerceLink shopId={shopId} />)
    expect(html).toContain("link.consent")
    expect(html).toContain("link.permissions.catalog_drafts")
    expect(html).not.toMatch(/name="consent"[^>]*checked=""/)
    expect(html).not.toMatch(/structureBusinessRef|sessionId|codeVerifier|payment-button/)
  })
  it("ferme le départ vers PRO tant que la présentation n'est pas enregistrée", () => {
    const html = renderToStaticMarkup(<ShopCommerceLink shopId={shopId} dirty />)
    expect(html).toContain("link.saveFirst")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>link.begin<\/button>/)
  })
  it("une panne de lecture ne réaffiche pas une ancienne liaison", () => {
    state.isError = true
    state.data = { available: true, link: { state: "active", permissions: ["publish_catalog"] } }
    const html = renderToStaticMarkup(<ShopCommerceLink shopId={shopId} />)
    expect(html).toContain("link.loadError")
    expect(html).not.toContain("link.states.active")
    expect(html).not.toContain("link.begin")
  })
  it("le manque de configuration n'est pas une fausse connexion disponible", () => {
    state.data = { available: false, reason: "configuration_missing", link: null, pending: null }
    const html = renderToStaticMarkup(<ShopCommerceLink shopId={shopId} />)
    expect(html).toContain("link.unavailable")
    expect(html).not.toContain("link.begin")
  })
  it("une liaison locale active ne promet ni catalogue ni encaissement", () => {
    state.data = { available: true, reason: null, pending: null, link: { state: "active", permissions: ["publish_catalog"] } }
    const html = renderToStaticMarkup(<ShopCommerceLink shopId={shopId} />)
    expect(html).toContain("link.states.active")
    expect(html).toContain("link.noSales")
    expect(html).toContain("link.revoke")
    expect(html).not.toContain("link.begin")
  })
  it("le retour refuse les paramètres répétés ou hors grammaire et n'est pas indexable", async () => {
    const page = await ShopLinkReturnPage({ searchParams: Promise.resolve({ etat: ["a".repeat(43), "b".repeat(43)], code: "c".repeat(43), redirect: "https://foreign.example" }) })
    expect(page.props.state).toBeNull()
    expect(page.props.code).toBe("c".repeat(43))
    expect(page.props).not.toHaveProperty("redirect")
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe("no-referrer")
  })
})
