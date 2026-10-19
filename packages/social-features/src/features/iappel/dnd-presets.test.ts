// PA6 : une échéance civile suit le lecteur ; une durée reste absolue.
import { MAX_DND_DURATION_MS } from "@antsia/social-contracts/calls"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DND_DURATION_PILLS, tomorrowAt8 } from "./dnd-presets"

afterEach(() => vi.useRealTimers())

describe("demain à huit heures dans le fuseau du lecteur", () => {
  it.each([
    ["Asia/Tokyo", "2026-10-17T16:30:00Z", "2026-10-18T23:00:00Z"],
    ["America/New_York", "2026-10-17T16:30:00Z", "2026-10-18T12:00:00Z"],
    ["Asia/Tokyo", "2026-12-31T16:30:00Z", "2027-01-01T23:00:00Z"],
    ["America/New_York", "2026-12-31T16:30:00Z", "2027-01-01T13:00:00Z"],
  ])("%s : demain est le prochain jour local, même à la frontière du jour ou de l’année", (timeZone, now, expected) => {
    expect(tomorrowAt8(Date.parse(now), timeZone)).toBe(Date.parse(expected))
  })

  it.each([
    ["2026-03-07T13:00:00Z", "2026-03-08T12:00:00Z", 23],
    ["2026-10-31T12:00:00Z", "2026-11-01T13:00:00Z", 25],
  ])("New York : les transitions d’heure gardent 08:00 plutôt qu’une durée de 24 h", (now, expected, hours) => {
    const target = tomorrowAt8(Date.parse(now as string), "America/New_York")
    expect(target).toBe(Date.parse(expected as string))
    expect(target - Date.parse(now as string)).toBe(Number(hours) * 3_600_000)
  })

  it("la signature sans fuseau conserve le repli appareil", () => {
    const now = Date.parse("2026-10-17T12:30:00Z")
    const localTarget = new Date(now)
    localTarget.setDate(localTarget.getDate() + 1)
    localTarget.setHours(8, 0, 0, 0)
    expect(tomorrowAt8(now)).toBe(localTarget.getTime())
  })
})

describe("pastilles de durée du silence", () => {
  it("la pastille demain calcule son instant au clic dans le fuseau fourni", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-17T16:30:00Z"))
    const pill = DND_DURATION_PILLS.find((value) => value.labelKey === "iappel:dndPresets.tomorrowMorning")
    expect(pill?.computeUntil("Asia/Tokyo")).toBe(Date.parse("2026-10-18T23:00:00Z"))
    expect(pill?.computeUntil("America/New_York")).toBe(Date.parse("2026-10-18T12:00:00Z"))
    vi.setSystemTime(new Date("2026-10-18T16:30:00Z"))
    expect(pill?.computeUntil("Asia/Tokyo")).toBe(Date.parse("2026-10-19T23:00:00Z"))
  })

  it.each([
    ["iappel:dndPresets.thirtyMinutes", 30 * 60_000],
    ["iappel:dndPresets.oneHour", 60 * 60_000],
    ["iappel:dndPresets.twoHours", 120 * 60_000],
    ["iappel:dndPresets.untilDisabled", MAX_DND_DURATION_MS],
  ] as const)("%s reste une durée absolue, indépendante des fuseaux et du DST", (labelKey, duration) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const now = Date.parse("2026-03-07T13:00:00Z")
    vi.setSystemTime(now)
    const pill = DND_DURATION_PILLS.find((value) => value.labelKey === labelKey)
    expect(pill?.computeUntil("Asia/Tokyo")).toBe(now + duration)
    expect(pill?.computeUntil("America/New_York")).toBe(now + duration)
    vi.setSystemTime(now + 60_000)
    expect(pill?.computeUntil("America/New_York")).toBe(now + 60_000 + duration)
  })
})
