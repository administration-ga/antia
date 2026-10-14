// Dupliqué de socle/convex/modules/reseauPersonnel/domain.test.ts (l. 670-731) @ ad2e7fdc2 — adaptations : imports depuis ./thematicGroups ; `ReseauPersonnelViolation` → `DomainViolation`.
import { describe, expect, it } from "vitest"

import {
  assertThematicGroupDescription,
  assertThematicGroupName,
  canLeaveThematicGroup,
  canRemoveThematicGroupMember,
  canSetThematicGroupRole,
  isThematicGroupModerator,
  THEMATIC_GROUP_NAME_MAX_LENGTH,
  type ThematicGroupRole,
} from "./thematicGroups"
import { DomainViolation } from "./violation"

describe("nom et description d'un groupe", () => {
  it("le nom est borné, la description optionnelle", () => {
    expect(assertThematicGroupName("  Marchés publics  ")).toBe("Marchés publics")
    expect(() => assertThematicGroupName("ab")).toThrow(DomainViolation)
    expect(() => assertThematicGroupName("x".repeat(THEMATIC_GROUP_NAME_MAX_LENGTH + 1))).toThrow(DomainViolation)
    expect(assertThematicGroupDescription(undefined)).toBeUndefined()
    expect(assertThematicGroupDescription("   ")).toBeUndefined()
    expect(() => assertThematicGroupDescription("x".repeat(501))).toThrow(DomainViolation)
  })
})

describe("autorité dans un groupe thématique", () => {
  it("owner et moderator modèrent, member non", () => {
    expect(isThematicGroupModerator("owner")).toBe(true)
    expect(isThematicGroupModerator("moderator")).toBe(true)
    expect(isThematicGroupModerator("member")).toBe(false)
  })

  it("l'owner retire tout le monde sauf lui-même ; un modérateur, les seuls membres", () => {
    const cas = (actorRole: ThematicGroupRole, targetRole: ThematicGroupRole, isSelf = false) =>
      canRemoveThematicGroupMember({ actorRole, targetRole, isSelf })
    expect(cas("owner", "moderator")).toBe(true)
    expect(cas("owner", "member")).toBe(true)
    expect(cas("owner", "owner", true)).toBe(false)
    expect(cas("moderator", "member")).toBe(true)
    // Un modérateur ne retire NI un pair NI l'owner — l'autorité ne remonte pas.
    expect(cas("moderator", "moderator")).toBe(false)
    expect(cas("moderator", "owner")).toBe(false)
    expect(cas("member", "member")).toBe(false)
    // Se retirer soi-même passe par `leave`, jamais par cette voie.
    expect(cas("moderator", "moderator", true)).toBe(false)
  })

  it("le seul owner change les rôles, jamais sur un owner", () => {
    expect(canSetThematicGroupRole({ actorRole: "owner", targetRole: "member" })).toBe(true)
    expect(canSetThematicGroupRole({ actorRole: "owner", targetRole: "moderator" })).toBe(true)
    expect(canSetThematicGroupRole({ actorRole: "moderator", targetRole: "member" })).toBe(false)
    expect(canSetThematicGroupRole({ actorRole: "owner", targetRole: "owner" })).toBe(false)
  })

  it("l'owner ne quitte pas son groupe", () => {
    expect(canLeaveThematicGroup("owner")).toBe(false)
    expect(canLeaveThematicGroup("moderator")).toBe(true)
    expect(canLeaveThematicGroup("member")).toBe(true)
  })
})
