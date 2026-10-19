// @vitest-environment edge-runtime
/**
 * P16 — avertissement avant effacement (tests ÉCRITS, NON EXÉCUTÉS ; décision du propriétaire du
 * 18/10/2026 « Continuer sans vérifier »). L'effacement d'un compte n'annule pas les rendez-vous
 * chez PRO.GA : la personne voit seulement le NOMBRE de SES rendez-vous encore tenus et à venir.
 */
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

const NOW = Date.UTC(2026, 9, 19, 9)
const HOUR = 3_600_000, DAY = 24 * HOUR
const upcoming = makeFunctionReference<"query", Record<string, never>, { count: number; truncated: boolean }>("modules/shops/serviceLifecycle:myUpcomingBookings")

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

type BookingState = "requested" | "confirmed" | "cancelled_by_client"
function booking(state: BookingState, startAt: number) {
  return {
    appointmentRef: "pro.ga:appointment:01JA00000000000000000000A1", serviceRef: "pro.ga:agenda_service:01JA00000000000000000000V1",
    serviceLabel: "Coupe", resourceLabel: null, startAt, endAt: startAt + HOUR, timeZone: "Africa/Libreville" as const, state,
    holdExpiresAt: null, revision: 1, updatedAt: NOW, cancellation: state === "cancelled_by_client" ? "client" as const : null,
    replacementRef: null, replacesRef: null, policy: null, observedAt: NOW,
  }
}

describe("P16 — rendez-vous à venir annoncés avant l'effacement", () => {
  it("compte seulement SES rendez-vous tenus et à venir ; jamais ceux d'autrui, d'une demande close ou passés", async () => {
    const t = testConvex()
    const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    const buyer = t.withIdentity({ subject: "erasure-notice-buyer" })
    const buyerId: Id<"persons"> = await buyer.mutation(api.modules.people.persons.ensureMyPerson, {})
    const other = t.withIdentity({ subject: "erasure-notice-other" })
    await other.mutation(api.modules.people.persons.ensureMyPerson, {})
    await t.run(async (ctx) => {
      const shopId = await ctx.db.insert("shops", { networkId: root, model: "quote_services", storefront: "draft", visibility: "network", createdAt: NOW, updatedAt: NOW })
      const base = {
        networkId: root, shopId, personId: buyerId, handle: "atelier-services", mode: "booking" as const, offerRef: "pro.ga:offer:01JA00000000000000000000F1",
        offerTitle: "Coiffure", source: "antsia", environment: "sandbox" as const, shopRef: "pro.ga:structure:01JA00000000000000000000S1",
        linkRef: "pro.ga:commerce_link:01JA00000000000000000000K1", subjectRef: `antsia:sub:${"a".repeat(26)}`, createdAt: NOW, updatedAt: NOW,
      }
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0001", state: "active", booking: booking("confirmed", NOW + DAY) })
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0002", state: "active", booking: booking("requested", NOW + 2 * DAY) })
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0003", state: "active", booking: booking("cancelled_by_client", NOW + DAY) })
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0004", state: "active", booking: booking("confirmed", NOW - 2 * DAY) })
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0005", state: "closed", booking: booking("confirmed", NOW + DAY) })
      await ctx.db.insert("commerceServiceRequests", { ...base, requestRowId: "erasure-row-0006", state: "active", booking: booking("confirmed", NOW + DAY), cancelledAt: NOW })
    })
    expect(await buyer.query(upcoming, {})).toEqual({ count: 2, truncated: false })
    expect(await other.query(upcoming, {})).toEqual({ count: 0, truncated: false })
  })

  it("reste lisible pendant le délai de grâce d'une demande d'effacement (Mes données)", async () => {
    const t = testConvex()
    await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    const buyer = t.withIdentity({ subject: "erasure-notice-grace" })
    await buyer.mutation(api.modules.people.persons.ensureMyPerson, {})
    await buyer.mutation(api.modules.people.erasure.requestErasure, { confirmation: "DELETE_MY_ANTSIA_ACCOUNT" })
    expect(await buyer.query(upcoming, {})).toEqual({ count: 0, truncated: false })
  })
})
