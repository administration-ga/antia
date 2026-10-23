import { describe, expect, it } from "vitest"

import { librevilleDay, todaysSpecialRef } from "./dailySpecial"

describe("plat du jour", () => {
  it("compte le jour à l'heure de Libreville (UTC+1, sans heure d'été)", () => {
    expect(librevilleDay(Date.UTC(2026, 9, 23, 22, 59))).toBe("2026-10-23")
    expect(librevilleDay(Date.UTC(2026, 9, 23, 23, 0))).toBe("2026-10-24")
    expect(librevilleDay(Date.UTC(2026, 6, 1, 22, 30))).toBe("2026-07-01")
  })

  it("n'annonce que le plat désigné aujourd'hui", () => {
    const special = { offerRef: "offer:menu:1", day: "2026-10-23" }
    expect(todaysSpecialRef(special, Date.UTC(2026, 9, 23, 6))).toBe("offer:menu:1")
    expect(todaysSpecialRef(special, Date.UTC(2026, 9, 23, 23, 30))).toBeNull()
    expect(todaysSpecialRef(special, Date.UTC(2026, 9, 22, 22, 59))).toBeNull()
    expect(todaysSpecialRef(null, Date.UTC(2026, 9, 23, 6))).toBeNull()
    expect(todaysSpecialRef(undefined, Date.UTC(2026, 9, 23, 6))).toBeNull()
  })
})
