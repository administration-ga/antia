import { DomainViolation } from "@antsia/social-domain/violation"
import { describe, expect, it } from "vitest"

import { assertMessageContent, deletedAccountReply, isWithinEditWindow, MESSAGE_EDIT_WINDOW_MS, MESSAGE_MAX_LENGTH } from "./messaging"

describe("contenu d'un message", () => {
  it("vide seulement avec des pièces ; borné ; nettoyé", () => {
    expect(assertMessageContent("  bonjour ", false)).toBe("bonjour")
    expect(assertMessageContent("  ", true)).toBe("")
    expect(() => assertMessageContent(" ", false)).toThrow(DomainViolation)
    expect(() => assertMessageContent("x".repeat(MESSAGE_MAX_LENGTH + 1), false)).toThrow(DomainViolation)
  })

  it("la fenêtre d'édition : ouverte quinze minutes, close après", () => {
    expect(isWithinEditWindow(0, MESSAGE_EDIT_WINDOW_MS)).toBe(true)
    expect(isWithinEditWindow(0, MESSAGE_EDIT_WINDOW_MS + 1)).toBe(false)
  })

  it("citation d'un compte effacé : aucun identifiant, aucune recopie de contenu", () => {
    expect(deletedAccountReply()).toEqual({ messageId: null, senderPersonId: null, excerpt: "", deleted: true, authorDeleted: true })
  })
})
