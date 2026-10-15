// Dupliqué de socle/convex/tests/uploadPolicy.test.ts @ ad2e7fdc2 — adaptations : la lecture de `_storage` et les deux portes (temps 1 et 2) seulement, les règles pures sont testées dans `@antia/social-domain` ; refus à code du moteur.
/**
 * Le contexte est stubbé plutôt que monté sous convex-test : `assertStoredUpload`
 * ne lit QUE `ctx.db.system.get("_storage", …)`. Un stub rend visible, à la
 * lecture, ce que la fonction consulte réellement.
 */
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import type { UploadUsage } from "@antia/social-domain/uploadPolicy"
import { describe, expect, it } from "vitest"

import type { Id } from "../_generated/dataModel"
import { assertStoredUpload, guardUploadUrl } from "./uploadPolicy"

const STORAGE_ID = "kg2fake000000000000000000000" as Id<"_storage">

type StoredRow = { contentType?: string; size: number; sha256: string } | null

function ctxWith(row: StoredRow) {
  return { db: { system: { get: async (_table: "_storage", _id: Id<"_storage">) => row } } } as never
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

describe("assertStoredUpload — lecture du stockage", () => {
  it("un fichier absent du stockage (identifiant forgé) se refuse comme introuvable", async () => {
    expect(engineErrorCode(await caught(assertStoredUpload(ctxWith(null), { storageId: STORAGE_ID, usage: "avatar" })))).toBe("notFound")
  })

  it("rend les métadonnées RÉELLES du stockage", async () => {
    const result = await assertStoredUpload(ctxWith({ contentType: "image/png", size: 32_000, sha256: "a".repeat(64) }), {
      storageId: STORAGE_ID,
      usage: "avatar",
      mimeType: "image/png",
    })
    expect(result).toEqual({ storageId: STORAGE_ID, mimeType: "image/png", sizeBytes: 32_000, sha256: "a".repeat(64) })
  })

  it("une règle enfreinte devient invalidArgument avec son code et sa borne", async () => {
    const error = await caught(
      assertStoredUpload(ctxWith({ contentType: "image/png", size: 6 * 1024 * 1024, sha256: "f".repeat(64) }), { storageId: STORAGE_ID, usage: "avatar" }),
    )
    expect(engineErrorCode(error)).toBe("invalidArgument")
    expect(engineErrorRule(error)).toEqual({ rule: "UPLOAD_SIZE_OUT_OF_RANGE", params: { maxMegabytes: 5 } })
  })

  it("un usage absent du registre est refusé", async () => {
    expect(engineErrorCode(await caught(assertStoredUpload(ctxWith(null), { storageId: STORAGE_ID, usage: "inconnu" as UploadUsage })))).toBe(
      "invalidArgument",
    )
  })
})

describe("guardUploadUrl — le temps 1 déclare l'usage", () => {
  const storage = { storage: { generateUploadUrl: async () => "https://exemple/depot" } } as never

  it("délivre l'URL pour un usage du registre", async () => {
    expect(await guardUploadUrl(storage, "avatar")).toBe("https://exemple/depot")
  })

  it("refuse un usage absent du registre", async () => {
    expect(engineErrorCode(await caught(guardUploadUrl(storage, "usage_inexistant" as UploadUsage)))).toBe("invalidArgument")
  })
})
