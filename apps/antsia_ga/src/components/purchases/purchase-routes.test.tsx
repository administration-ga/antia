import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
vi.mock("@/i18n/server", () => ({ getAppT: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/cart/cart-screen", () => ({ CartScreen: () => <div data-cart="" /> }))
vi.mock("@/components/purchases/purchases-screen", () => ({ PurchasesScreen: () => <div data-purchases="" />, PurchaseScreen: ({ purchaseId }: { purchaseId: string }) => <div data-purchase={purchaseId} /> }))
import CartPage, { generateMetadata as cartMetadata } from "@/app/(membre)/panier/page"
import PurchasesPage, { generateMetadata as purchasesMetadata } from "@/app/(membre)/mes-achats/page"
import PurchasePage, { generateMetadata as purchaseMetadata } from "@/app/(membre)/mes-achats/[purchaseId]/page"

describe("routes privées P13", () => {
  it("garde des métadonnées génériques noindex sans commande, personne ou référence", () => {
    for (const metadata of [cartMetadata(), purchasesMetadata(), purchaseMetadata()]) {
      expect(metadata.robots).toEqual({ index: false, follow: false })
      expect(JSON.stringify(metadata)).not.toContain("private-purchase")
      expect(metadata).not.toHaveProperty("openGraph")
    }
  })
  it("branche le vrai panier, la liste et le suivi avec un identifiant décodé une seule fois", async () => {
    expect(renderToStaticMarkup(<CartPage />)).toContain("data-cart")
    expect(renderToStaticMarkup(<PurchasesPage />)).toContain("data-purchases")
    expect(renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ purchaseId: "private%2Dpurchase" }) }))).toContain('data-purchase="private-purchase"')
  })
})
