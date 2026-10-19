import { COMMERCE_ORDER_CANCEL_REASONS, COMMERCE_ORDER_RETURN_REASONS } from "@antsia/social-domain/commerce-orders"
import type { TFunction } from "i18next"
import { z } from "zod"

export type PurchaseCommand = "cancel_request" | "receipt_confirm" | "return_request" | "support_message"
export function purchaseCommandSchema(kind: PurchaseCommand, t: TFunction) {
  return z.object({ accepted: z.boolean(), reason: z.string(), text: z.string().transform((value) => value.normalize("NFC").replace(/\r\n?/g, "\n").trim()) }).superRefine((value, ctx) => {
    if (kind === "receipt_confirm" && !value.accepted) ctx.addIssue({ code: "custom", path: ["accepted"], message: t("validationConsent") })
    if (kind === "cancel_request" && !(COMMERCE_ORDER_CANCEL_REASONS as readonly string[]).includes(value.reason) || kind === "return_request" && !(COMMERCE_ORDER_RETURN_REASONS as readonly string[]).includes(value.reason)) ctx.addIssue({ code: "custom", path: ["reason"], message: t("validationReason") })
    if (kind === "support_message" && (!value.text || value.text.length > 1000 || /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/u.test(value.text))) ctx.addIssue({ code: "custom", path: ["text"], message: t("validationMessage") })
  })
}
export type PurchaseCommandValues = z.input<ReturnType<typeof purchaseCommandSchema>>
export const PURCHASE_COMMAND_DEFAULTS: PurchaseCommandValues = { accepted: false, reason: "", text: "" }
