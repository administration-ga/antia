/**
 * État d'une demande de relation projeté pour UN lecteur — sans test dédié au
 * socle (couvert indirectement, annexe A1 §2.5) : ce test le fixe en propre.
 */
import { describe, expect, it } from "vitest"

import { canonicalPair, CONNECTION_STATUSES, pendingStateOf, viewConnection } from "./connectionState"

const row = { personIdLow: "a", personIdHigh: "b", requestedByPersonId: "a", status: "requested" as const }

describe("pendingStateOf", () => {
  it("une ligne absente rend « missing », jamais une erreur", () => {
    expect(pendingStateOf(null, "a")).toEqual({ status: "missing", iAmRecipient: false })
  })

  it("rend null au lecteur qui n'est pas partie à la connexion", () => {
    expect(pendingStateOf(row, "c")).toBeNull()
  })

  it("distingue l'auteur de la demande et son destinataire", () => {
    expect(pendingStateOf(row, "a")).toEqual({ status: "requested", iAmRecipient: false })
    expect(pendingStateOf(row, "b")).toEqual({ status: "requested", iAmRecipient: true })
  })

  it("porte l'état vivant de la ligne", () => {
    expect([...CONNECTION_STATUSES]).toEqual(["requested", "accepted", "declined", "blocked"])
    expect(pendingStateOf({ ...row, status: "accepted" }, "b")?.status).toBe("accepted")
  })
})

describe("paire canonique et vue d'une relation (portés de socle/convex/tests/reseauConnections.test.ts)", () => {
  it("les deux sens donnent la même clé", () => {
    expect(canonicalPair("b", "a")).toEqual({ low: "a", high: "b" })
    expect(canonicalPair("a", "b")).toEqual({ low: "a", high: "b" })
  })

  const base = { _id: "c1", personIdLow: "a", personIdHigh: "b", requestedByPersonId: "a", requestedAt: 10 }

  it("absence de relation → none", () => {
    expect(viewConnection(null, "a")).toEqual({ state: "none" })
  })

  it("distingue demandeur et destinataire, avec le message pour le destinataire", () => {
    const row = { ...base, status: "requested" as const, message: "Bonjour" }
    expect(viewConnection(row, "a")).toEqual({ state: "requested_by_me", connectionId: "c1" })
    expect(viewConnection(row, "b")).toEqual({ state: "requested_by_them", connectionId: "c1", message: "Bonjour" })
  })

  it("une relation acceptée sans respondedAt retombe sur requestedAt", () => {
    expect(viewConnection({ ...base, status: "accepted" as const }, "b")).toEqual({ state: "connected", connectionId: "c1", since: 10 })
    expect(viewConnection({ ...base, status: "accepted" as const, respondedAt: 20 }, "b")).toEqual({ state: "connected", connectionId: "c1", since: 20 })
  })

  it("le bloqué voit `none`, son auteur `blocked_by_me` ; un refus se dit `declined`", () => {
    const blocked = { ...base, status: "blocked" as const, blockedByPersonId: "b" }
    expect(viewConnection(blocked, "a")).toEqual({ state: "none" })
    expect(viewConnection(blocked, "b")).toEqual({ state: "blocked_by_me", connectionId: "c1" })
    expect(viewConnection({ ...base, status: "declined" as const }, "a")).toEqual({ state: "declined", connectionId: "c1" })
  })
})
