/**
 * Présentation publique facultative d'une page : une ville, un type
 * d'association ou un secteur d'entreprise. La ville décrit une implantation,
 * jamais une adresse ni une coordonnée de contact. Les noms d'organisations
 * gardent leur casse ; ces règles ne normalisent aucune identité de personne.
 */
import type { PageOwnerKind } from "./badges"
import { DomainViolation } from "./violation"

export const PAGE_CITY_MAX_LENGTH = 120

export const PAGE_ASSOCIATION_TYPES = ["cultural", "sports", "religious", "professional", "solidarity", "education", "youth", "women", "student", "other"] as const
export type PageAssociationType = (typeof PAGE_ASSOCIATION_TYPES)[number]

export const PAGE_COMPANY_SECTORS = ["food", "services", "retail", "tech", "transport", "health", "beauty", "other"] as const
export type PageCompanySector = (typeof PAGE_COMPANY_SECTORS)[number]

/** Ville facultative : une seule ligne, espaces resserrés et accents conservés. */
export function normalizePageCity(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined
  if (/[\p{Cc}\u2028\u2029]/u.test(raw)) throw new DomainViolation("PAGE_CITY_INVALID")
  const city = raw.normalize("NFC").trim().replace(/\s+/gu, " ")
  if (city.length === 0) return undefined
  if (city.length > PAGE_CITY_MAX_LENGTH) throw new DomainViolation("PAGE_CITY_TOO_LONG", { max: PAGE_CITY_MAX_LENGTH })
  const looksLikeContact = /\S@\S/u.test(city) || /(?:\b[a-z][a-z\d+.-]*:\/\/|\bwww\.)/iu.test(city)
  const looksLikePhone = /(?:\+?\d[\s().-]*){7,}/u.test(city)
  if (looksLikeContact || looksLikePhone) throw new DomainViolation("PAGE_CITY_INVALID")
  return city
}

/** Un type ne peut qualifier qu'une association ; vide retire cette précision. */
export function normalizePageAssociationType(ownerKind: PageOwnerKind, raw: string | null | undefined): PageAssociationType | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (ownerKind !== "association" || !(PAGE_ASSOCIATION_TYPES as readonly string[]).includes(value)) throw new DomainViolation("PAGE_ASSOCIATION_TYPE_INVALID")
  return value as PageAssociationType
}

/** Un secteur ne peut qualifier qu'une entreprise ; vide retire cette précision. */
export function normalizePageSector(ownerKind: PageOwnerKind, raw: string | null | undefined): PageCompanySector | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (ownerKind !== "company" || !(PAGE_COMPANY_SECTORS as readonly string[]).includes(value)) throw new DomainViolation("PAGE_SECTOR_INVALID")
  return value as PageCompanySector
}
