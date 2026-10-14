// @vitest-environment edge-runtime
/**
 * Fondations multi-réseaux (PA2, cahier §5 et §12) : adhésion dérivée,
 * suspension à la racine, étanchéité entre réseaux, refus indistinct,
 * validation du schéma, graine gardée, console.
 */
import { describe, expect, it } from "vitest"

import { api, internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { requireMembership } from "../lib/access"
import { SEED_CONFIRMATION, seedsAllowed } from "../seeds/foundations"
import { testConvex } from "../test.setup"

type T = ReturnType<typeof testConvex>

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

/** Une personne qui a choisi son profil et consenti au profil social. */
async function onboardedPerson(t: T, subject: string, handle: string) {
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await t.run(async (ctx) => {
    await ctx.db.patch(personId, { handle, displayName: handle, publishedAt: Date.now() })
  })
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  return { as, personId }
}

async function makeOperator(t: T, personId: Id<"persons">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("operators", { personId, role: "platform_operator", grantedAt: Date.now() })
  })
}

async function membershipOf(t: T, networkId: Id<"networks">, personId: Id<"persons">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", personId))
      .unique(),
  )
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data
    return data?.code ?? `non-moteur: ${String(error)}`
  }
  return "aucune erreur"
}

describe("graine des fondations", () => {
  it("pose la racine ouverte et un réseau fermé enfant, sans rien doubler au second passage", async () => {
    const t = testConvex()
    const first = await seed(t)
    expect(first.created).toEqual(["antia", "test-closed"])
    const second = await seed(t)
    expect(second.created).toEqual([])
    expect(second.root).toEqual(first.root)
    const networks = await t.run(async (ctx) => ctx.db.query("networks").take(10))
    expect(networks.map((n) => [n.slug, n.kind, n.membershipPolicy])).toEqual([
      ["antia", "root", "open"],
      ["test-closed", "closed", "declared_or_verified"],
    ])
  })

  it("est refusée sans confirmation, et hors d'un déploiement local ou autorisé", async () => {
    const t = testConvex()
    await expect(t.mutation(internal.seeds.foundations.run, { confirmNonProduction: "oui" })).rejects.toThrow(/hors production/)
    expect(seedsAllowed({})).toBe(false)
    expect(seedsAllowed({ CONVEX_CLOUD_URL: "https://exemple.convex.cloud" })).toBe(false)
    expect(seedsAllowed({ CONVEX_CLOUD_URL: "http://127.0.0.1:3210" })).toBe(true)
    expect(seedsAllowed({ ANTIA_SEEDS_ALLOWED: "true" })).toBe(true)
  })
})

describe("personne unique et entrée explicite", () => {
  it("la première session crée la personne SANS identifiant, nom ni adhésion", async () => {
    const t = testConvex()
    await seed(t)
    const as = t.withIdentity({ subject: "auth-1" })
    const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    expect(await as.mutation(api.modules.people.persons.ensureMyPerson, {})).toEqual(personId)
    const me = await as.query(api.modules.people.persons.getMyPerson, {})
    expect(me).toMatchObject({ _id: personId, published: false, private: false, badges: ["community"], consentsInForce: [] })
    expect(me?.handle).toBeUndefined()
    expect(await as.query(api.modules.people.memberships.myMemberships, {})).toEqual([])
  })

  it("sans session : aucune personne", async () => {
    const t = testConvex()
    expect(await t.query(api.modules.people.persons.getMyPerson, {})).toBeNull()
    expect(await errorCode(t.mutation(api.modules.people.persons.ensureMyPerson, {}))).toBe("unauthenticated")
  })

  it("entrer exige un profil choisi PUIS le consentement au profil social", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const as = t.withIdentity({ subject: "auth-2" })
    const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    expect(await errorCode(as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root }))).toBe("profileRequired")
    await t.run(async (ctx) => ctx.db.patch(personId, { handle: "ada.lovelace", displayName: "Ada", publishedAt: Date.now() }))
    expect(await errorCode(as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root }))).toBe("consentRequired")
    await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
    expect(await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })).toEqual({ status: "declaree", rootStatus: "declaree" })
  })

  it("une identité IDN de garantie ≥ 2 entre « vérifiée » dans la racine ouverte (R1)", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const { as, personId } = await onboardedPerson(t, "auth-idn", "idn.person")
    await t.run(async (ctx) => {
      await ctx.db.insert("identityLinks", { personId, provider: "idn", subject: "idn-sub-1", loa: 2, linkedAt: Date.now() })
    })
    expect(await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })).toEqual({ status: "verifiee", rootStatus: "verifiee" })
    expect((await as.query(api.modules.people.persons.getMyPerson, {}))?.badges).toEqual(["verified"])
  })
})

