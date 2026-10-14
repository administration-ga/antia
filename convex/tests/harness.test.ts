// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest"

import { api } from "../_generated/api"
import schema from "../schema"
import { modules, testConvex } from "../test.setup"

describe("harnais convex-test du moteur", () => {
  it("appelle une fonction réelle contre le schéma réel", async () => {
    const t = testConvex()
    expect(await t.query(api.health.ping, {})).toEqual({ status: "ok" })
  })

  it("le glob des modules n'est jamais vide (une négation mal écrite le rend muet)", () => {
    const keys = Object.keys(modules)
    expect(keys).toContain("./health.ts")
    expect(keys.some((key) => key.includes("/_generated/"))).toBe(true)
    expect(keys.some((key) => key.endsWith(".test.ts"))).toBe(false)
  })

  it("garde la validation des tables ACTIVE (invariant du moteur)", () => {
    expect(schema.schemaValidation).toBe(true)
  })
})
