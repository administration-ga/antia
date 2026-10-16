// @vitest-environment edge-runtime
/**
 * Graine sociale de développement : double garde, idempotence, et une
 * personne de démonstration qui sert réellement iCom (la messagerie la
 * propose, un groupe l'accepte) sans jamais pouvoir usurper une vraie personne.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../_generated/api"
import { enter, seed, T0 } from "../modules/calls/fixtures.setup"
import { testConvex } from "../test.setup"
import { SEED_CONFIRMATION, seedsAllowed } from "./foundations"

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("seeds/devSocial:demoPerson — une personne de démonstration", () => {
  it("refuse sans l'argument de confirmation", async () => {
    const t = testConvex()
    await seed(t)
    await expect(t.mutation(internal.seeds.devSocial.demoPerson, { confirmNonProduction: "oui", networkSlug: "antsia", handle: "awa.demo", displayName: "Awa" })).rejects.toThrow(/hors production/)
  })

  it("partage la garde des fondations : refusée hors d'un déploiement local sans autorisation explicite", () => {
    // Le harnais fige l'environnement du déploiement à sa création : la garde (pure) se lit directement.
    expect(seedsAllowed({ CONVEX_CLOUD_URL: "https://exemple.convex.cloud" })).toBe(false)
    expect(seedsAllowed({ CONVEX_CLOUD_URL: "https://exemple.convex.cloud", ANTSIA_SEEDS_ALLOWED: "true" })).toBe(true)
    expect(seedsAllowed({ CONVEX_CLOUD_URL: "http://127.0.0.1:3210" })).toBe(true)
  })

  it("crée une personne publiée, membre du réseau, reliée sur demande — et rejouée ne double rien", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "lynda")
    const args = { confirmNonProduction: SEED_CONFIRMATION, networkSlug: "antsia", handle: "awa.demo", displayName: "Awa Démo", connectToHandle: "lynda" }

    const first = await t.mutation(internal.seeds.devSocial.demoPerson, args)
    expect(first).toMatchObject({ created: true, connected: true })
    const again = await t.mutation(internal.seeds.devSocial.demoPerson, args)
    expect(again).toEqual({ personId: first.personId, created: false, connected: true })

    // La messagerie la propose, et un groupe l'accepte : elle sert vraiment iCom.
    const candidates = await lynda.as.query(api.modules.groups.invites.listMyConnectionsForGroup, { networkId: root })
    expect(candidates.map((c) => c.handle)).toEqual(["awa.demo"])
    const counts = await t.run(async (ctx) => ({
      persons: (await ctx.db.query("persons").withIndex("by_handle", (q) => q.eq("handle", "awa.demo")).take(5)).length,
      connections: (await ctx.db.query("connections").take(10)).length,
    }))
    expect(counts).toEqual({ persons: 1, connections: 1 })
  })

  it("n'usurpe jamais l'identifiant d'une vraie personne", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    await enter(t, root, "lynda")
    await expect(t.mutation(internal.seeds.devSocial.demoPerson, { confirmNonProduction: SEED_CONFIRMATION, networkSlug: "antsia", handle: "lynda", displayName: "Fausse Lynda" })).rejects.toThrow(/vraie personne/)
  })
})
