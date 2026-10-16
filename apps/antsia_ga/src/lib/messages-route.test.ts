import { describe, expect, it } from "vitest"

import { parseMessagesSegments } from "./messages-route"

describe("parseMessagesSegments — l'adresse de la messagerie vers son aiguillage", () => {
  it("la liste, les deux composeurs et une conversation", () => {
    expect(parseMessagesSegments([])).toEqual({})
    expect(parseMessagesSegments(["nouveau"])).toEqual({ compose: "personne" })
    expect(parseMessagesSegments(["nouveau-groupe"])).toEqual({ compose: "groupe" })
    expect(parseMessagesSegments(["chat", "abc123"])).toEqual({ kind: "chat", id: "abc123" })
    expect(parseMessagesSegments(["a", "awa.demo"])).toEqual({ kind: "a", id: "awa.demo" })
  })

  it("décode les segments une fois", () => {
    expect(parseMessagesSegments(["groupe", "x%20y"])).toEqual({ kind: "groupe", id: "x y" })
  })

  it("refuse toute autre forme (introuvable)", () => {
    expect(parseMessagesSegments(["inconnu"])).toBeNull()
    expect(parseMessagesSegments(["poste", "x"])).toBeNull()
    expect(parseMessagesSegments(["chat", "x", "y"])).toBeNull()
  })
})
