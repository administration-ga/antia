/** P15 : scénarios du contrat d'emploi écrits sans exécution pendant cette reprise. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  COMMERCE_JOBS_APPLICATION_CONSENT_VERSION, COMMERCE_JOBS_CONTRACT, COMMERCE_JOBS_CONTROL_CONTRACT, COMMERCE_JOBS_CONTROL_OPERATION,
  COMMERCE_JOBS_CONTROL_TTL_MS, COMMERCE_JOBS_FILES_CONTRACT, COMMERCE_JOBS_LIMITS, COMMERCE_JOBS_RETENTION, commerceJobsApplicationState,
  commerceJobsCandidateState, commerceJobsEffect, commerceJobsFileHeadersValid, commerceJobsFromPublic, commerceJobsIsPdf,
  commerceJobsLibrevilleDate, commerceJobsOpenForApplications, commerceJobsPublicView, parseCommerceJobsBody,
  parseCommerceJobsControlRequest, parseCommerceJobsControlResponse, parseCommerceJobsFileResponse,
  type CommerceJobsControlRequest, type CommerceJobsPublished,
} from "./commerce-jobs"
import { COMMERCE_COMMAND_LIMITS, COMMERCE_COMMAND_SCOPES, COMMERCE_RESERVED_COMMANDS } from "./commerce/command"
import { commerceCanonicalJson } from "./commerce/primitives"
import { decideCommercePublicRevision, parseCommercePublicBody } from "./commerce/projection"
import { COMMERCE_JOBS_FEDERATION_CONTRACT } from "./federationProtocol"
import { isMimeAllowedForUsage, UPLOAD_USAGES } from "./uploadPolicy"

const NOW = Date.UTC(2026, 9, 18, 12)
const JOB = "pro.ga:job_opening:01JA0000000000000000000J01"
const SHOP = "pro.ga:structure:01JA0000000000000000000S01"
function canonical(value: unknown): string { const body = commerceCanonicalJson(value); if (body === null) throw new Error("Fixture non canonisable"); return body }
const published: CommerceJobsPublished = {
  changedAt: NOW - 1000, closesOn: "2026-11-30", contractType: "cdi", declaredSalary: { currency: "XAF", minAmount: 250000, maxAmount: 400000, period: "month" },
  description: "Accueil des clients et tenue de caisse.", headcount: 2, jobRef: JOB, location: "Libreville", openedOn: "2026-10-01",
  revision: 3, shopRef: SHOP, skills: ["Caisse", "Accueil"], title: "Vendeuse en boutique", type: "job.published",
}
const envelope = (payload: unknown, changes: Record<string, unknown> = {}) => canonical({ contract: COMMERCE_JOBS_CONTRACT, eventId: "pro-ga-evt-job-0001", objectRef: JOB, payload, version: 1, ...changes })

describe("PRO-COMMERCE-JOBS-V1 — schéma fermé et compléments de PUBLIC-V1 §5.6", () => {
  it("lit l'offre complète : compétences, période et échéance", () => {
    const parsed = parseCommerceJobsBody(envelope(published), NOW)
    expect(parsed.ok && parsed.value.payload).toEqual(published)
  })

  it("refuse les octets non canoniques, un autre contrat et un objet qui n'est pas un poste", () => {
    expect(parseCommerceJobsBody(` ${envelope(published)}`, NOW)).toMatchObject({ ok: false, reason: "not_canonical" })
    expect(parseCommerceJobsBody(envelope(published, { contract: "PRO-COMMERCE-PUBLIC-V1" }), NOW)).toMatchObject({ ok: false, reason: "invalid_envelope" })
    expect(parseCommerceJobsBody(envelope(published, { objectRef: SHOP }), NOW)).toMatchObject({ ok: false, reason: "invalid_reference" })
    expect(parseCommerceJobsBody(envelope({ ...published, jobRef: "pro.ga:job_opening:01JA0000000000000000000J99" }), NOW)).toMatchObject({ ok: false, reason: "reference_mismatch" })
  })

  it("aucun candidat, contact, note RH ni identifiant de stockage, même imbriqué", () => {
    for (const field of ["fullName", "contactEmail", "note", "cv", "storageId", "userId", "tenantId"]) {
      expect(parseCommerceJobsBody(envelope({ ...published, declaredSalary: { ...published.declaredSalary, [field]: "x" } }), NOW)).toMatchObject({ ok: false, reason: "forbidden_field" })
    }
    expect(parseCommerceJobsBody(envelope({ ...published, candidates: [] }), NOW)).toMatchObject({ ok: false, reason: "invalid_payload" })
  })

  it("rémunération déclarée : une borne au moins, ordonnée, période fermée ; période absente admise", () => {
    expect(parseCommerceJobsBody(envelope({ ...published, declaredSalary: { currency: "XAF" } }), NOW)).toMatchObject({ ok: false, reason: "amount_incoherent" })
    expect(parseCommerceJobsBody(envelope({ ...published, declaredSalary: { currency: "XAF", minAmount: 5, maxAmount: 4 } }), NOW)).toMatchObject({ ok: false, reason: "amount_incoherent" })
    expect(parseCommerceJobsBody(envelope({ ...published, declaredSalary: { currency: "XAF", minAmount: 5, period: "fortnight" } }), NOW)).toMatchObject({ ok: false, reason: "invalid_payload" })
    expect(parseCommerceJobsBody(envelope({ ...published, declaredSalary: { currency: "EUR", minAmount: 5 } }), NOW)).toMatchObject({ ok: false, reason: "currency_mismatch" })
    const noPeriod = parseCommerceJobsBody(envelope({ ...published, declaredSalary: { currency: "XAF", minAmount: 5 } }), NOW)
    expect(noPeriod.ok && noPeriod.value.payload.type === "job.published" && noPeriod.value.payload.declaredSalary?.period).toBeUndefined()
  })

  it("compétences bornées, sans doublon insensible à la casse, textes déjà normalisés", () => {
    expect(parseCommerceJobsBody(envelope({ ...published, skills: ["Caisse", "caisse"] }), NOW)).toMatchObject({ ok: false, reason: "duplicate_entry" })
    expect(parseCommerceJobsBody(envelope({ ...published, skills: [" Caisse"] }), NOW)).toMatchObject({ ok: false, reason: "invalid_text" })
    expect(parseCommerceJobsBody(envelope({ ...published, skills: Array.from({ length: 21 }, (_, index) => `c${index}`) }), NOW)).toMatchObject({ ok: false, reason: "invalid_payload" })
  })

  it("échéance avant l'ouverture refusée ; clôture terminale ou retrait levable", () => {
    expect(parseCommerceJobsBody(envelope({ ...published, closesOn: "2026-09-01" }), NOW)).toMatchObject({ ok: false, reason: "invalid_time" })
    const closed = { changedAt: NOW, jobRef: JOB, reason: "filled", revision: 4, shopRef: SHOP, type: "job.closed" } as const
    const parsed = parseCommerceJobsBody(envelope(closed), NOW)
    expect(parsed.ok && commerceJobsEffect(parsed.value.payload)).toEqual({ effect: "close", objectRef: JOB, revision: 4 })
    expect(commerceJobsEffect({ ...closed, reason: "withdrawn" as const })).toEqual({ effect: "withdraw", objectRef: JOB, revision: 4 })
  })

  it("un ancien événement ne réactive jamais une offre retirée ni close", () => {
    const tomb = { revision: 5, digest: "a".repeat(64), state: "withdrawn" as const }
    expect(decideCommercePublicRevision(tomb, { revision: 4, digest: "b".repeat(64), effect: "upsert" })).toEqual({ action: "stale" })
    const closed = { revision: 5, digest: "a".repeat(64), state: "closed" as const }
    expect(decideCommercePublicRevision(closed, { revision: 6, digest: "b".repeat(64), effect: "upsert" })).toEqual({ action: "conflict", reason: "terminal_object" })
  })

  it("normalise PUBLIC-V1 §5.6 sans inventer de compétence ni de période", () => {
    const v1Salary = { currency: "XAF", minAmount: 250000, maxAmount: 400000 }
    const v1: Record<string, unknown> = { ...published, declaredSalary: v1Salary }
    delete v1.skills
    const body = canonical({ contract: "PRO-COMMERCE-PUBLIC-V1", eventId: "pro-ga-evt-job-0002", objectRef: JOB, payload: v1, version: 1 })
    const parsed = parseCommercePublicBody(body, NOW)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || (parsed.value.payload.type !== "job.published" && parsed.value.payload.type !== "job.closed")) return
    const normalized = commerceJobsFromPublic(parsed.value.payload)
    expect(normalized).toMatchObject({ skills: [], declaredSalary: v1Salary })
    expect(normalized.type === "job.published" && normalized.declaredSalary?.period).toBeUndefined()
  })
})

describe("Projection publique et candidature", () => {
  it("date civile de Libreville et fermeture à l'échéance", () => {
    expect(commerceJobsLibrevilleDate(Date.UTC(2026, 10, 30, 23, 30))).toBe("2026-12-01")
    expect(commerceJobsOpenForApplications(published, "active", "2026-11-30")).toBe(true)
    expect(commerceJobsOpenForApplications(published, "active", "2026-12-01")).toBe(false)
    expect(commerceJobsOpenForApplications(published, "withdrawn", "2026-11-01")).toBe(false)
  })

  it("une offre close garde son contenu pour un lien connu, sans aucun champ privé", () => {
    const view = commerceJobsPublicView(published, { closure: "closed", today: "2026-10-18" })
    expect(view.status).toBe("closed")
    expect(Object.keys(view).sort()).toEqual(["closesOn", "contractType", "description", "headcount", "jobRef", "location", "openedOn", "revision", "salary", "shopRef", "skills", "status", "title"])
    expect(commerceJobsPublicView(published, { closure: null, today: "2026-12-01" }).status).toBe("deadline_passed")
    expect(commerceJobsPublicView({ ...published, declaredSalary: { currency: "XAF", minAmount: 1 } }, { closure: null, today: "2026-10-18" }).salary?.period).toBeNull()
  })

  it("le suivi candidat rend un état autorisé, jamais une note", () => {
    expect(commerceJobsApplicationState("screening")).toBe("screening")
    expect(commerceJobsApplicationState("note")).toBeNull()
    expect(commerceJobsCandidateState("rejected")).toBe("not_retained")
    expect(commerceJobsCandidateState("screening")).toBe("in_review")
  })

  it("aucune durée de conservation inventée", () => {
    expect(COMMERCE_JOBS_RETENTION).toEqual({ applicationFilesAfterDecisionDays: null, withdrawnApplicationsDays: null })
    expect(COMMERCE_JOBS_APPLICATION_CONSENT_VERSION).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/)
  })
})

describe("Contrôle privé et pièces — hors manifeste P06", () => {
  const request: CommerceJobsControlRequest = {
    action: "withdraw", at: NOW, contract: COMMERCE_JOBS_CONTROL_CONTRACT, environment: "sandbox", expiresAt: NOW + COMMERCE_JOBS_CONTROL_TTL_MS,
    issuedAt: NOW, reason: "candidate_request", requestId: "job-withdraw-0001", source: "antsia", subjectRef: `antsia:sub:${"a".repeat(32)}`,
    submitRequestId: "job-submit-0001", submitRequestSha256: "b".repeat(64), version: 1,
  }
  const context = { source: "antsia", environment: "sandbox" as const, nowMs: NOW }
  const parse = (changes: Record<string, unknown> = {}) => parseCommerceJobsControlRequest(canonical({ ...request, ...changes }), context)

  it("le nom réservé P06 application.withdraw reste refusé ; le contrôle emprunte le scope existant", () => {
    expect(COMMERCE_RESERVED_COMMANDS).toContain("application.withdraw")
    expect(COMMERCE_COMMAND_SCOPES[COMMERCE_JOBS_CONTROL_OPERATION]).toBe("commerce.application.submit")
  })

  it("retrait : candidature entière ; révocation : exactement une pièce", () => {
    expect(parse().ok).toBe(true)
    expect(parse({ attachmentRef: `antsia:file:${"c".repeat(32)}` })).toMatchObject({ ok: false, reason: "invalid_payload" })
    expect(parse({ action: "attachment.revoke" })).toMatchObject({ ok: false, reason: "invalid_payload" })
    expect(parse({ action: "attachment.revoke", attachmentRef: `antsia:file:${"c".repeat(32)}`, reason: "file_blocked" }).ok).toBe(true)
    expect(parse({ reason: "file_blocked" })).toMatchObject({ ok: false, reason: "invalid_payload" })
  })

  it("source, environnement et fenêtre courte vérifiés ; rien d'imbriqué n'est admis", () => {
    expect(parse({ source: "autre" })).toMatchObject({ ok: false, reason: "source_mismatch" })
    expect(parse({ environment: "production" })).toMatchObject({ ok: false, reason: "environment_mismatch" })
    expect(parse({ expiresAt: NOW + COMMERCE_JOBS_CONTROL_TTL_MS + 1 })).toMatchObject({ ok: false, reason: "invalid_time" })
    expect(parse({ at: NOW + 1 })).toMatchObject({ ok: false, reason: "invalid_time" })
    expect(parse({ fullName: "X" })).toMatchObject({ ok: false, reason: "invalid_request" })
  })

  it("réponse corrélée aux octets envoyés", () => {
    const body = canonical({ contract: COMMERCE_JOBS_CONTROL_CONTRACT, outcome: "applied", requestId: request.requestId, requestSha256: "d".repeat(64), respondedAt: NOW, version: 1 })
    expect(parseCommerceJobsControlResponse(body, { requestId: request.requestId, requestSha256: "d".repeat(64) }).ok).toBe(true)
    expect(parseCommerceJobsControlResponse(body, { requestId: request.requestId, requestSha256: "e".repeat(64) })).toMatchObject({ ok: false, reason: "correlation_mismatch" })
  })

  it("pièces : PDF par signature binaire, en-têtes opaques et réponse corrélée", () => {
    expect(commerceJobsIsPdf(new TextEncoder().encode("%PDF-1.7"))).toBe(true)
    expect(commerceJobsIsPdf(new TextEncoder().encode("MZ\u0090"))).toBe(false)
    expect(commerceJobsFileHeadersValid("job-submit-0001", `antsia:file:${"c".repeat(32)}`)).toBe(true)
    expect(commerceJobsFileHeadersValid("job-submit-0001", "https://exemple.invalid/cv.pdf")).toBe(false)
    const expected = { submitRequestId: "job-submit-0001", attachmentRef: `antsia:file:${"c".repeat(32)}`, sha256: "f".repeat(64) }
    const body = canonical({ ...expected, contract: COMMERCE_JOBS_FILES_CONTRACT, outcome: "stored", version: 1 })
    expect(parseCommerceJobsFileResponse(body, expected).ok).toBe(true)
    expect(parseCommerceJobsFileResponse(body, { ...expected, sha256: "0".repeat(64) })).toMatchObject({ ok: false, reason: "correlation_mismatch" })
  })
})

describe("Garde des pièces de candidature", () => {
  it("usage dédié : PDF seul, borne identique au contrat COMMAND", () => {
    expect(UPLOAD_USAGES.job_application_document.maxBytes).toBe(COMMERCE_JOBS_LIMITS.attachmentBytesMax)
    expect(COMMERCE_JOBS_LIMITS.attachmentBytesMax).toBe(COMMERCE_COMMAND_LIMITS.attachmentBytesMax)
    expect(COMMERCE_JOBS_LIMITS.attachmentsMax).toBe(COMMERCE_COMMAND_LIMITS.attachmentsMax)
    expect(isMimeAllowedForUsage("job_application_document", "application/pdf")).toBe(true)
    for (const mime of ["image/png", "application/msword", "text/html", "application/zip"]) expect(isMimeAllowedForUsage("job_application_document", mime)).toBe(false)
  })
})

describe("Jumeau PRO.GA", () => {
  it("le registre de la fédération nomme exactement le contrat du jumeau", () => {
    expect(COMMERCE_JOBS_FEDERATION_CONTRACT).toBe(COMMERCE_JOBS_CONTRACT)
  })

  it("la copie PRO.GA est identique octet pour octet (dépôt voisin présent)", () => {
    const peer = new URL("../../../../PRO_GA/packages/pro-domain/src/commerce-jobs.ts", import.meta.url)
    if (!existsSync(peer)) return
    const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
    expect(digest(readFileSync(peer))).toBe(digest(readFileSync(new URL("./commerce-jobs.ts", import.meta.url))))
  })
})
