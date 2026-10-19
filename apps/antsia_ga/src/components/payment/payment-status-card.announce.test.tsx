// @vitest-environment jsdom
/**
 * P18b (A18, WCAG 4.1.3) — le suivi d'un paiement annonce ses CHANGEMENTS
 * d'état par une région polie persistante, jamais au premier rendu ; la liste
 * compacte reste muette.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PaymentAttempt } from "@convex/modules/shops/paymentRules"

vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))

import { PaymentStatusCard } from "./payment-status-card"
import { paymentAttemptFixture, paymentTestI18n } from "./payment-fixtures.test-support"

const i18n = paymentTestI18n()
let root: Root
let container: HTMLDivElement

async function render(attempt: PaymentAttempt, compact = false) {
  await act(async () => root.render(<I18nextProvider i18n={i18n}><PaymentStatusCard attempt={attempt} compact={compact} /></I18nextProvider>))
}
const status = () => container.querySelector('[role="status"].sr-only')

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("annonce des changements d'état du paiement (P18b, A18)", () => {
  it("rien au premier rendu ; le passage à « réussi » s'annonce", async () => {
    await render(paymentAttemptFixture())
    expect(status()?.textContent).toBe("")

    await render(paymentAttemptFixture({ state: "succeeded", paymentState: "succeeded", revision: 4 }))
    expect(status()?.textContent).toBe(i18n.t("stateChanged", { state: i18n.t("attemptStates.succeeded") }))
  })

  it("un nouveau rendu du même état ne répète rien", async () => {
    await render(paymentAttemptFixture())
    await render(paymentAttemptFixture({ revision: 5 }))
    expect(status()?.textContent).toBe("")
  })

  it("la ligne compacte d'une liste ne porte aucune région d'annonce", async () => {
    await render(paymentAttemptFixture(), true)
    await render(paymentAttemptFixture({ state: "succeeded", paymentState: "succeeded" }), true)
    expect(status()).toBeNull()
  })
})
