// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest"

import { OPERATIONAL_JOB_LIMIT, OPERATIONAL_WINDOW_MS, summarizeScheduledJobs } from "./operationalHealth"

const NOW = 1_792_334_400_000

describe("PA10 / projection technique des tâches planifiées", () => {
  it("compte les seuls états dans la fenêtre sans copier de champ libre", () => {
    const sample = [
      { scheduledTime: NOW - 1000, completedTime: NOW, state: { kind: "failed" as const, error: "private failure" }, name: "private-function", args: [{ personId: "private-person" }] },
      { scheduledTime: NOW - 1000, state: { kind: "pending" as const } },
      { scheduledTime: NOW - 1000, state: { kind: "inProgress" as const } },
      { scheduledTime: NOW - 1000, completedTime: NOW, state: { kind: "success" as const } },
      { scheduledTime: NOW - 1000, completedTime: NOW, state: { kind: "canceled" as const } },
      { scheduledTime: NOW - OPERATIONAL_WINDOW_MS - 1, state: { kind: "failed" as const } },
      { scheduledTime: NOW + 1, state: { kind: "pending" as const } },
    ]
    const snapshot = summarizeScheduledJobs(sample, NOW, true)
    expect(snapshot).toEqual({ observedAt: NOW, windowStart: NOW - OPERATIONAL_WINDOW_MS, windowEnd: NOW, scanned: 7, failed: 1, pending: 1, inProgress: 1, successful: 1, canceled: 1, coverage: "complete" })
    expect(JSON.stringify(snapshot)).not.toMatch(/private|personId|args|error|name/)
  })

  it("reste bornée à deux cents lignes et ne présente pas une tranche comme exhaustive", () => {
    const rows = Array.from({ length: OPERATIONAL_JOB_LIMIT + 1 }, () => ({ scheduledTime: NOW, state: { kind: "failed" as const } }))
    expect(summarizeScheduledJobs(rows, NOW, true)).toMatchObject({ scanned: 200, failed: 200, coverage: "bounded" })
    expect(summarizeScheduledJobs(rows.slice(0, 3), NOW, false)).toMatchObject({ scanned: 3, failed: 3, coverage: "bounded" })
  })

  it("utilise la date d'achèvement pour un échec anciennement planifié, sans compter de date invalide", () => {
    const rows = [
      { scheduledTime: NOW - 2 * OPERATIONAL_WINDOW_MS, completedTime: NOW, state: { kind: "failed" as const } },
      { scheduledTime: NOW, completedTime: Number.NaN, state: { kind: "failed" as const } },
    ]
    expect(summarizeScheduledJobs(rows, NOW, true)).toMatchObject({ scanned: 2, failed: 1 })
  })
})
