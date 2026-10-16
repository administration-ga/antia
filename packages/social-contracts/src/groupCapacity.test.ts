// Dupliqué de socle/convex/lib/groupCapacity.test.ts @ ad2e7fdc2 — adaptations : cas d'appel de groupe non administratifs seulement (exemption du back-office et réglage d'organisation retirés) ; cas neufs pour les bornes du titre, de la description et de la composition d'un fil.
import { DomainViolation } from "@antsia/social-domain/violation"
import { describe, expect, it } from "vitest"

import {
  assertGroupComposition,
  assertGroupHasRoom,
  assertGroupTitle,
  callCapacityOf,
  GROUP_CALL_DEFAULT_MAX_PARTICIPANTS,
  GROUP_CALL_MAX_OTHERS,
  GROUP_CALL_MIN_PARTICIPANTS,
  GROUP_MEMBERS_MAX,
  normalizeGroupDescription,
} from "./groupCapacity"

function ruleOf(run: () => unknown): string | null {
  try {
    run()
  } catch (error) {
    return error instanceof DomainViolation ? error.code : "autre"
  }
  return null
}

describe("le plafond d'appel — onze, appelant compris", () => {
  it("vaut onze, et dix correspondants", () => {
    expect(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS).toBe(11)
    expect(GROUP_CALL_MAX_OTHERS).toBe(10)
  })

  it("garde son ordre : minimum < défaut < structure", () => {
    expect(GROUP_CALL_MIN_PARTICIPANTS).toBeLessThan(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS)
    expect(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS).toBeLessThan(GROUP_MEMBERS_MAX)
  })
})

describe("callCapacityOf — la capacité est une propriété DE L'APPEL", () => {
  it("rend le plafond figé par l'hôte au lancement", () => {
    expect(callCapacityOf({ maxParticipants: 5 })).toBe(5)
  })

  it("replie sur le défaut pour un appel sans plafond posé", () => {
    expect(callCapacityOf({})).toBe(11)
    expect(callCapacityOf({ maxParticipants: 0 })).toBe(11)
    expect(callCapacityOf(null)).toBe(11)
  })
})

describe("les bornes d'un fil de groupe", () => {
  it("un titre compte entre 1 et 120 caractères, espaces retirés", () => {
    expect(assertGroupTitle("  Famille  ")).toBe("Famille")
    expect(ruleOf(() => assertGroupTitle("   "))).toBe("GROUP_NAME_LENGTH")
    expect(ruleOf(() => assertGroupTitle("x".repeat(121)))).toBe("GROUP_NAME_LENGTH")
  })

  it("une description blanche se retire, une description trop longue se refuse", () => {
    expect(normalizeGroupDescription("  Entraide  ")).toBe("Entraide")
    expect(normalizeGroupDescription("   ")).toBeNull()
    expect(normalizeGroupDescription(null)).toBeNull()
    expect(ruleOf(() => normalizeGroupDescription("x".repeat(501)))).toBe("GROUP_DESCRIPTION_TOO_LONG")
  })

  it("au moins deux autres personnes, au plus le plafond créateur compris ; plus de place au plafond", () => {
    expect(ruleOf(() => assertGroupComposition(1))).toBe("GROUP_TOO_FEW_MEMBERS")
    expect(ruleOf(() => assertGroupComposition(2))).toBeNull()
    expect(ruleOf(() => assertGroupComposition(GROUP_MEMBERS_MAX - 1))).toBeNull()
    expect(ruleOf(() => assertGroupComposition(GROUP_MEMBERS_MAX))).toBe("GROUP_FULL")
    expect(ruleOf(() => assertGroupHasRoom(GROUP_MEMBERS_MAX - 1))).toBeNull()
    expect(ruleOf(() => assertGroupHasRoom(GROUP_MEMBERS_MAX))).toBe("GROUP_FULL")
  })
})
