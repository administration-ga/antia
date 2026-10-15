// Dupliqué de socle/convex/modules/iappel/preferences.test.ts (l. 305-334, bornes des réponses rapides) @ ad2e7fdc2 — adaptations : la règle de nettoyage est désormais PURE (`normalizeQuickReplies`), testée sans backend ; cas ajouté : l'ordre (dédoublonner AVANT de tronquer).
import { describe, expect, it } from "vitest"

import { CALL_RING_WINDOW_MS, MAX_QUICK_REPLIES, MAX_QUICK_REPLY_LENGTH, normalizeQuickReplies, PRESENCE_FRESHNESS_MS, PRESENCE_HEARTBEAT_INTERVAL_MS } from "./calls"

describe("normalizeQuickReplies — bornes en nombre et en longueur", () => {
  it("retire les vides, rogne les blancs, dédoublonne", () => {
    expect(normalizeQuickReplies(["  Je rappelle  ", "", "   ", "Je rappelle", "En route"])).toEqual(["Je rappelle", "En route"])
  })

  it("garde au plus six réponses, chacune au plus 120 caractères", () => {
    const many = Array.from({ length: 10 }, (_, index) => `Réponse ${index}`)
    expect(normalizeQuickReplies(many)).toHaveLength(MAX_QUICK_REPLIES)
    expect(normalizeQuickReplies(["x".repeat(500)])[0]).toHaveLength(MAX_QUICK_REPLY_LENGTH)
  })

  it("dédoublonne AVANT de tronquer : deux réponses distinctes ne fusionnent pas en silence", () => {
    const longA = `${"a".repeat(MAX_QUICK_REPLY_LENGTH)}1`
    const longB = `${"a".repeat(MAX_QUICK_REPLY_LENGTH)}2`
    // Toutes deux gardées (tronquées à l'identique, mais aucune n'a été retirée par un dédoublonnage aveugle).
    expect(normalizeQuickReplies([longA, longB])).toHaveLength(2)
  })
})

describe("fenêtres de temps", () => {
  it("la présence tient trois battements manqués ; la sonnerie dure deux minutes", () => {
    expect(PRESENCE_FRESHNESS_MS).toBe(3 * PRESENCE_HEARTBEAT_INTERVAL_MS)
    expect(CALL_RING_WINDOW_MS).toBe(120_000)
  })
})