describe("adhésion dérivée vers la racine (invariant 3, R3)", () => {
  it("entrer dans un réseau fermé crée l'adhésion racine, dérivée de l'enfant", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const { as, personId } = await onboardedPerson(t, "auth-3", "membre.ferme")
    const result = await as.mutation(api.modules.people.memberships.joinNetwork, {
      networkId: testClosed,
      facet: { values: { countryOfResidence: "FR" }, visibilities: {} },
    })
    // Compte léger dans une politique « déclarée ou vérifiée » : en attente ; la racine, ouverte, le déclare.
    expect(result).toEqual({ status: "en_attente", rootStatus: "declaree" })
    const rootMembership = await membershipOf(t, root, personId)
    expect(rootMembership).toMatchObject({ status: "declaree", derivedFrom: testClosed })
    const memberships = await as.query(api.modules.people.memberships.myMemberships, {})
    expect(memberships.map((m) => [m.slug, m.status]).sort()).toEqual([
      ["antia", "declaree"],
      ["test-closed", "en_attente"],
    ])
  })

  it("la facette du réseau est exigée et validée (pays de résidence ≠ GA)", async () => {
    const t = testConvex()
    const { testClosed } = await seed(t)
    const { as } = await onboardedPerson(t, "auth-4", "sans.facette")
    expect(await errorCode(as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed }))).toBe("invalidArgument")
    expect(
      await errorCode(
        as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "GA" }, visibilities: {} } }),
      ),
    ).toBe("invalidArgument")
  })

  it("quitter un réseau fermé ne retire pas la racine ; quitter la racine fait tout quitter", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const { as, personId } = await onboardedPerson(t, "auth-5", "partant")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    await as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: testClosed })
    expect((await membershipOf(t, testClosed, personId))?.status).toBe("partie")
    expect((await membershipOf(t, root, personId))?.status).toBe("declaree")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    expect((await membershipOf(t, testClosed, personId))?.status).toBe("en_attente")
    await as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: root })
    expect((await membershipOf(t, root, personId))?.status).toBe("partie")
    expect((await membershipOf(t, testClosed, personId))?.status).toBe("partie")
  })
})

describe("suspension à la racine = partout (invariant 3, R7)", () => {
  it("une personne suspendue à la racine n'accède plus à aucun réseau, n'en rejoint aucun, et retrouve son statut à la levée", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const { as, personId } = await onboardedPerson(t, "auth-6", "sanctionne")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    const operator = await onboardedPerson(t, "auth-op", "operateur")
    await makeOperator(t, operator.personId)
    await operator.as.mutation(api.modules.people.memberships.suspendEverywhere, { personId, reason: "Harcèlement répété (test)" })

    // La garde refuse partout, y compris dans le réseau fermé où l'adhésion locale est intacte.
    await t.run(async (ctx) => {
      await expect(requireMembershipAs(ctx, "auth-6", testClosed)).rejects.toMatchObject({ data: { code: "membershipSuspended" } })
      await expect(requireMembershipAs(ctx, "auth-6", root)).rejects.toMatchObject({ data: { code: "membershipSuspended" } })
    })
    expect((await membershipOf(t, testClosed, personId))?.status).toBe("en_attente")
    expect(await errorCode(as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: root }))).toBe("membershipSuspended")

    await operator.as.mutation(api.modules.people.memberships.liftSuspension, { personId })
    expect((await membershipOf(t, root, personId))?.status).toBe("declaree")
  })
})

/** Rejoue `requireMembership` avec l'identité d'un sujet donné (la garde lit `ctx.auth`). */
async function requireMembershipAs(ctx: Parameters<Parameters<T["run"]>[0]>[0], subject: string, networkId: Id<"networks">) {
  const scoped = { ...ctx, auth: { getUserIdentity: async () => ({ subject, issuer: "test", tokenIdentifier: `test|${subject}` }) } }
  return await requireMembership(scoped as never, networkId, "en_attente")
}

