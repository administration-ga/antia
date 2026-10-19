/**
 * P14 : instants et fuseaux des rendez-vous, sans dépendance.
 *
 * Un créneau est un INSTANT (millisecondes UTC) servi par PRO.GA dans le fuseau de l'agenda
 * (`Africa/Libreville`, UTC+1 sans heure d'été). La personne peut l'afficher dans son propre
 * fuseau, qui peut en avoir une : une heure murale saisie y peut ne PAS exister (avance d'une
 * heure) ou exister DEUX fois (recul d'une heure). Ce module ne devine jamais : il rend zéro,
 * un ou deux instants, et l'écran le dit.
 */

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/u
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/u

export type ZonedWallTime = {
  /** `AAAA-MM-JJ` dans le fuseau. */
  readonly date: string
  /** `HH:MM` sur 24 heures dans le fuseau. */
  readonly time: string
  /** Décalage du fuseau à cet instant, en minutes (UTC+1 → 60). */
  readonly offsetMinutes: number
}

/** Un identifiant IANA reconnu par le moteur d'exécution ; jamais une abréviation ambiguë devinée. */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0 || timeZone.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0")
}

/** L'heure murale d'un instant dans un fuseau, avec le décalage en vigueur à cet instant. */
export function zonedWallTime(instant: number, timeZone: string): ZonedWallTime | null {
  if (!Number.isSafeInteger(instant) || !isValidTimeZone(timeZone)) return null
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant))
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? Number.NaN)
  const year = read("year"), month = read("month"), day = read("day"), hour = read("hour"), minute = read("minute"), second = read("second")
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const wholeSecond = Math.floor(instant / 1000) * 1000
  return { date: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`, time: `${pad(hour, 2)}:${pad(minute, 2)}`, offsetMinutes: Math.round((wallAsUtc - wholeSecond) / MINUTE_MS) }
}

/**
 * Les instants qui affichent exactement cette heure murale dans ce fuseau, triés : aucun
 * (heure sautée, ou date/heure invalide), un, ou deux (heure répétée au retour d'heure).
 */
export function wallTimeInstants(date: string, time: string, timeZone: string): number[] {
  const day = DATE.exec(date), clock = TIME.exec(time)
  if (!day || !clock || !isValidTimeZone(timeZone)) return []
  const year = Number(day[1]), month = Number(day[2]), dayOfMonth = Number(day[3])
  const naive = Date.UTC(year, month - 1, dayOfMonth, Number(clock[1]), Number(clock[2]))
  const check = new Date(naive)
  // Le 30 février n'existe dans aucun fuseau.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== dayOfMonth) return []
  // Les décalages en vigueur autour de l'heure visée couvrent un éventuel changement d'heure.
  const offsets = new Set<number>()
  for (const probe of [naive - DAY_MS, naive, naive + DAY_MS]) {
    const wall = zonedWallTime(probe, timeZone)
    if (wall) offsets.add(wall.offsetMinutes)
  }
  const instants = new Set<number>()
  for (const offset of offsets) {
    const candidate = naive - offset * MINUTE_MS
    const wall = zonedWallTime(candidate, timeZone)
    if (wall && wall.date === date && wall.time === time) instants.add(candidate)
  }
  return [...instants].sort((a, b) => a - b)
}

/** `UTC+01:00`, `UTC−03:30` : la forme sans ambiguïté d'un décalage, pour départager deux instants. */
export function formatUtcOffset(offsetMinutes: number): string {
  if (!Number.isSafeInteger(offsetMinutes)) return "UTC"
  const sign = offsetMinutes < 0 ? "−" : "+"
  const absolute = Math.abs(offsetMinutes)
  return `UTC${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`
}

/** Deux fuseaux affichent-ils la même heure murale à cet instant (même décalage) ? */
export function sameWallClock(instant: number, first: string, second: string): boolean {
  const a = zonedWallTime(instant, first), b = zonedWallTime(instant, second)
  return a !== null && b !== null && a.offsetMinutes === b.offsetMinutes
}
