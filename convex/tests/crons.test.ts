// @vitest-environment edge-runtime
/** Lot 17 — les cibles du registre réel existent et restent des mutations internes. */
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import crons from "../crons"
import { modules, testConvex } from "../test.setup"

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("crons — registre exécuté et fonctions réellement déployables", () => {
  it("chaque cible enregistrée est une mutation interne exportée du backend", async () => {
    for (const [identifier, job] of Object.entries(crons.crons)) {
      const [path, name] = job.name.split(":")
      expect(path, identifier).toBeTruthy()
      expect(name, identifier).toBeTruthy()
      const load = modules[`./${path}.ts`]
      expect(load, `${identifier} → ${job.name}`).toBeTypeOf("function")
      if (!load || !name) throw new Error(`Cible absente : ${job.name}`)
      const loaded: unknown = await load()
      if (!loaded || typeof loaded !== "object") throw new Error(`Module invalide : ${path}`)
      const target: unknown = Reflect.get(loaded, name)
      expect(target, job.name).toBeTypeOf("function")
      if (typeof target !== "function") throw new Error(`Export absent : ${job.name}`)
      expect(Reflect.get(target, "isInternal"), job.name).toBe(true)
      expect(Reflect.get(target, "isMutation"), job.name).toBe(true)
    }
  })

  it("le harnais exécute toutes les entrées cron à vide avec leurs arguments réels", async () => {
    const t = testConvex()
    for (const job of Object.values(crons.crons)) {
      // Le registre Convex contient les mêmes noms que le planificateur.
      await t.mutation(makeFunctionReference<"mutation", Record<string, never>>(job.name), {})
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  })
})
