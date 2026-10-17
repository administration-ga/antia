/**
 * Casse des champs civils déjà structurés : prénom(s) et patronyme.
 * Aucun découpage d'un nom social libre ni réécriture d'une organisation,
 * d'un document certifié ou d'un claim d'identité.
 */
export type CivilNameParts = {
  readonly firstName: string
  readonly lastName: string
}

/** Les séparateurs restent intacts, y compris tirets insécables et apostrophes modificatrices. */
const GIVEN_NAME_SEPARATORS = /([ \p{Pd}'‘’ʻʼ]+)/u

function canonicalSpaces(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/gu, " ")
}

function capitalizeSegment(segment: string): string {
  const [initial, ...rest] = Array.from(segment)
  if (initial === undefined) return ""
  const [capital, ...expansion] = Array.from(initial.toLocaleUpperCase("fr"))
  // Une capitale peut s'étendre : « ß » devient « Ss », pas « SS » dans un prénom.
  return `${capital ?? ""}${expansion.join("").toLocaleLowerCase("fr")}${rest.join("")}`
}

/** Une initiale majuscule par segment ; accents et ponctuation conservés sans translittération. */
export function normalizeGivenNames(raw: string): string {
  return canonicalSpaces(raw)
    .toLocaleLowerCase("fr")
    .split(GIVEN_NAME_SEPARATORS)
    .map((part, index) => index % 2 === 0 ? capitalizeSegment(part) : part)
    .join("")
    .normalize("NFC")
}

/** Patronyme en capitales françaises, sous forme Unicode NFC. */
export function normalizeFamilyName(raw: string): string {
  return canonicalSpaces(raw).toLocaleUpperCase("fr").normalize("NFC")
}

/** Rend une nouvelle paire, sans modifier les champs reçus. */
export function normalizeCivilName(parts: CivilNameParts): CivilNameParts {
  return {
    firstName: normalizeGivenNames(parts.firstName),
    lastName: normalizeFamilyName(parts.lastName),
  }
}
