// Dupliqué de socle/convex/modules/reseauPersonnel/domain.test.ts (l. 812-947) @ ad2e7fdc2 — adaptations : imports depuis ./groupThreads ; cas inchangés.
import { describe, expect, it } from "vitest"

import {
  canDeleteGroupThread,
  canInviteToGroupThread,
  canLeaveGroupThread,
  canRemoveGroupThreadMember,
  canRenameGroupThread,
  canSetGroupThreadRole,
  nextGroupThreadOwner,
} from "./groupThreads"

describe("administration d'un fil de groupe", () => {
  describe("canRenameGroupThread / canInviteToGroupThread", () => {
    it("le propriétaire et les administrateurs, pas les membres", () => {
      for (const role of ["owner", "admin"] as const) {
        expect(canRenameGroupThread(role), role).toBe(true)
        expect(canInviteToGroupThread(role), role).toBe(true)
      }
      expect(canRenameGroupThread("member")).toBe(false)
      expect(canInviteToGroupThread("member")).toBe(false)
    })
  })

  describe("canRemoveGroupThreadMember", () => {
    const cas = [
      { actorRole: "owner", targetRole: "member", isSelf: false, attendu: true },
      { actorRole: "owner", targetRole: "admin", isSelf: false, attendu: true },
      { actorRole: "admin", targetRole: "member", isSelf: false, attendu: true },
      // Un pair ne retire pas un pair.
      { actorRole: "admin", targetRole: "admin", isSelf: false, attendu: false },
      // Personne ne dépossède le propriétaire.
      { actorRole: "admin", targetRole: "owner", isSelf: false, attendu: false },
      { actorRole: "owner", targetRole: "owner", isSelf: false, attendu: false },
      // Un membre n'a d'autorité que sur lui-même.
      { actorRole: "member", targetRole: "member", isSelf: false, attendu: false },
      // Se retirer soi-même, c'est « quitter ».
      { actorRole: "owner", targetRole: "owner", isSelf: true, attendu: false },
      { actorRole: "admin", targetRole: "admin", isSelf: true, attendu: false },
    ] as const

    for (const c of cas) {
      it(`${c.actorRole} → ${c.targetRole}${c.isSelf ? " (soi)" : ""} = ${c.attendu}`, () => {
        expect(canRemoveGroupThreadMember({ actorRole: c.actorRole, targetRole: c.targetRole, isSelf: c.isSelf })).toBe(c.attendu)
      })
    }
  })

  describe("canSetGroupThreadRole", () => {
    it("le PROPRIÉTAIRE seul distribue l'administration", () => {
      expect(canSetGroupThreadRole({ actorRole: "owner", targetRole: "member", nextRole: "admin", isSelf: false })).toBe(true)
      expect(canSetGroupThreadRole({ actorRole: "admin", targetRole: "member", nextRole: "admin", isSelf: false })).toBe(false)
    })

    it("le rôle de propriétaire ne s'attribue ni ne se retire — il se TRANSMET", () => {
      expect(canSetGroupThreadRole({ actorRole: "owner", targetRole: "member", nextRole: "owner", isSelf: false })).toBe(false)
      expect(canSetGroupThreadRole({ actorRole: "owner", targetRole: "owner", nextRole: "admin", isSelf: false })).toBe(false)
    })

    it("un changement qui ne change rien est refusé", () => {
      expect(canSetGroupThreadRole({ actorRole: "owner", targetRole: "admin", nextRole: "admin", isSelf: false })).toBe(false)
    })
  })

  describe("nextGroupThreadOwner", () => {
    it("le plus ANCIEN des restants hérite", () => {
      const gagnant = nextGroupThreadOwner([
        { _id: "b", joinedAt: 300 },
        { _id: "a", joinedAt: 100 },
        { _id: "c", joinedAt: 200 },
      ])
      expect(gagnant?._id).toBe("a")
    })

    it("départage par identifiant à `joinedAt` ÉGAL", () => {
      const gagnant = nextGroupThreadOwner([
        { _id: "z", joinedAt: 100 },
        { _id: "a", joinedAt: 100 },
      ])
      expect(gagnant?._id).toBe("a")
    })

    it("rend null quand il ne reste personne — le fil se ferme", () => {
      expect(nextGroupThreadOwner([])).toBeNull()
    })
  })

  describe("canDeleteGroupThread / canLeaveGroupThread", () => {
    it("supprimer : le propriétaire, et lui seul ; quitter : tout le monde", () => {
      expect(canDeleteGroupThread("owner")).toBe(true)
      expect(canDeleteGroupThread("admin")).toBe(false)
      expect(canDeleteGroupThread("member")).toBe(false)
      expect(canLeaveGroupThread()).toBe(true)
    })
  })
})
