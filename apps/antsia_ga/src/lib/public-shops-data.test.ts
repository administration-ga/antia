import { getFunctionName } from "convex/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ query: vi.fn(), viewer: vi.fn() }))
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.query }))
vi.mock("./server-session", () => ({ getServerViewer: mocks.viewer, withinBridgeDeadline: (work: () => Promise<unknown>) => work(), configuredMetadataOrigin: () => "https://antsia.ga" }))

import { loadPublicStorefront, publicStorefrontSchema } from "./public-shops-data"

const storefront = { handle: "atelier", name: "Atelier partagé", description: "Une présentation commerciale publique.", logoUrl: null, bannerUrl: null, model: "products", specialty: "Artisanat", serviceArea: "Libreville", hours: null, badge: "community", blocks: ["about"], publishedAt: 1_700_000_000_000, origin: { slug: "antsia", name: "ANTSIA" } }

beforeEach(() => {
  mocks.query.mockReset()
  mocks.viewer.mockReset()
  mocks.viewer.mockResolvedValue({ status: "anonymous" })
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://localhost:3210")
})

describe("vitrine publique — projection fermée et porte de session partagée", () => {
  it("ne requête rien pour un transfert en attente ni une session refusée", async () => {
    expect(await loadPublicStorefront("atelier", true)).toEqual({ status: "handoff" })
    expect(mocks.viewer).not.toHaveBeenCalled()
    mocks.viewer.mockResolvedValue({ status: "refused" })
    expect(await loadPublicStorefront("atelier")).toEqual({ status: "refused" })
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it("ne rabaisse pas une panne de résolution de session en visite anonyme", async () => {
    mocks.viewer.mockResolvedValue({ status: "unavailable" })
    expect(await loadPublicStorefront("atelier")).toEqual({ status: "unavailable" })
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it("transmet racine et jeton uniquement à la projection dédiée, puis valide le DTO", async () => {
    mocks.viewer.mockResolvedValue({ status: "authenticated", token: "TEST-JWT" })
    mocks.query.mockImplementation(async (reference, args, options) => {
      if (getFunctionName(reference).endsWith(":getBySlug")) return { _id: "root-test" }
      expect(getFunctionName(reference)).toBe("modules/public/shops:getStorefront")
      expect(args).toEqual({ networkId: "root-test", handle: "atelier" })
      expect(options.token).toBe("TEST-JWT")
      return storefront
    })
    expect(await loadPublicStorefront("atelier")).toEqual({ status: "ready", data: storefront, viewer: "authenticated" })
  })

  it("refuse tout champ privé, y compris dans l’origine, au lieu de le transmettre au SSR", async () => {
    expect(publicStorefrontSchema.safeParse(storefront).success).toBe(true)
    for (const extra of [{ pageId: "private" }, { shopId: "private" }, { signatories: ["private"] }, { contact: "private@example.test" }, { viewer: { manages: true } }]) {
      expect(publicStorefrontSchema.safeParse({ ...storefront, ...extra }).success).toBe(false)
    }
    expect(publicStorefrontSchema.safeParse({ ...storefront, origin: { ...storefront.origin, signatoryPersonId: "private" } }).success).toBe(false)
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : { ...storefront, contact: "private@example.test" })
    expect(await loadPublicStorefront("atelier")).toEqual({ status: "unavailable" })
  })

  it("admet les images nulles, refuse les schémas actifs, les identifiants d’URL et les modèles non ouverts", () => {
    for (const url of ["javascript:alert(1)", "data:image/svg+xml,private", "https://user:pass@media.example/logo.jpg"]) {
      expect(publicStorefrontSchema.safeParse({ ...storefront, logoUrl: url }).success).toBe(false)
      expect(publicStorefrontSchema.safeParse({ ...storefront, bannerUrl: url }).success).toBe(false)
    }
    expect(publicStorefrontSchema.safeParse({ ...storefront, logoUrl: "https://media.example/logo.jpg" }).success).toBe(true)
    expect(publicStorefrontSchema.safeParse({ ...storefront, model: "appointments" }).success).toBe(false)
  })

  it("conserve un retrait indistinct sous null et un refus métier sans son motif privé", async () => {
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : null)
    expect(await loadPublicStorefront("retired")).toEqual({ status: "ready", data: null, viewer: "anonymous" })
    mocks.query.mockImplementation(async (reference) => {
      if (getFunctionName(reference).endsWith(":getBySlug")) return { _id: "root-test" }
      throw { data: { code: "membershipSuspended", privateReason: "never shown" } }
    })
    expect(await loadPublicStorefront("retired")).toEqual({ status: "refused" })
  })
})
