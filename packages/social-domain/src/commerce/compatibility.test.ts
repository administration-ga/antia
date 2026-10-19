import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { normalizeFamilyName, normalizeGivenNames } from "../civilName"
import {
  FEDERATION_BODY_MAX_BYTES,
  FEDERATION_ENVIRONMENTS,
  FEDERATION_IMPLEMENTED_CONTRACTS,
  FEDERATION_IMPLEMENTED_EVENTS,
  FEDERATION_MAX_SKEW_MS,
  FEDERATION_PAYLOAD_MAX_DEPTH,
  FEDERATION_PAYLOAD_MAX_FIELDS,
  FEDERATION_PAYLOAD_MAX_ITEMS,
  FEDERATION_PAYLOAD_MAX_NODES,
  FEDERATION_STRING_MAX_LENGTH,
  federationSigningText,
  parseFederationEnvelope,
  validFederationContract,
  validFederationEmitter,
  validFederationReference,
} from "../federationProtocol"
import { PAGE_NAME_MAX_LENGTH } from "../pages"
import {
  COMMERCE_BODY_MAX_BYTES,
  COMMERCE_COMMAND_CONTRACT,
  COMMERCE_ENVIRONMENTS,
  COMMERCE_JSON_MAX_DEPTH,
  COMMERCE_JSON_MAX_FIELDS,
  COMMERCE_JSON_MAX_ITEMS,
  COMMERCE_JSON_MAX_NODES,
  COMMERCE_MAX_SKEW_MS,
  COMMERCE_PUBLIC_CONTRACT,
  COMMERCE_PUBLIC_EVENT_TYPES,
  COMMERCE_PUBLIC_LIMITS,
  COMMERCE_REF_KINDS,
  COMMERCE_STRING_MAX_LENGTH,
  COMMERCE_TRANSPORT_FORBIDDEN_FIELDS,
  commerceCanonicalJson,
  commerceNormalizeFamilyName,
  commerceNormalizeGivenNames,
  commercePublicSigningText,
  parseCommercePublicBody,
} from "./index"

/**
 * Compatibilité avec l'inbox ANTSIA EXISTANTE (FEDERATION-INBOX-V1), sans la
 * modifier : toute projection admise par le contrat commercial passe la garde
 * générique du transport, et le contrat est plus strict qu'elle, jamais plus
 * permissif.
 */
const HERE = fileURLToPath(new URL("./", import.meta.url))
type PublicCase = { name: string; body?: unknown; rawBody?: string; nowMs: number; expect: { ok: boolean }; antsiaTransport?: string }
const publicCases = (JSON.parse(readFileSync(join(HERE, "fixtures/public-events.json"), "utf8")) as { cases: PublicCase[] }).cases
const rawOf = (entry: PublicCase): string => entry.rawBody ?? commerceCanonicalJson(entry.body) ?? ""

