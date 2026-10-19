import { describe, expect, it } from "vitest"

import {
  COMMERCE_COMMAND_REJECTIONS,
  COMMERCE_COMMAND_SCOPES,
  COMMERCE_COMMAND_SUBJECTS,
  COMMERCE_CONSENT_PURPOSES,
  COMMERCE_MACHINES,
  COMMERCE_MAX_AMOUNT_XAF,
  COMMERCE_OPERATIONS,
  COMMERCE_PRIVATE_OBJECT_KINDS,
  COMMERCE_REF_KINDS,
  COMMERCE_RESERVED_COMMANDS,
  commerceBusinessRefFromRef,
  commerceCanonicalJson,
  commerceCapture,
  commerceCommandSigningInput,
  commerceIsoDate,
  commerceMachineStates,
  commerceMoney,
  commerceParseCanonicalBody,
  commerceRefFromBusinessRef,
  commerceScanJson,
  commerceShopPublicView,
  commerceSumAmounts,
  commerceText,
  commerceUtf8ByteLength,
  decideCommerceRetryAfterTimeout,
  deriveCommerceCapabilities,
  parseCommercePublicBody,
  type CommerceCapabilityInput,
  type CommerceLinkState,
  type CommerceMachine,
} from "./index"

const failure = (run: () => unknown) => {
  const result = commerceCapture(run)
  return result.ok ? { ok: true } : { ok: false, reason: result.reason, path: result.path }
}

describe("JSON canonique et octets", () => {
  it("trie les clés à toute profondeur, conserve l'ordre des tableaux, sans espace", () => {
    expect(commerceCanonicalJson({ b: [3, 1, { d: 1, c: "é" }], a: null, "é": true, A: false })).toBe('{"A":false,"a":null,"b":[3,1,{"c":"é","d":1}],"é":true}')
  })

  it("refuse les valeurs non représentables au lieu de les omettre", () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY, () => 1, cycle, { a: undefined }, [1, undefined]]) {
      expect(commerceCanonicalJson(value)).toBeNull()
    }
    expect(commerceCanonicalJson(-0)).toBe("0")
  })

  it("compte les octets UTF-8 comme l'encodeur, substituts isolés compris", () => {
    for (const text of ["", "abc", "é", "€", "🙂", "a\u{1F600}b", "\ud800", "\udc00x", "\ud800\ud800", "Libreville — 12 €"]) {
      expect(commerceUtf8ByteLength(text), JSON.stringify(text)).toBe(Buffer.byteLength(text, "utf8"))
    }
  })

  it("borne le corps en octets réels avant toute lecture", () => {
    const big = `{"a":"${"é".repeat(65 * 1024)}"}`
    expect(failure(() => commerceParseCanonicalBody(big, 128 * 1024))).toEqual({ ok: false, reason: "body_too_large", path: "$" })
    expect(parseCommercePublicBody(big, 0)).toMatchObject({ ok: false, reason: "body_too_large" })
  })

  it("parcours borné : champs, éléments, nœuds, longueur de clé", () => {
    const forbidden = new Set(["secret"])
    const wide = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`k${index}`, 1]))
    expect(failure(() => commerceScanJson(wide, forbidden, "$"))).toEqual({ ok: false, reason: "too_complex", path: "$" })
    expect(failure(() => commerceScanJson({ list: Array.from({ length: 257 }, () => 1) }, forbidden, "$"))).toEqual({ ok: false, reason: "too_complex", path: "$.list" })
    const many = { a: Array.from({ length: 8 }, () => Array.from({ length: 256 }, () => 0)) }
    expect(failure(() => commerceScanJson(many, forbidden, "$"))).toMatchObject({ ok: false, reason: "too_complex" })
    expect(failure(() => commerceScanJson({ ["k".repeat(101)]: 1 }, forbidden, "$"))).toMatchObject({ ok: false, reason: "invalid_payload" })
    expect(failure(() => commerceScanJson({ a: [{ b: { secret: 1 } }] }, forbidden, "$"))).toEqual({ ok: false, reason: "forbidden_field", path: "$.a[0].b.secret" })
  })
})