describe("étanchéité et refus indistinct (invariants 1 et 8, R10)", () => {
  it("un membre d'un réseau fermé lit la racine mais pas un autre réseau fermé — même refus qu'un réseau inexistant", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const operator = await onboardedPerson(t, "auth-op2", "operateur.deux")
    await makeOperator(t, operator.personId)
    const other = await operator.as.mutation(api.modules.networks.networks.create, {
      slug: "autre-ferme",
      kind: "closed",
      name: "Autre réseau fermé",
      membershipPolicy: "declared_or_verified",
      defaultVisibility: "network",
      reachValues: [],
      theme: "antia",
    })
    const { as } = await onboardedPerson(t, "auth-7", "membre.diaspo")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })

    await t.run(async (ctx) => {
      await expect(requireMembershipAs(ctx, "auth-7", root)).resolves.toMatchObject({ network: { slug: "antia" } })
      await expect(requireMembershipAs(ctx, "auth-7", testClosed)).resolves.toMatchObject({ network: { slug: "test-closed" } })
      // Hors réseau et réseau supprimé : la MÊME réponse.
      await expect(requireMembershipAs(ctx, "auth-7", other)).rejects.toMatchObject({ data: { code: "notFound" } })
      await ctx.db.delete(other)
      await expect(requireMembershipAs(ctx, "auth-7", other)).rejects.toMatchObject({ data: { code: "notFound" } })
    })
    // Une fonction sociale bornée par le réseau refuse de même, sans rien dire du réseau.
    expect(await errorCode(as.query(api.modules.people.facets.myFacet, { networkId: other }))).toBe("notFound")
  })

  it("un membre en attente lit, mais n'écrit pas là où le statut « déclarée » est exigé", async () => {
    const t = testConvex()
    const { testClosed } = await seed(t)
    const { as } = await onboardedPerson(t, "auth-8", "en.attente")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    await t.run(async (ctx) => {
      const scoped = { ...ctx, auth: { getUserIdentity: async () => ({ subject: "auth-8", issuer: "test", tokenIdentifier: "test|auth-8" }) } }
      await expect(requireMembership(scoped as never, testClosed, "declaree")).rejects.toMatchObject({ data: { code: "statusInsufficient" } })
    })
    // Lecture de sa facette : permise en attente.
    expect(await as.query(api.modules.people.facets.myFacet, { networkId: testClosed })).toMatchObject({ values: { countryOfResidence: "FR" } })
  })
})

describe("console du moteur : les réseaux se créent et s'archivent sans déploiement", () => {
  it("refuse un non-opérateur, une seconde racine, un identifiant invalide ; archive avec motif, jamais la racine", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const { as: visitor } = await onboardedPerson(t, "auth-9", "visiteur")
    const args = { name: "Réseau", membershipPolicy: "open" as const, defaultVisibility: "network" as const, reachValues: [], theme: "antia" }
    expect(await errorCode(visitor.mutation(api.modules.networks.networks.create, { slug: "nouveau", kind: "closed", ...args }))).toBe("operatorRequired")

    const operator = await onboardedPerson(t, "auth-op3", "operateur.trois")
    await makeOperator(t, operator.personId)
    expect(await errorCode(operator.as.mutation(api.modules.networks.networks.create, { slug: "racine-bis", kind: "root", ...args }))).toBe("conflict")
    expect(await errorCode(operator.as.mutation(api.modules.networks.networks.create, { slug: "A!", kind: "closed", ...args }))).toBe("invalidArgument")
    const created = await operator.as.mutation(api.modules.networks.networks.create, { slug: "ville-test", kind: "closed", ...args })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "ville-test" })).toMatchObject({ _id: created, parentId: root })

    expect(await errorCode(operator.as.mutation(api.modules.networks.networks.archive, { networkId: created, reason: "court" }))).toBe("invalidArgument")
    expect(await errorCode(operator.as.mutation(api.modules.networks.networks.archive, { networkId: root, reason: "La racine ne s'archive jamais." }))).toBe("invalidArgument")
    await operator.as.mutation(api.modules.networks.networks.archive, { networkId: created, reason: "Réseau de test fermé après la recette." })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "ville-test" })).toBeNull()
    const history = await t.run(async (ctx) =>
      ctx.db
        .query("networkSettingsHistory")
        .withIndex("by_network_and_at", (q) => q.eq("networkId", created))
        .take(10),
    )
    expect(history.map((entry) => entry.kind)).toEqual(["created", "archived"])
  })
})

describe("validation du schéma ACTIVE (invariant du moteur)", () => {
  it("refuse un document qui ne respecte pas le validateur de sa table", async () => {
    const t = testConvex()
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert("networks", { slug: "x" } as never)
      }),
    ).rejects.toThrow()
  })

  it("aucun champ de badge n'est stocké : les badges sont calculés (invariant 5)", async () => {
    const schema = (await import("../schema")).default
    for (const [table, definition] of Object.entries(schema.tables)) {
      const fields = Object.keys((definition.validator as { fields?: Record<string, unknown> }).fields ?? {})
      expect(fields.filter((field) => /badge/i.test(field)), table).toEqual([])
    }
  })
})

describe("limitation de débit réelle (composant monté)", () => {
  it("refuse au-delà du seuil, avec le délai d'attente", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const { as } = await onboardedPerson(t, "auth-rl", "presse")
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
    const codes: string[] = []
    for (let attempt = 0; attempt < 8; attempt += 1) {
      codes.push(await errorCode(as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })))
    }
    expect(codes).toContain("rateLimited")
  })
})
