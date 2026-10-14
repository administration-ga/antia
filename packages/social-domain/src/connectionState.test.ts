/**
 * État d'une demande de relation projeté pour UN lecteur — sans test dédié au
 * socle (couvert indirectement, annexe A1 §2.5) : ce test le fixe en propre.
 */
import { describe, expect, it } from "vitest"

import { CONNECTION_STATUSES, pendingStateOf } from "./connectionState"

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
