import { describe, expect, it } from "vitest"

import { createAppI18n } from "./index"
import { formatClockTime } from "../features/iappel/call-timer"
import { dateDuGroupe } from "../features/messagerie/groupe-gestion"
import { bubbleTime, dayLabel, groupMessages } from "../features/messagerie/messagerie-bulles"
import { formatThreadTime } from "../features/messagerie/messagerie-liste"
import { localDateTimeMs, tomorrowLocalDate } from "../features/reseau-personnel/evenements-list"
import { claimSubmittedText } from "../features/reseau-personnel/profil-page"
import { formatRelativeDate } from "../features/reseau-personnel/shared"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const at = Date.UTC(2026, 7, 19, 22, 30)
const now = Date.UTC(2026, 7, 20, 8)

describe("les helpers sociaux respectent le fuseau personnel", () => {
  it("le jour d'une conversation et son heure suivent la même préférence", () => {
    expect(formatThreadTime(at, now, "fr", "Asia/Tokyo")).toBe("07:30")
    expect(formatThreadTime(at, now, "fr", "Africa/Libreville")).toBe("hier")
    expect(dayLabel(at, now, "fr", t, "Asia/Tokyo")).toBe("Aujourd'hui")
    expect(dayLabel(at, now, "fr", t, "Africa/Libreville")).toBe("Hier")
    expect(bubbleTime(at, "fr", "Asia/Tokyo")).toBe("07:30")
    expect(bubbleTime(at, "fr", "Africa/Libreville")).toBe("23:30")
  })

  it("un minuit personnel coupe les salves et les séparateurs, même sans changement de jour UTC", () => {
    const messages = [
      { id: "a", senderId: "me", createdAt: Date.UTC(2026, 7, 19, 14, 59) },
      { id: "b", senderId: "me", createdAt: Date.UTC(2026, 7, 19, 15, 1) },
    ]
    const options = { selfId: "me", now: Date.UTC(2026, 7, 19, 15, 10), locale: "fr" }
    const tokyo = groupMessages(messages, { ...options, timeZone: "Asia/Tokyo" }, t)
    const libreville = groupMessages(messages, { ...options, timeZone: "Africa/Libreville" }, t)
    expect(tokyo.filter((row) => row.kind === "date")).toHaveLength(2)
    expect(libreville.filter((row) => row.kind === "date")).toHaveLength(1)
    expect(tokyo.filter((row) => row.kind === "message" && row.first)).toHaveLength(2)
    expect(libreville.filter((row) => row.kind === "message" && row.first)).toHaveLength(1)
  })

  it("journal et dates de gestion utilisent le même jour civil", () => {
    expect(formatClockTime(at, now, "fr", t, "Asia/Tokyo")).toBe("07:30")
    expect(formatClockTime(at, now, "fr", t, "Africa/Libreville")).toBe("hier")
    expect(dateDuGroupe(at, false, "fr", "Asia/Tokyo")).toContain("20")
    expect(dateDuGroupe(at, false, "fr", "Africa/Libreville")).toContain("19")
    expect(claimSubmittedText(at, "fr", t, "Asia/Tokyo")).toContain("20 août 2026")
    expect(claimSubmittedText(at, "fr", t, "Africa/Libreville")).toContain("19 août 2026")
  })

  it("les dates absolues partagées suivent le fuseau, les durées relatives restent identiques", () => {
    const later = now + 10 * 86_400_000
    expect(formatRelativeDate(at, later, t, "Asia/Tokyo")).toContain("20")
    expect(formatRelativeDate(at, later, t, "Africa/Libreville")).toContain("19")
    expect(formatRelativeDate(now - 120_000, now, t, "Asia/Tokyo")).toBe(formatRelativeDate(now - 120_000, now, t, "Africa/Libreville"))
    expect(formatClockTime(now - 120_000, now, "fr", t, "Asia/Tokyo")).toBe(formatClockTime(now - 120_000, now, "fr", t, "Africa/Libreville"))
  })

  it("la composition d'évènement convertit le fuseau affiché et refuse le trou DST", () => {
    expect(tomorrowLocalDate(Date.UTC(2026, 2, 28, 22, 30), "Europe/Paris")).toBe("2026-03-29")
    expect(localDateTimeMs("2026-09-07", "10:00", "Asia/Tokyo")).toBe(Date.UTC(2026, 8, 7, 1))
    expect(localDateTimeMs("2026-03-29", "02:30", "Europe/Paris")).toBeNaN()
    expect(localDateTimeMs("2026-10-25", "02:30", "Europe/Paris")).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })

  it("l'année affichée dépend du calendrier personnel, pas de l'année de l'appareil", () => {
    const newYearNow = Date.UTC(2026, 11, 31, 11)
    const old = Date.UTC(2026, 11, 28, 12, 30)
    expect(formatClockTime(old, newYearNow, "fr", t, "Pacific/Kiritimati")).toContain("2026")
    expect(formatClockTime(old, newYearNow, "fr", t, "Pacific/Honolulu")).not.toContain("2026")
  })
})
