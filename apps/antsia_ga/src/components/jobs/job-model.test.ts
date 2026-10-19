/** P15 : règles d'affichage et de saisie de l'emploi — ÉCRIT, NON EXÉCUTÉ (décision du 18/10/2026). */
import { describe, expect, it } from "vitest"

import { routes } from "@/lib/routes"
import { jobApplicationSchema, jobCivilNamePreview, jobDateText, jobIdempotencyKey, jobSalaryText, jobStatusNoticeKey, selectableJobFiles, type JobFileDto } from "./job-model"

const t = (key: string, options?: Record<string, unknown>) => options ? `${key}:${JSON.stringify(options)}` : key
const messages = { nameRequired: "required", nameTooLong: "long", nameInvalid: "invalid", motivationTooLong: "motivation", filesTooMany: "files", consentRequired: "consent" }

describe("P15 — affichage d'une offre", () => {
  it("rémunération déclarée : fourchette, borne seule, période connue ou « non précisée », jamais inventée", () => {
    expect(jobSalaryText(null, "fr", t)).toBe("salary.notSpecified")
    expect(jobSalaryText({ currency: "XAF", minAmount: null, maxAmount: null, period: null }, "fr", t)).toBe("salary.notSpecified")
    expect(jobSalaryText({ currency: "XAF", minAmount: 400_000, maxAmount: 600_000, period: "month" }, "fr", t)).toMatch(/^salary\.range:.* · salary\.period\.month$/u)
    expect(jobSalaryText({ currency: "XAF", minAmount: 250_000, maxAmount: null, period: null }, "fr", t)).toMatch(/^salary\.from:.* · salary\.periodUnknown$/u)
    expect(jobSalaryText({ currency: "XAF", minAmount: null, maxAmount: 300_000, period: "day" }, "fr", t)).toMatch(/^salary\.upTo:.* · salary\.period\.day$/u)
  })

  it("dates civiles sans décalage, clôture annoncée, offre ouverte sans avis", () => {
    expect(jobDateText("2026-11-30", "fr")).toContain("2026")
    expect(jobStatusNoticeKey("open")).toBeNull()
    expect(jobStatusNoticeKey("filled")).toBe("details.filledNotice")
    expect(jobStatusNoticeKey("closed")).toBe("details.closedNotice")
    expect(jobStatusNoticeKey("deadline_passed")).toBe("details.deadlineNotice")
  })

  it("routes centralisées : fiche membre, SSR public, Mes candidatures", () => {
    expect(routes.shopJob("cabinet", "pro.ga:job_opening:01JA00000000000000000000J1")).toBe("/boutique/cabinet/emplois/pro.ga%3Ajob_opening%3A01JA00000000000000000000J1")
    expect(routes.publicShopJob("cabinet", "pro.ga:job_opening:01JA00000000000000000000J1")).toBe("/boutiques/cabinet/emplois/pro.ga%3Ajob_opening%3A01JA00000000000000000000J1")
    expect(routes.myApplications()).toBe("/mes-candidatures")
    expect(routes.jobDirectory()).toBe("/explorer#emplois")
  })
})

describe("P15 — saisie d'une candidature", () => {
  it("aperçu du nom transmis par le normaliseur partagé : NOM en capitales, Prénom capitalisé", () => {
    expect(jobCivilNamePreview("jean-rémy éloïse", "ndong mba")).toBe("NDONG MBA Jean-Rémy Éloïse")
    expect(jobCivilNamePreview("  ", "ndong")).toBeNull()
  })

  it("le schéma reprend les bornes du moteur et exige l'accord", () => {
    const schema = jobApplicationSchema(messages)
    expect(schema.safeParse({ firstName: "Awa", lastName: "Ndong", motivation: "", fileIds: [], consent: true }).success).toBe(true)
    expect(schema.safeParse({ firstName: "Awa", lastName: "Ndong", motivation: "", fileIds: [], consent: false }).success).toBe(false)
    expect(schema.safeParse({ firstName: "1234", lastName: "Ndong", motivation: "", fileIds: [], consent: true }).success).toBe(false)
    expect(schema.safeParse({ firstName: "Awa", lastName: "Ndong", motivation: "x".repeat(4001), fileIds: [], consent: true }).success).toBe(false)
    expect(schema.safeParse({ firstName: "Awa", lastName: "Ndong", motivation: "", fileIds: ["a", "b", "c", "d"], consent: true }).success).toBe(false)
  })

  it("clé d'idempotence conforme au moteur ; seules les pièces saines sont proposées", () => {
    expect(jobIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{16,128}$/u)
    const files: JobFileDto[] = [
      { fileId: "a" as JobFileDto["fileId"], kind: "cv", filename: "cv.pdf", byteSize: 2048, createdAt: 1, scan: "clean" },
      { fileId: "b" as JobFileDto["fileId"], kind: "cover_letter", filename: null, byteSize: 2048, createdAt: 1, scan: "pending" },
      { fileId: "c" as JobFileDto["fileId"], kind: "certificate", filename: null, byteSize: 2048, createdAt: 1, scan: "blocked" },
    ]
    expect(selectableJobFiles(files).map((file) => file.fileId)).toEqual(["a"])
  })
})
