// Dupliqué de socle/convex/modules/iappel/capacity.test.ts @ ad2e7fdc2 — adaptations : plafond constant du moteur — les cas de configuration d'organisation, d'exemption du back-office et de capacité des réunions partent avec leur code ; « la ligne fait foi » gardé, bornes [3, 11] et valeurs illisibles ajoutées (le clampage du socle vivait dans `resolveGroupCallCapacity`).
import { describe, expect, it } from "vitest"

import { GROUP_CALL_FLOOR, photographedGroupCallCapacity } from "./capacity"

describe("photographedGroupCallCapacity — la ligne fait foi, bornée", () => {
  it("relit la capacité photographiée ; une ligne sans valeur vaut le plafond", () => {
    expect(photographedGroupCallCapacity(7)).toBe(7)
    expect(photographedGroupCallCapacity(11)).toBe(11)
    expect(photographedGroupCallCapacity(undefined)).toBe(11)
  })

  it("une valeur aberrante ne rend pas l'appel impossible ni ne l'ouvre sans limite", () => {
    expect(photographedGroupCallCapacity(1)).toBe(GROUP_CALL_FLOOR)
    expect(photographedGroupCallCapacity(1000)).toBe(11)
    expect(photographedGroupCallCapacity(7.9)).toBe(7)
    expect(photographedGroupCallCapacity(Number.NaN)).toBe(11)
  })

  it("un appel de groupe réunit au moins trois personnes, appelant compris", () => {
    expect(GROUP_CALL_FLOOR).toBe(3)
  })
})
