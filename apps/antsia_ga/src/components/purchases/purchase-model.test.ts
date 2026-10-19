import { describe, expect, it } from "vitest"
import { PURCHASE_COMMAND_DEFAULTS, purchaseCommandSchema } from "./purchase-model"
import { purchaseI18n } from "./purchase-fixtures.test-support"

const t = purchaseI18n().getFixedT("fr", "purchases")
describe("décisions privées explicites", () => {
  it("ne préaccepte jamais la réception et ferme les motifs inconnus", () => {
    expect(PURCHASE_COMMAND_DEFAULTS.accepted).toBe(false)
    expect(purchaseCommandSchema("receipt_confirm", t).safeParse(PURCHASE_COMMAND_DEFAULTS).success).toBe(false)
    expect(purchaseCommandSchema("receipt_confirm", t).safeParse({ ...PURCHASE_COMMAND_DEFAULTS, accepted: true }).success).toBe(true)
    expect(purchaseCommandSchema("cancel_request", t).safeParse({ ...PURCHASE_COMMAND_DEFAULTS, reason: "unknown" }).success).toBe(false)
    expect(purchaseCommandSchema("return_request", t).safeParse({ ...PURCHASE_COMMAND_DEFAULTS, reason: "damaged" }).success).toBe(true)
  })
  it("normalise le message sans accepter tabulations ni contrôles ni texte démesuré", () => {
    const schema = purchaseCommandSchema("support_message", t)
    expect(schema.parse({ ...PURCHASE_COMMAND_DEFAULTS, text: "  État ?\r\nMerci  " }).text).toBe("État ?\nMerci")
    for (const text of ["", "Bonjour\tici", "a\u0000b", "a".repeat(1001)]) expect(schema.safeParse({ ...PURCHASE_COMMAND_DEFAULTS, text }).success).toBe(false)
  })
})
