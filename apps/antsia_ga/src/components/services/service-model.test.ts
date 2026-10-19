/** P14 — règles d'écran des services. Écrit, NON exécuté (décision du propriétaire du 18/10/2026). */
import type { ServiceRequestDto } from "@convex/modules/shops/serviceRules"
import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"

import {
  bookingSchema, contactNameOf, displayTimeZones, orderSchema, quoteRequestSchema, SERVICE_AGENDA_TIME_ZONE, serviceReasonKey, serviceRequestStatus, serviceToday,
  slotsByDay, slotWindow,
} from "./service-model"

const t = ((key: string) => key) as unknown as TFunction
const NOW = Date.UTC(2026, 9, 18, 12)

describe("P14 — noms donnés au professionnel (normaliseur partagé)", () => {
  it("NOM en capitales, chaque Prénom avec une initiale, accents et tirets conservés", () => {
    expect(contactNameOf({ firstName: "jean-rémy éloïse", lastName: "ndong mba" })).toEqual({ firstName: "Jean-Rémy Éloïse", lastName: "NDONG MBA" })
    expect(contactNameOf({ firstName: "", lastName: "" })).toBeUndefined()
  })
  it("les deux ou aucun : un seul champ rempli est refusé", () => {
    const schema = bookingSchema(t)
    expect(schema.safeParse({ note: "", firstName: "Awa", lastName: "", consent: true }).success).toBe(false)
    expect(schema.safeParse({ note: "", firstName: "", lastName: "", consent: true }).success).toBe(true)
    expect(schema.safeParse({ note: "", firstName: "Awa", lastName: "Ndong", consent: false }).success).toBe(false)
  })
})

describe("P14 — formulaires", () => {
  it("devis : besoin obligatoire, date du jour ou future dans le fuseau de l'agenda, trois pièces au plus", () => {
    const schema = quoteRequestSchema(t)
    const base = { need: "Coupe", constraints: "", desiredDate: "", quantity: "", attachmentMessageIds: [], consent: true }
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, need: "   " }).success).toBe(false)
    expect(schema.safeParse({ ...base, desiredDate: "2020-01-01" }).success).toBe(false)
    expect(schema.safeParse({ ...base, desiredDate: serviceToday() }).success).toBe(true)
    expect(schema.safeParse({ ...base, attachmentMessageIds: ["a", "b", "c", "d"] }).success).toBe(false)
    expect(schema.safeParse({ ...base, need: "Coupe\u0007" }).success).toBe(false)
  })
  it("commande : quantité dans la borne servie par le professionnel", () => {
    const schema = orderSchema(t, 5)
    const base = { quantity: "2", desiredDate: "", note: "", firstName: "", lastName: "", consent: true }
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, quantity: "6" }).success).toBe(false)
    expect(schema.safeParse({ ...base, quantity: "0" }).success).toBe(false)
  })
})

describe("P14 — états, motifs et fuseaux d'affichage", () => {
  const request = (state: ServiceRequestDto["state"], last: Partial<NonNullable<ServiceRequestDto["lastCommand"]>> | null) => ({ state, lastCommand: last === null ? null : { kind: "booking" as const, state: "accepted" as const, reason: null, createdAt: NOW, canRetry: false, quoteRef: null, currentVersion: null, currentTotal: null, currentUnitAmount: null, currentCatalogRevision: null, quantity: null, ...last } })
  it("un résultat inconnu ou à reconfirmer prime sur l'état de la demande ; jamais de succès supposé", () => {
    expect(serviceRequestStatus(request("pending", { state: "unknown" }))).toBe("unknown")
    expect(serviceRequestStatus(request("active", { state: "reconfirm" }))).toBe("reconfirm")
    expect(serviceRequestStatus(request("active", { state: "rejected" }))).toBe("rejected")
    expect(serviceRequestStatus(request("failed", { state: "rejected" }))).toBe("failed")
    expect(serviceRequestStatus(request("closed", null))).toBe("closed")
  })
  it("un motif inconnu reste générique, jamais affiché brut", () => {
    expect(serviceReasonKey("slot_unavailable")).toBe("reasons.slot_unavailable")
    expect(serviceReasonKey("<script>")).toBe("reasons.other")
    expect(serviceReasonKey(null)).toBe("reasons.other")
  })
  it("fuseau de l'agenda toujours proposé ; celui de l'appareil seulement s'il diffère", () => {
    expect(displayTimeZones(SERVICE_AGENDA_TIME_ZONE, NOW)).toEqual([SERVICE_AGENDA_TIME_ZONE])
    expect(displayTimeZones("Africa/Lagos", NOW)).toEqual([SERVICE_AGENDA_TIME_ZONE])
    expect(displayTimeZones("Europe/Paris", NOW)).toEqual([SERVICE_AGENDA_TIME_ZONE, "Europe/Paris"])
  })
  it("les créneaux sont groupés par jour MURAL du fuseau d'affichage", () => {
    // 23 h 30 à Libreville = 0 h 30 le lendemain à Paris (heure d'été) : les jours diffèrent.
    const late = { startAt: Date.UTC(2026, 9, 20, 22, 30) }
    expect(slotsByDay([late], "Africa/Libreville", "fr")[0]?.day).not.toBe(slotsByDay([late], "Europe/Paris", "fr")[0]?.day)
    expect(slotWindow(NOW)).toEqual({ fromAt: NOW, toAt: NOW + 7 * 24 * 3_600_000 })
  })
})
