import { afterEach, describe, expect, it, vi } from "vitest"

import { browserTimeZone, canonicalTimeZone, civilDateParts, civilDateTimeMs, civilDayKey, formatViewerDate, isPreviousCivilDay, sameCivilDay, tomorrowCivilDate, viewerDateFormatter } from "./civil-date"

afterEach(() => vi.restoreAllMocks())

describe("préférence et calendrier du lecteur", () => {
  it("canonise un fuseau valide et laisse une préférence invalide absente", () => {
    expect(canonicalTimeZone(" Africa/Libreville ")).toBe("Africa/Libreville")
    expect(canonicalTimeZone("not/a-zone")).toBeNull()
    expect(canonicalTimeZone(" ")).toBeNull()
    expect(canonicalTimeZone(null)).toBeNull()
  })

  it("se replie sur UTC quand la détection Intl échoue", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => { throw new Error("Intl unavailable") })
    expect(browserTimeZone()).toBe("UTC")
    expect(canonicalTimeZone("unavailable/new-zone")).toBeNull()
  })

  it("le même instant change de jour et d'année avec la préférence", () => {
    const at = Date.UTC(2026, 11, 31, 12, 30)
    expect(civilDayKey(at, "Pacific/Kiritimati")).toBe("2027-01-01")
    expect(civilDayKey(at, "Pacific/Honolulu")).toBe("2026-12-31")
    expect(civilDateParts(at, "Pacific/Kiritimati").year).toBe(2027)
  })

  it("sépare deux instants autour du minuit du lecteur, même dans le même jour UTC", () => {
    const before = Date.UTC(2026, 7, 19, 14, 59)
    const after = Date.UTC(2026, 7, 19, 15, 1)
    expect(sameCivilDay(before, after, "Asia/Tokyo")).toBe(false)
    expect(sameCivilDay(before, after, "Africa/Libreville")).toBe(true)
  })

  it("hier demeure la veille civile à travers une journée de 23 heures", () => {
    const at = Date.UTC(2026, 2, 28, 23, 30)
    const now = Date.UTC(2026, 2, 29, 22, 30)
    expect(isPreviousCivilDay(at, now, "Europe/Paris")).toBe(true)
    expect(sameCivilDay(at, now, "Europe/Paris")).toBe(false)
  })

  it("demain est civil, sans ajout aveugle de 24 heures au passage été/hiver", () => {
    expect(tomorrowCivilDate(Date.UTC(2026, 2, 28, 22, 30), "Europe/Paris")).toBe("2026-03-29")
    expect(tomorrowCivilDate(Date.UTC(2026, 9, 24, 22, 30), "Europe/Paris")).toBe("2026-10-26")
    expect(tomorrowCivilDate(Date.UTC(2026, 11, 31, 12, 30), "Pacific/Kiritimati")).toBe("2027-01-02")
  })

  it("isole les caches par langue et fuseau", () => {
    const options = { hour: "2-digit", minute: "2-digit" } as const
    expect(viewerDateFormatter("fr", options, "Asia/Tokyo")).toBe(viewerDateFormatter("fr", options, "Asia/Tokyo"))
    expect(viewerDateFormatter("fr", options, "Asia/Tokyo")).not.toBe(viewerDateFormatter("fr", options, "Africa/Libreville"))
    expect(viewerDateFormatter("fr", options, "Asia/Tokyo")).not.toBe(viewerDateFormatter("en", options, "Asia/Tokyo"))
    expect(formatViewerDate(Date.UTC(2026, 7, 19, 8), "fr", options, "Asia/Tokyo")).toBe("17:00")
    expect(formatViewerDate(Date.UTC(2026, 7, 19, 8), "fr", options, "Africa/Libreville")).toBe("09:00")
  })
})

describe("conversion d'une saisie dans le fuseau choisi", () => {
  it("convertit les fuseaux éloignés et les décalages non entiers", () => {
    expect(civilDateTimeMs("2026-09-07", "10:00", "Africa/Libreville")).toBe(Date.UTC(2026, 8, 7, 9))
    expect(civilDateTimeMs("2026-09-07", "10:00", "Asia/Tokyo")).toBe(Date.UTC(2026, 8, 7, 1))
    expect(civilDateTimeMs("2026-09-07", "10:00", "Asia/Kathmandu")).toBe(Date.UTC(2026, 8, 7, 4, 15))
  })

  it("refuse les dates impossibles, heures débordantes et saisies incomplètes", () => {
    expect(civilDateTimeMs("2026-09-07", "10:00", "not/a-zone")).toBeNaN()
    for (const [date, time] of [["2026-02-30", "10:00"], ["2026-09-07", "24:00"], ["2026-09-07", "10:60"], ["2026-13-01", "10:00"], ["0000-01-01", "10:00"], ["", "10:00"], ["2026-09-07", ""]]) {
      expect(civilDateTimeMs(date!, time!, "UTC")).toBeNaN()
    }
  })

  it("refuse l'heure inexistante au passage à l'heure d'été", () => {
    expect(civilDateTimeMs("2026-03-29", "02:30", "Europe/Paris")).toBeNaN()
    expect(civilDateTimeMs("2026-03-29", "03:30", "Europe/Paris")).toBe(Date.UTC(2026, 2, 29, 1, 30))
  })

  it("choisit le premier instant au doublon de l'heure d'hiver", () => {
    expect(civilDateTimeMs("2026-10-25", "02:30", "Europe/Paris")).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })

  it("traite également les transitions de trente minutes", () => {
    expect(civilDateTimeMs("2026-10-04", "02:15", "Australia/Lord_Howe")).toBeNaN()
    expect(civilDateTimeMs("2026-04-05", "01:45", "Australia/Lord_Howe")).toBe(Date.UTC(2026, 3, 4, 14, 45))
  })

  it("refuse une journée civile supprimée, sans la décaler au lendemain", () => {
    expect(civilDateTimeMs("2011-12-30", "10:00", "Pacific/Apia")).toBeNaN()
  })

  it("conserve une année inférieure à cent", () => {
    const date = new Date(0)
    date.setUTCFullYear(42, 0, 1)
    date.setUTCHours(10, 0, 0, 0)
    expect(civilDateTimeMs("0042-01-01", "10:00", "UTC")).toBe(date.getTime())
  })
})
