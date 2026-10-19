// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER, type FederationEnvelope, type FederationJson } from "@antsia/social-domain/federationProtocol"
import { describe, expect, it } from "vitest"

import { internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { assertNativePageManagement } from "./mirrorAccess"
import { applyFederationEnvelope } from "./reseauPublic"

type T = ReturnType<typeof testConvex>
const T0 = Date.UTC(2026, 9, 18, 12)
const ORG_REF = "administration:direction-fixture"

async function fixture() {
  const t = testConvex({ automaticSessions: false })
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const { administration, emitterId } = await t.run(async (ctx) => {
    const administration = await ctx.db.insert("networks", {
      slug: "administration", name: "Administration de recette", kind: "closed", parentId: root,
      membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [],
      theme: "antsia", status: "active", createdAt: T0, updatedAt: T0,
    })
    const emitterId = await ctx.db.insert("federationEmitters", {
      networkId: administration, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true,
      keyEnvName: "ANTSIA_FEDERATION_RESEAU_PUBLIC_TEST_KEY", allowedContracts: [RESEAU_PUBLIC_CONTRACT],
      revision: 1, createdAt: T0, updatedAt: T0,
    })
    return { administration, emitterId }
  })
  return { t, root, testClosed, administration, emitterId }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

function envelope(overrides: Record<string, FederationJson> = {}, eventId = "page-fixture-1"): FederationEnvelope {
  return {
    eventId, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef: ORG_REF,
    payload: {
      type: "page.upserted", orgRef: ORG_REF, revision: 1,
      name: "Direction de recette", shortName: "DR", description: "Mission publique de recette.",
      country: "GA", verifiedAt: T0 - 1_000,
      ...overrides,
    },
  }
}

async function apply(f: Fixture, event = envelope(), now = T0) {
  return await f.t.run(async (ctx) => {
    const emitter = await ctx.db.get(f.emitterId)
    if (!emitter) throw new Error("Émetteur de fixture absent")
    return await applyFederationEnvelope(ctx, emitter, event, now)
  })
}

async function state(t: T) {
  return await t.run(async (ctx) => ({
    pages: await ctx.db.query("pages").take(20),
    mirrors: await ctx.db.query("mirrors").take(20),
    people: await ctx.db.query("persons").take(20),
    memberships: await ctx.db.query("networkMemberships").take(20),
    identities: await ctx.db.query("identityLinks").take(20),
    signatories: await ctx.db.query("pageSignatories").take(20),
  }))
}

async function onlyPage(t: T) {
  const pages = await t.run(async (ctx) => ctx.db.query("pages").take(2))
  const page = pages[0]
  if (pages.length !== 1 || !page) throw new Error("Une page de fixture attendue")
  return page
}

async function codeOf(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("PA9A — pages officielles fédérées et révisions source", () => {
  it("crée une page Officiel et son miroir sans créer de personne, identité, adhésion ou signataire", async () => {
    const f = await fixture()
    const before = await state(f.t)
    expect(await apply(f)).toEqual({ applied: true })
    const after = await state(f.t)
    expect(after.pages).toHaveLength(1)
    expect(after.pages[0]).toMatchObject({
      networkId: f.administration, name: "Direction de recette", shortName: "DR",
      description: "Mission publique de recette.", country: "GA", ownerKind: "institution",
      trust: "official", trustRank: 2, visibility: "root", onRoot: true, status: "active",
      importRef: `${RESEAU_PUBLIC_CONTRACT}:${RESEAU_PUBLIC_EMITTER}:sandbox:${ORG_REF}`,
      createdAt: T0, updatedAt: T0,
    })
    expect(after.pages[0]).not.toHaveProperty("createdByPersonId")
    expect(after.mirrors).toHaveLength(1)
    expect(after.mirrors[0]).toMatchObject({
      networkId: f.administration, emitterId: f.emitterId, environment: "sandbox",
      contract: RESEAU_PUBLIC_CONTRACT, objectRef: ORG_REF, localTable: "pages",
      localId: after.pages[0]?._id, sourceRevision: 1, sourceState: "active", sourceVerifiedAt: T0 - 1_000,
    })
    expect(after.people).toEqual(before.people)
    expect(after.memberships).toEqual(before.memberships)
    expect(after.identities).toEqual(before.identities)
    expect(after.signatories).toEqual(before.signatories)
  })

  it("met à jour la même page avec une révision supérieure, sans changer son adresse ni sa date de création", async () => {
    const f = await fixture()
    await apply(f)
    const original = await onlyPage(f.t)
    const now = T0 + 10_000
    expect(await apply(f, envelope({ revision: 2, name: "Direction actualisée", shortName: "DA", description: "Mission actualisée." }, "page-fixture-2"), now)).toEqual({ applied: true })
    const after = await state(f.t)
    expect(after.pages).toHaveLength(1)
    expect(after.pages[0]).toMatchObject({
      _id: original._id, handle: original.handle, createdAt: original.createdAt,
      name: "Direction actualisée", shortName: "DA", description: "Mission actualisée.", updatedAt: now,
    })
    expect(after.mirrors).toHaveLength(1)
    expect(after.mirrors[0]).toMatchObject({ localId: original._id, sourceRevision: 2, updatedAt: now })
  })

  it("ignore une révision ancienne sans réécrire la page ni le miroir", async () => {
    const f = await fixture()
    await apply(f, envelope({ revision: 2, name: "Identité récente" }))
    const before = await state(f.t)
    expect(await apply(f, envelope({ revision: 1, name: "Identité ancienne" }, "page-fixture-old"), T0 + 10_000)).toEqual({ applied: true })
    expect(await state(f.t)).toEqual(before)
  })

  it("refuse une autre identité pour la même révision avec source_conflict, sans effet partiel", async () => {
    const f = await fixture()
    await apply(f)
    const before = await state(f.t)
    expect(await apply(f, envelope({ name: "Identité contradictoire" }, "page-fixture-conflict"), T0 + 10_000)).toEqual({ applied: false, reason: "source_conflict" })
    expect(await state(f.t)).toEqual(before)
  })

  it("retire Officiel et la diffusion active quand la source retire sa vérification", async () => {
    const f = await fixture()
    await apply(f)
    const page = await onlyPage(f.t)
    const now = T0 + 10_000
    expect(await apply(f, envelope({ revision: 2, verifiedAt: null }, "page-fixture-withdrawn"), now)).toEqual({ applied: true })
    const after = await state(f.t)
    expect(after.pages).toHaveLength(1)
    expect(after.pages[0]).toMatchObject({
      _id: page._id, trust: "community", trustRank: 0, visibility: "network",
      onRoot: false, status: "inactive", deactivatedAt: now,
    })
    expect(after.mirrors[0]).toMatchObject({ localId: page._id, sourceRevision: 2, sourceState: "withdrawn" })
    expect(after.mirrors[0]?.sourceVerifiedAt).toBeUndefined()
  })

  it("conserve une tombe sans page et empêche une ancienne upsert de créer la page", async () => {
    const f = await fixture()
    expect(await apply(f, envelope({ revision: 3, verifiedAt: null }, "page-fixture-tombstone"))).toEqual({ applied: true })
    const before = await state(f.t)
    expect(before.pages).toEqual([])
    expect(before.mirrors).toHaveLength(1)
    expect(before.mirrors[0]).toMatchObject({ sourceRevision: 3, sourceState: "withdrawn" })
    expect(before.mirrors[0]?.localId).toBeUndefined()
    expect(await apply(f, envelope({ revision: 2 }, "page-fixture-before-tombstone"), T0 + 10_000)).toEqual({ applied: true })
    expect(await state(f.t)).toEqual(before)
  })

  it("ne réactive pas une page désactivée localement après une nouvelle vérification positive", async () => {
    const f = await fixture()
    await apply(f)
    const page = await onlyPage(f.t)
    const deactivatedAt = T0 + 1_000
    await f.t.run(async (ctx) => ctx.db.patch(page._id, { status: "inactive", deactivatedAt }))
    expect(await apply(f, envelope({ revision: 2, name: "Identité mise à jour" }, "page-fixture-positive"), T0 + 10_000)).toEqual({ applied: true })
    expect(await onlyPage(f.t)).toMatchObject({ _id: page._id, name: "Identité mise à jour", trust: "official", status: "inactive", deactivatedAt })
  })

  it.each(["root", "other"] as const)("refuse le réseau %s, même avec l'émetteur attendu", async (target) => {
    const f = await fixture()
    await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { networkId: target === "root" ? f.root : f.testClosed }))
    const before = await state(f.t)
    expect(await apply(f)).toEqual({ applied: false, reason: "contract_not_allowed" })
    expect(await state(f.t)).toEqual(before)
  })

  it("refuse un émetteur autre qu'administration-ga sans créer de page", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { slug: "other-source" }))
    const before = await state(f.t)
    expect(await apply(f)).toEqual({ applied: false, reason: "contract_not_allowed" })
    expect(await state(f.t)).toEqual(before)
  })

  it("refuse un logo distant sans créer de page ni de miroir", async () => {
    const f = await fixture()
    const before = await state(f.t)
    expect(await apply(f, envelope({ logoUrl: "https://example.test/logo-public.png" }))).toEqual({ applied: false, reason: "unsupported_media" })
    expect(await state(f.t)).toEqual(before)
  })

  it("refuse un champ privé hors contrat sans créer de page ni de miroir", async () => {
    const f = await fixture()
    const before = await state(f.t)
    expect(await apply(f, envelope({ email: "fiction@example.test" }))).toEqual({ applied: false, reason: "invalid_payload" })
    expect(await state(f.t)).toEqual(before)
  })

  it("refuse la gestion native de la page créée, même après perte de son badge Officiel", async () => {
    const f = await fixture()
    await apply(f)
    const page = await onlyPage(f.t)
    expect(await codeOf(f.t.run(async (ctx) => assertNativePageManagement(ctx, page._id)))).toBe("notFound")
    await f.t.run(async (ctx) => ctx.db.patch(page._id, { trust: "community", trustRank: 0 }))
    expect(await codeOf(f.t.run(async (ctx) => assertNativePageManagement(ctx, page._id)))).toBe("notFound")
  })

  it("rejoue la même version sous un autre eventId sans réécriture ni changement d'horodatage", async () => {
    const f = await fixture()
    await apply(f)
    const before = await state(f.t)
    expect(await apply(f, envelope({}, "page-fixture-redelivery"), T0 + 60_000)).toEqual({ applied: true })
    expect(await state(f.t)).toEqual(before)
  })
})
