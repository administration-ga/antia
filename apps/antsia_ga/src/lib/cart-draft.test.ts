import { describe, expect, it } from "vitest"
import { addCartItem, CART_DRAFT_TTL_MS, cartDraftKey, cartIntentDigest, parseCartDraft, readCartDraft, writeCartDraft, type CartDraft } from "./cart-draft"

const now = Date.UTC(2026, 9, 18, 12)
const owner = { networkId: "network-a", personId: "person-a" }
const item = { offerRef: "pro.ga:offer:01JA00000000000000000000F1", quantity: 2 }
const draft = (): CartDraft => ({ version: 1, ...owner, handle: "atelier", items: [item], submitted: null, updatedAt: now })

describe("brouillon privé borné du panier", () => {
  it("expire à 24 heures, refuse un autre acteur/réseau et une date future", () => {
    const raw = JSON.stringify(draft())
    expect(parseCartDraft(raw, owner.networkId, owner.personId, now + CART_DRAFT_TTL_MS - 1)).not.toBeNull()
    for (const args of [[owner.networkId, owner.personId, now + CART_DRAFT_TTL_MS], ["other", owner.personId, now], [owner.networkId, "other", now], [owner.networkId, owner.personId, now - 1]] as const) {
      // Une union de tuples ne s'étale pas sur des paramètres fixes : chaque position est nommée.
      const [networkId, personId, at] = args
      expect(parseCartDraft(raw, networkId, personId, at)).toBeNull()
    }
    expect(cartDraftKey("a/b", "c:d")).toBe("antsia:cart:a%2Fb:c%3Ad")
  })
  it("n'admet aucun contact, adresse, accord ou jeton dans le stockage", () => {
    for (const field of ["address", "consent", "note", "token"]) expect(parseCartDraft(JSON.stringify({ ...draft(), [field]: "private" }), owner.networkId, owner.personId, now)).toBeNull()
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    expect(writeCartDraft(storage, draft(), now)).toBe(true)
    expect(readCartDraft(storage, owner.networkId, owner.personId, now + CART_DRAFT_TTL_MS)).toBeNull()
    expect(values.size).toBe(0)
  })
  it("ne mélange pas les vendeurs, borne dix lignes et quantités sans somme silencieuse", () => {
    expect(addCartItem(draft(), owner, "autre", item, now)).toEqual({ ok: false, reason: "different_seller" })
    expect(addCartItem(draft(), owner, "atelier", { ...item, quantity: 998 }, now)).toEqual({ ok: false, reason: "invalid" })
    const full = { ...draft(), items: Array.from({ length: 10 }, (_, index) => ({ ...item, offerRef: `pro.ga:offer:offer${index}` })) }
    expect(addCartItem(full, owner, "atelier", item, now)).toEqual({ ok: false, reason: "full" })
    expect(parseCartDraft(JSON.stringify({ ...draft(), items: [item, item] }), owner.networkId, owner.personId, now)).toBeNull()
  })
  it("l'empreinte change avec adresse, prix ou politique et reste canonique sans conserver leur contenu", async () => {
    const input = { clientRequestId: "request-test-opaque", lines: [{ quantity: 2, amount: 1000 }], expectedPolicyVersion: 1, fulfillment: { line1: "Adresse privée" } }
    const digest = await cartIntentDigest(input)
    expect(digest).toMatch(/^[a-f0-9]{64}$/)
    expect(await cartIntentDigest({ fulfillment: input.fulfillment, expectedPolicyVersion: 1, lines: input.lines, clientRequestId: input.clientRequestId })).toBe(digest)
    for (const changed of [{ ...input, expectedPolicyVersion: 2 }, { ...input, fulfillment: { line1: "Autre adresse" } }, { ...input, lines: [{ quantity: 2, amount: 1100 }] }]) expect(await cartIntentDigest(changed)).not.toBe(digest)
    const frozen: CartDraft = { ...draft(), submitted: { clientRequestId: input.clientRequestId, digest: digest!, submittedAt: now, expectedPolicyVersion: 1, expectedLines: [{ ...item, expectedCatalogRevision: 3, expectedUnitAmount: { amount: 1000, currency: "XAF" } }] } }
    expect(addCartItem(frozen, owner, "atelier", item, now)).toEqual({ ok: false, reason: "submitted" })
    expect(JSON.stringify(frozen)).not.toContain("Adresse privée")
  })
})
