/** P14 — instants, fuseaux et heures d'été. Écrit, NON exécuté (décision du propriétaire du 18/10/2026). */
import { describe, expect, it } from "vitest"

import { formatUtcOffset, isValidTimeZone, sameWallClock, wallTimeInstants, zonedWallTime } from "./serviceTime"

describe("P14 — fuseau de l'agenda (Africa/Libreville, sans heure d'été)", () => {
  it("une heure murale = un seul instant, décalage constant UTC+1 toute l'année", () => {
    expect(wallTimeInstants("2026-10-25", "02:30", "Africa/Libreville")).toEqual([Date.UTC(2026, 9, 25, 1, 30)])
    expect(wallTimeInstants("2026-03-29", "02:30", "Africa/Libreville")).toEqual([Date.UTC(2026, 2, 29, 1, 30)])
    expect(zonedWallTime(Date.UTC(2026, 0, 1, 12), "Africa/Libreville")).toEqual({ date: "2026-01-01", time: "13:00", offsetMinutes: 60 })
    expect(zonedWallTime(Date.UTC(2026, 6, 1, 12), "Africa/Libreville")?.offsetMinutes).toBe(60)
  })
})

describe("P14 — fuseau de la personne avec heure d'été", () => {
  it("heure sautée au passage à l'heure d'été : aucun instant, jamais deviné", () => {
    expect(wallTimeInstants("2026-03-29", "02:30", "Europe/Paris")).toEqual([])
    expect(wallTimeInstants("2026-03-08", "02:15", "America/New_York")).toEqual([])
  })
  it("heure répétée au retour à l'heure d'hiver : deux instants, triés, départagés par leur décalage", () => {
    const instants = wallTimeInstants("2026-10-25", "02:30", "Europe/Paris")
    expect(instants).toEqual([Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)])
    expect(instants.map((instant) => formatUtcOffset(zonedWallTime(instant, "Europe/Paris")?.offsetMinutes ?? 0))).toEqual(["UTC+02:00", "UTC+01:00"])
    expect(wallTimeInstants("2026-11-01", "01:30", "America/New_York")).toHaveLength(2)
  })
  it("heure ordinaire : un instant, aller-retour exact", () => {
    const [instant] = wallTimeInstants("2026-10-20", "09:45", "Europe/Paris")
    expect(instant).toBe(Date.UTC(2026, 9, 20, 7, 45))
    expect(zonedWallTime(instant!, "Europe/Paris")).toMatchObject({ date: "2026-10-20", time: "09:45", offsetMinutes: 120 })
  })
  it("un même instant affiché dans deux fuseaux garde le même instant", () => {
    const instant = Date.UTC(2026, 9, 20, 8)
    expect(zonedWallTime(instant, "Africa/Libreville")?.time).toBe("09:00")
    expect(zonedWallTime(instant, "Europe/Paris")?.time).toBe("10:00")
    expect(sameWallClock(instant, "Africa/Libreville", "Africa/Lagos")).toBe(true)
    expect(sameWallClock(instant, "Africa/Libreville", "Europe/Paris")).toBe(false)
    expect(sameWallClock(Date.UTC(2026, 0, 20, 8), "Africa/Libreville", "Europe/Paris")).toBe(true)
  })
})

describe("P14 — entrées invalides", () => {
  it("date, heure ou fuseau invalides : aucun instant", () => {
    expect(wallTimeInstants("2026-02-30", "10:00", "Africa/Libreville")).toEqual([])
    expect(wallTimeInstants("2026-10-20", "24:00", "Africa/Libreville")).toEqual([])
    expect(wallTimeInstants("20-10-2026", "10:00", "Africa/Libreville")).toEqual([])
    expect(wallTimeInstants("2026-10-20", "10:00", "Afrique/Libreville")).toEqual([])
    expect(isValidTimeZone("")).toBe(false)
    expect(isValidTimeZone("Africa/Libreville")).toBe(true)
    expect(zonedWallTime(Number.NaN, "Africa/Libreville")).toBeNull()
  })
  it("décalage écrit sans ambiguïté", () => {
    expect(formatUtcOffset(60)).toBe("UTC+01:00")
    expect(formatUtcOffset(-210)).toBe("UTC−03:30")
    expect(formatUtcOffset(0)).toBe("UTC+00:00")
  })
})
