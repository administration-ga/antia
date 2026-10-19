import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { compareSnapshotDirectories, percentile, summarizeLoadRun } from "./pa10-evidence.mjs"

// Scénarios PA10 écrits ; aucune exécution pendant la livraison du 18/10.
const sample = (operation, durationMs = 10) => ({ operation, durationMs, attempts: 1, writeConflicts: 0, ok: true })
function receipt() {
  return {
    version: 1, sourceSha: "a".repeat(40), inventoryBefore: "b".repeat(64), inventoryAfter: "b".repeat(64),
    targetKind: "local", networkProfile: "local", startedAt: 1, endedAt: 10,
    samples: [...Array.from({ length: 5_000 }, () => sample("follow")), ...Array.from({ length: 10_000 }, () => sample("reaction")), ...Array.from({ length: 100 }, () => sample("feed", 1_499))],
    reactionShards: Array.from({ length: 8 }, (_, shard) => ({ shard, count: 1_250 })),
  }
}

describe("PA10 — rapport de charge sans effet distant", () => {
  test("rang p95 conservateur, seuil strict et observation des conflits même repris", () => {
    expect(percentile([1, 2, 3, 4, 100], 0.95)).toBe(100)
    const input = receipt()
    expect(summarizeLoadRun(input).r8ThresholdsSatisfied).toBe(true)
    input.samples.at(-1).writeConflicts = 1
    input.samples.at(-1).attempts = 2
    expect(summarizeLoadRun(input)).toMatchObject({ r8ThresholdsSatisfied: false, writeConflicts: 1, retries: 1 })
    input.samples = input.samples.map((row) => row.operation === "feed" ? { ...row, durationMs: 1_500 } : row)
    expect(summarizeLoadRun(input).r8ThresholdsSatisfied).toBe(false)
  })

  test("un petit échantillon, des sources mouvantes et des compteurs incomplets ne prouvent pas R8", () => {
    const input = receipt()
    expect(summarizeLoadRun({ ...input, samples: input.samples.slice(-100) }).workloadComplete).toBe(false)
    expect(() => summarizeLoadRun({ ...input, inventoryAfter: "c".repeat(64) })).toThrow()
    input.reactionShards[1].shard = 0
    expect(() => summarizeLoadRun(input)).toThrow()
  })

  test("une erreur ne disparaît pas parce que le p95 est bon", () => {
    const input = receipt()
    input.samples[0].ok = false
    expect(summarizeLoadRun(input)).toMatchObject({ errors: 1, independentLaunchApproval: false, r8ThresholdsSatisfied: false })
  })
})

describe("PA10 — assertion locale de sauvegarde/restauration", () => {
  test("ordre des lignes et des clés indifférent, identités et octets conservés", async () => {
    const dir = await mkdtemp(join(tmpdir(), "antsia-restore-evidence-"))
    const source = join(dir, "source"), restored = join(dir, "restored")
    try {
      for (const root of [source, restored]) {
        await mkdir(join(root, "posts"), { recursive: true })
        await mkdir(join(root, "_storage"), { recursive: true })
        await writeFile(join(root, "_storage", "blob-fixture"), "octets identiques")
      }
      await writeFile(join(source, "posts", "documents.jsonl"), '{"_id":"p1","body":"A"}\n{"_id":"p2","body":"B"}\n')
      await writeFile(join(restored, "posts", "documents.jsonl"), '{"body":"B","_id":"p2"}\n{"body":"A","_id":"p1"}\n')
      expect(await compareSnapshotDirectories(source, restored)).toMatchObject({ matching: true, documents: 2, targetProvenanceVerified: false })
      await writeFile(join(restored, "_storage", "blob-fixture"), "octets différents")
      expect((await compareSnapshotDirectories(source, restored)).matching).toBe(false)
      await expect(compareSnapshotDirectories(source, source)).rejects.toThrow()
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
