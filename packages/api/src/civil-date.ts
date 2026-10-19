/** Dates civiles du lecteur : un fuseau explicite, jamais un décalage fixe. */
export const UTC_TIME_ZONE = "UTC"

const canonicalZones = new Map<string, string>()
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

/** Canonise une préférence valide ; une valeur absente ou invalide reste absente. */
export function canonicalTimeZone(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 100) return null
  const name = value.trim()
  const known = canonicalZones.get(name)
  if (known) return known
  try {
    const zone = new Intl.DateTimeFormat(undefined, { timeZone: name }).resolvedOptions().timeZone
    canonicalZones.set(name, zone)
    return zone
  } catch {
    return null
  }
}

/** Repli des consommateurs sans provider ; la détection React se fait après montage. */
export function browserTimeZone(): string {
  try {
    return canonicalTimeZone(new Intl.DateTimeFormat().resolvedOptions().timeZone) ?? UTC_TIME_ZONE
  } catch {
    return UTC_TIME_ZONE
  }
}

export function resolveViewerTimeZone(timeZone?: string): string {
  return canonicalTimeZone(timeZone) ?? browserTimeZone()
}

/** Cache par langue, fuseau et options : changer de préférence ne réutilise aucun ancien format. */
export function viewerDateFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions, timeZone?: string): Intl.DateTimeFormat {
  const zone = resolveViewerTimeZone(timeZone)
  const key = JSON.stringify([locale, zone, options])
  const known = dateFormatters.get(key)
  if (known) return known
  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone })
  dateFormatters.set(key, formatter)
  return formatter
}

/** Une panne d'Intl garde un repère UTC lisible au lieu de faire tomber l'écran. */
export function formatViewerDate(at: number, locale: string | undefined, options: Intl.DateTimeFormatOptions, timeZone?: string): string {
  if (!Number.isFinite(new Date(at).getTime())) return ""
  try {
    return viewerDateFormatter(locale, options, timeZone).format(at)
  } catch {
    return new Date(at).toISOString()
  }
}

export interface CivilDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const CIVIL_OPTIONS: Intl.DateTimeFormatOptions = {
  calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
}

/** Calendrier grégorien et chiffres latins : ces parties sont des clés, pas des textes d'interface. */
export function civilDateParts(at: number, timeZone?: string): CivilDateParts {
  try {
    const parts = viewerDateFormatter(undefined, CIVIL_OPTIONS, timeZone).formatToParts(at)
    const part = (kind: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === kind)?.value)
    return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") }
  } catch {
    const date = new Date(at)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() }
  }
}

export function civilDayKey(at: number, timeZone?: string): string {
  const { year, month, day } = civilDateParts(at, timeZone)
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function sameCivilDay(a: number, b: number, timeZone?: string): boolean {
  return civilDayKey(a, timeZone) === civilDayKey(b, timeZone)
}

/** Date.UTC traite 0…99 comme 1900…1999 ; setUTCFullYear conserve l'année saisie. */
function civilUtcMs(parts: CivilDateParts): number {
  const date = new Date(0)
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day)
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0)
  return date.getTime()
}

export function shiftCivilDay(key: string, days: number): string {
  const [year = 0, month = 0, day = 0] = key.split("-").map(Number)
  const date = new Date(civilUtcMs({ year, month, day, hour: 0, minute: 0, second: 0 }))
  date.setUTCDate(date.getUTCDate() + days)
  return civilDayKey(date.getTime(), UTC_TIME_ZONE)
}

export function isPreviousCivilDay(at: number, now: number, timeZone?: string): boolean {
  return civilDayKey(at, timeZone) === shiftCivilDay(civilDayKey(now, timeZone), -1)
}

export function tomorrowCivilDate(now: number, timeZone?: string): string {
  return shiftCivilDay(civilDayKey(now, timeZone), 1)
}

/**
 * Convertit une saisie civile en instant dans le fuseau choisi. Les décalages
 * candidats viennent d'Intl sur une fenêtre bornée de 97 heures autour de la
 * saisie : elle couvre les transitions DST et les sauts de journée. Chaque
 * candidat doit reproduire exactement la saisie ; un trou rend NaN, un
 * doublon choisit le premier instant. Aucun glissement silencieux de l'heure.
 */
export function civilDateTimeMs(date: string, time: string, timeZone?: string): number {
  if (timeZone !== undefined && canonicalTimeZone(timeZone) === null) return Number.NaN
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) return Number.NaN
  const desired: CivilDateParts = { year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]), hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: 0 }
  if (desired.year < 1 || desired.month < 1 || desired.month > 12 || desired.day < 1 || desired.day > 31 || desired.hour > 23 || desired.minute > 59) return Number.NaN
  const naive = civilUtcMs(desired)
  const normalized = new Date(naive)
  if (normalized.getUTCFullYear() !== desired.year || normalized.getUTCMonth() + 1 !== desired.month || normalized.getUTCDate() !== desired.day) return Number.NaN
  const zone = resolveViewerTimeZone(timeZone)
  // L'affichage peut se replier sur UTC ; une création ne doit pas prétendre
  // avoir converti le fuseau annoncé si le convertisseur est indisponible.
  try { viewerDateFormatter(undefined, CIVIL_OPTIONS, zone).formatToParts(naive) }
  catch { return Number.NaN }
  const offsets = new Set<number>()
  for (let hour = -48; hour <= 48; hour += 1) {
    const probe = naive + hour * 3_600_000
    offsets.add(civilUtcMs(civilDateParts(probe, zone)) - probe)
  }
  const candidates: number[] = []
  for (const offset of offsets) {
    const candidate = naive - offset
    const actual = civilDateParts(candidate, zone)
    if (actual.year === desired.year && actual.month === desired.month && actual.day === desired.day && actual.hour === desired.hour && actual.minute === desired.minute && actual.second === 0) candidates.push(candidate)
  }
  return candidates.length ? Math.min(...candidates) : Number.NaN
}
