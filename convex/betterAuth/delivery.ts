/** PA4 — courriels via Resend et SMS via relais HTTP authentifié configuré par le propriétaire. */
import { otpMessage } from "@antsia/social-contracts/authentication"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { Resend } from "@convex-dev/resend"
import { APIError } from "better-auth/api"
import type { GenericCtx } from "@convex-dev/better-auth"

import { components, internal } from "../_generated/api"
import type { DataModel } from "../_generated/dataModel"
import { devToolsAllowed } from "../lib/devTools"
import { smsConfiguration } from "./settings"

function unavailable(): never {
  throw new APIError("SERVICE_UNAVAILABLE", { message: "otpDeliveryUnavailable", code: "otpDeliveryUnavailable" })
}

export async function deliverOtp(ctx: GenericCtx<DataModel>, channel: "email" | "phone", identifier: string, code: string): Promise<void> {
  if (!("runMutation" in ctx)) return unavailable()
  if (devToolsAllowed()) {
    await ctx.runMutation(internal.modules.platform.devTools.recordOtp, { email: identifier, code, expiresAt: Date.now() + 300_000 })
    return
  }
  const message = otpMessage(process.env.AUTH_DEFAULT_LOCALE, BRAND_NAME, code)
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_ADDRESS?.trim()) return unavailable()
    try {
      // Le composant Resend expose encore la signature Convex sans l'option
      // transactionLimits ajoutée au contexte 1.45 ; même méthode à l'exécution.
      await new Resend(components.resend, { testMode: false }).sendEmail(ctx as unknown as Parameters<Resend["sendEmail"]>[0], { from: process.env.RESEND_FROM_ADDRESS, to: identifier, ...message })
      return
    } catch { return unavailable() }
  }
  const sms = smsConfiguration()
  if (!sms) return unavailable()
  try {
    const result = await fetch(sms.endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sms.apiKey}` },
      body: JSON.stringify({ to: identifier, text: message.text, type: "otp", ttlSeconds: 300 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) return unavailable()
  } catch { return unavailable() }
}