describe("Montants, textes, dates", () => {
  it("la devise est jugée avant le montant ; le franc CFA n'a pas de subdivision", () => {
    expect(failure(() => commerceMoney({ amount: 1.5, currency: "EUR" }, "$"))).toEqual({ ok: false, reason: "currency_mismatch", path: "$.currency" })
    expect(failure(() => commerceMoney({ amount: 1.5, currency: "XAF" }, "$"))).toEqual({ ok: false, reason: "invalid_amount", path: "$.amount" })
    expect(failure(() => commerceMoney({ amount: COMMERCE_MAX_AMOUNT_XAF, currency: "XAF" }, "$"))).toEqual({ ok: true })
    expect(failure(() => commerceMoney({ amount: "100", currency: "XAF" }, "$"))).toEqual({ ok: false, reason: "invalid_amount", path: "$.amount" })
  })

  it("somme entière sûre, sinon null", () => {
    expect(commerceSumAmounts([])).toBe(0)
    expect(commerceSumAmounts([25000, 56000, 1000])).toBe(82000)
    expect(commerceSumAmounts([Number.MAX_SAFE_INTEGER, 1])).toBeNull()
    expect(commerceSumAmounts([1.5])).toBeNull()
  })

  it("textes déjà normalisés : NFC, sans espace de bord, sans contrôle", () => {
    expect(failure(() => commerceText("Robe", "$", 1, 10))).toEqual({ ok: true })
    expect(failure(() => commerceText("Robe\n", "$", 1, 10, true))).toMatchObject({ reason: "invalid_text" })
    expect(failure(() => commerceText("a\nb", "$", 1, 10))).toMatchObject({ reason: "invalid_text" })
    expect(failure(() => commerceText("a\nb", "$", 1, 10, true))).toEqual({ ok: true })
    expect(failure(() => commerceText("é", "$", 1, 10))).toMatchObject({ reason: "invalid_text" })
    expect(failure(() => commerceText(12, "$", 1, 10))).toMatchObject({ reason: "invalid_payload" })
  })

  it("dates civiles existantes, années bissextiles comprises", () => {
    for (const ok of ["2028-02-29", "2000-02-29", "2026-12-31", "1970-01-01"]) expect(failure(() => commerceIsoDate(ok, "$")), ok).toEqual({ ok: true })
    for (const bad of ["2026-02-29", "2100-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "1969-12-31", "2026-1-01", 20261018]) {
      expect(failure(() => commerceIsoDate(bad, "$")), String(bad)).toMatchObject({ reason: "invalid_time" })
    }
  })
})

describe("Références", () => {
  it("bijection exacte référence métier ⟷ référence de transport pour chaque type", () => {
    for (const kind of COMMERCE_REF_KINDS) {
      const business = `pro.ga/${kind}/01JA00000000000000000000F1`
      const transport = commerceRefFromBusinessRef(business)
      expect(transport).toBe(`pro.ga:${kind}:01JA00000000000000000000F1`)
      expect(commerceBusinessRefFromRef(transport ?? "")).toBe(business)
    }
  })
})

describe("Registre des opérations", () => {
  it("un scope par opération, unique, préfixé, aucun nom réservé exécutable", () => {
    const scopes = COMMERCE_OPERATIONS.map((operation) => COMMERCE_COMMAND_SCOPES[operation])
    expect(new Set(scopes).size).toBe(COMMERCE_OPERATIONS.length)
    for (const operation of COMMERCE_OPERATIONS) expect(COMMERCE_COMMAND_SCOPES[operation]).toBe(`commerce.${operation}`)
    for (const reserved of COMMERCE_RESERVED_COMMANDS) expect(COMMERCE_OPERATIONS).not.toContain(reserved)
  })

  it("chaque opération a ses sujets admis et des refus fermés, indistincts en tête", () => {
    for (const operation of COMMERCE_OPERATIONS) {
      expect(COMMERCE_COMMAND_SUBJECTS[operation].length).toBeGreaterThan(0)
      expect(COMMERCE_COMMAND_REJECTIONS[operation]).toContain("access_denied")
      expect(COMMERCE_COMMAND_REJECTIONS[operation]).toContain("request_expired")
      expect([...COMMERCE_COMMAND_REJECTIONS[operation]].sort()).toEqual(COMMERCE_COMMAND_REJECTIONS[operation])
    }
  })

  it("toute commande qui engage la personne exige un consentement propre", () => {
    expect(Object.keys(COMMERCE_CONSENT_PURPOSES).sort()).toEqual(
      ["application.submit", "booking.request", "checkout.prepare", "inquiry.submit", "link.confirm", "payment.start", "quote.accept"],
    )
    expect(new Set(Object.values(COMMERCE_CONSENT_PURPOSES)).size).toBe(7)
  })

  it("profil COMMAND : neuf composants préfixés par leur longueur, étiquette propre", () => {
    const input = commerceCommandSigningInput({
      bodySha256: "a".repeat(64),
      environment: "production",
      issuedAtMs: 1792285200000,
      keyId: "antsia-production-commerce-k2",
      nonce: "Q1w2E3r4T5y6U7i8O9p0A1s2D3f4",
      operation: "payment.start",
      source: "antsia",
    })
    const parts = (input ?? "").split("|")
    expect(parts).toHaveLength(9)
    for (const part of parts) {
      const [length, ...rest] = part.split(":")
      expect(Number(length)).toBe(rest.join(":").length)
    }
    expect(parts[0]).toBe("31:pro-ga-commerce-command-hmac/v1")
    expect(parts[7]).toBe("22:commerce.payment.start")
  })

  it("après délai : renvoyer les mêmes octets jusqu'à l'expiration tolérée, jamais au-delà", () => {
    expect(decideCommerceRetryAfterTimeout("unknown", 1000, 1000 + 5 * 60 * 1000)).toBe("resend_same_bytes")
    expect(decideCommerceRetryAfterTimeout("unknown", 1000, 1001 + 5 * 60 * 1000)).toBe("safe_to_restart")
  })
})

describe("Projection anonyme d'une boutique", () => {
  it("sans référence de liaison, catégories rangées par position", () => {
    const raw = commerceCanonicalJson({
      contract: "PRO-COMMERCE-PUBLIC-V1",
      eventId: "pro-ga-evt-000001",
      objectRef: "pro.ga:structure:01JA00000000000000000000S1",
      payload: {
        capabilities: ["catalog"],
        changedAt: 1792281600000,
        collections: [
          { collectionRef: "pro.ga:offer_collection:01JA00000000000000000000C1", label: "Robes", position: 2 },
          { collectionRef: "pro.ga:offer_collection:01JA00000000000000000000C2", label: "Retouches", position: 0 },
        ],
        commercialName: "Atelier Fictif Nzeng",
        country: "GA",
        currency: "XAF",
        linkRef: "pro.ga:commerce_link:01JA00000000000000000000K1",
        revision: 1,
        sellerVerification: "unverified",
        shopRef: "pro.ga:structure:01JA00000000000000000000S1",
        type: "shop.published",
      },
      version: 1,
    })
    const parsed = parseCommercePublicBody(raw ?? "", 1792281600000)
    if (!parsed.ok || (parsed.value.payload.type !== "shop.published" && parsed.value.payload.type !== "shop.updated")) throw new Error("boutique refusée")
    const view = commerceShopPublicView(parsed.value.payload)
    expect(Object.keys(view)).not.toContain("linkRef")
    expect(view.collections.map((collection) => collection.label)).toEqual(["Retouches", "Robes"])
  })
})

describe("Machines d'état", () => {
  it("chaque cible est un état connu, aucune boucle sur soi, au moins un état terminal", () => {
    for (const machine of Object.keys(COMMERCE_MACHINES) as CommerceMachine[]) {
      const map = COMMERCE_MACHINES[machine] as Readonly<Record<string, readonly string[]>>
      const states = commerceMachineStates(machine)
      for (const [from, targets] of Object.entries(map)) {
        for (const to of targets) {
          expect(states, `${machine} ${from}→${to}`).toContain(to)
          expect(to, `${machine} ${from}`).not.toBe(from)
        }
      }
      expect(Object.values(map).some((targets) => targets.length === 0), machine).toBe(true)
    }
  })

  it("tout objet privé exposé par request.status a une machine", () => {
    expect(COMMERCE_PRIVATE_OBJECT_KINDS.length).toBe(10)
    for (const kind of COMMERCE_PRIVATE_OBJECT_KINDS) expect(COMMERCE_REF_KINDS).toContain(kind)
  })
})

describe("Capacités", () => {
  const links: (CommerceLinkState | null)[] = [null, "active", "pending", "suspended", "revoked"]
  const inputs: CommerceCapabilityInput[] = []
  for (const memberStatus of ["active", "none", "suspended"] as const) {
    for (const link of links) {
      for (const flags of Array.from({ length: 16 }, (_, index) => index)) {
        inputs.push({
          contactEnabled: (flags & 1) === 1,
          link,
          memberStatus,
          networkCommerceEnabled: (flags & 2) === 2,
          proShop: (flags & 8) === 8 ? null : { capabilities: ["booking", "catalog", "checkout", "jobs", "quote"], sellerVerification: "verified", state: "active" },
          shopRemoved: false,
          storefrontAdmitted: (flags & 4) === 4,
        })
      }
    }
  }

  it("chaque capacité exige la précédente : achat ⇒ vitrine ⇒ brouillon ; contact ⇒ vitrine", () => {
    for (const input of inputs) {
      const capabilities = deriveCommerceCapabilities(input)
      if (capabilities.purchase || capabilities.quote || capabilities.booking || capabilities.jobs || capabilities.catalog) {
        expect(capabilities.storefront).toBe(true)
        expect(input.link).toBe("active")
        expect(input.networkCommerceEnabled).toBe(true)
      }
      if (capabilities.storefront || capabilities.contact) expect(capabilities.draft).toBe(true)
      if (capabilities.contact) expect(capabilities.storefront).toBe(true)
      if (capabilities.draft) expect(input.memberStatus).toBe("active")
    }
  })
})