describe("PRO-COMMERCE-PUBLIC-V1 × FEDERATION-INBOX-V1", () => {
  it("bornes, environnements et tolérance d'horloge identiques à l'inbox", () => {
    expect(COMMERCE_BODY_MAX_BYTES).toBe(FEDERATION_BODY_MAX_BYTES)
    expect(COMMERCE_JSON_MAX_DEPTH).toBe(FEDERATION_PAYLOAD_MAX_DEPTH)
    expect(COMMERCE_JSON_MAX_NODES).toBe(FEDERATION_PAYLOAD_MAX_NODES)
    expect(COMMERCE_JSON_MAX_ITEMS).toBe(FEDERATION_PAYLOAD_MAX_ITEMS)
    expect(COMMERCE_JSON_MAX_FIELDS).toBe(FEDERATION_PAYLOAD_MAX_FIELDS)
    expect(COMMERCE_STRING_MAX_LENGTH).toBe(FEDERATION_STRING_MAX_LENGTH)
    expect(COMMERCE_MAX_SKEW_MS).toBe(FEDERATION_MAX_SKEW_MS)
    expect([...COMMERCE_ENVIRONMENTS]).toEqual([...FEDERATION_ENVIRONMENTS])
  })

  it("les noms de contrat respectent la grammaire du registre des émetteurs", () => {
    expect(validFederationContract(COMMERCE_PUBLIC_CONTRACT)).toBe(true)
    expect(validFederationContract(COMMERCE_COMMAND_CONTRACT)).toBe(true)
    expect(validFederationEmitter("pro-ga")).toBe(true)
  })

  it("chaque projection admise passe la garde générique de l'inbox, octets exacts", () => {
    const admitted = publicCases.filter((entry) => entry.expect.ok)
    expect(admitted.length).toBeGreaterThan(10)
    for (const entry of admitted) {
      const transport = parseFederationEnvelope(rawOf(entry))
      expect(transport.ok, entry.name).toBe(true)
      expect(parseCommercePublicBody(rawOf(entry), entry.nowMs).ok, entry.name).toBe(true)
    }
  })

  it("issue attendue de la garde générique pour chaque cas qui la déclare", () => {
    const declared = publicCases.filter((entry) => entry.antsiaTransport !== undefined)
    expect(declared.length).toBeGreaterThan(20)
    for (const entry of declared) {
      const transport = parseFederationEnvelope(rawOf(entry))
      expect(transport.ok ? "accepted" : transport.reason, entry.name).toBe(entry.antsiaTransport)
    }
  })

  it("une charge admise par la garde générique peut rester refusée par le contrat (plus strict)", () => {
    const stricter = publicCases.filter((entry) => entry.antsiaTransport === "accepted" && !entry.expect.ok)
    expect(stricter.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "SKU interne imbriqué dans une variante",
      "enveloppe PRO.GA transmise brute comme charge",
      "clés hors ordre canonique",
    ]))
  })

  it("chaque clé interdite du contrat est aussi refusée par l'inbox, à toute profondeur", () => {
    for (const key of COMMERCE_TRANSPORT_FORBIDDEN_FIELDS) {
      const raw = `{"contract":"PRO-COMMERCE-PUBLIC-V1","eventId":"pro-ga-evt-000001","objectRef":"pro.ga:offer:01JA00000000000000000000F1","payload":{"nested":[{${JSON.stringify(key)}:1}]},"version":1}`
      const transport = parseFederationEnvelope(raw)
      expect(transport.ok ? "accepted" : transport.reason, key).toBe("forbidden_payload_field")
    }
  })

  it("toute référence de transport commerciale est un objectRef valide, sans barre oblique", () => {
    for (const kind of COMMERCE_REF_KINDS) {
      const ref = `pro.ga:${kind}:01JA00000000000000000000F1`
      expect(validFederationReference(ref), kind).toBe(true)
      expect(validFederationReference(`pro.ga/${kind}/01JA00000000000000000000F1`), kind).toBe(false)
    }
  })

  it("profil PUBLIC : le texte signé est celui de l'inbox, inchangé", () => {
    const raw = rawOf(publicCases[0] as PublicCase)
    expect(commercePublicSigningText("sandbox", "1792285200", raw)).toBe(federationSigningText("sandbox", "1792285200", raw))
    expect(commercePublicSigningText("production", "1792285200", raw)).toBe(federationSigningText("production", "1792285200", raw))
  })

  it("l'inbox applique PUBLIC-V1 (handler P09) pour les seuls genres du contrat ; COMMAND-V1 n'est jamais un contrat d'inbox", () => {
    // K-07 (finitions) : depuis P09, `federation/reseauPublic.ts` route PUBLIC-V1 vers `applyCommerceCatalog`
    // (P15 y ajoute les postes `job.*`). COMMAND-V1 reste un échange requête/réponse signé, jamais une
    // enveloppe reçue : une enveloppe COMMAND finit en lettre morte `unsupported_contract`.
    expect(FEDERATION_IMPLEMENTED_CONTRACTS).toContain(COMMERCE_PUBLIC_CONTRACT)
    expect(FEDERATION_IMPLEMENTED_CONTRACTS).not.toContain(COMMERCE_COMMAND_CONTRACT)
    expect([...FEDERATION_IMPLEMENTED_EVENTS[COMMERCE_PUBLIC_CONTRACT]].sort()).toEqual([...COMMERCE_PUBLIC_EVENT_TYPES].sort())
  })

  it("le nom commercial d'une boutique tient dans le nom d'une page", () => {
    expect(COMMERCE_PUBLIC_LIMITS.shopNameMax).toBe(PAGE_NAME_MAX_LENGTH)
  })
})

describe("Noms civils — copie du normaliseur partagé ANTSIA", () => {
  type NameCase = { firstName: string; lastName: string }
  const corpus = (JSON.parse(readFileSync(join(HERE, "fixtures/names.json"), "utf8")) as { normalize: NameCase[] }).normalize
  const extra = [
    "jean-rémy éloïse", "JEAN-RÉMY", "  anne   d’arc ", "ʻeleʻele", "straße", "ÇA VA", "o'neill-ndong", "Ève-marie nzé",
    "élodie", "ﬁlomène", "ı̇smail", "Ἀθηνᾶ", "", " ", "a-", "-a", "'",
  ]

  it("donne exactement les mêmes formes que civilName.ts", () => {
    for (const raw of [...corpus.flatMap((entry) => [entry.firstName, entry.lastName]), ...extra]) {
      expect(commerceNormalizeGivenNames(raw), raw).toBe(normalizeGivenNames(raw))
      expect(commerceNormalizeFamilyName(raw), raw).toBe(normalizeFamilyName(raw))
    }
  })
})
