// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauAlbums/albums.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations) ; codes et règles au lieu des libellés (« Album introuvable. » → `notFound`, phrases → règles du domaine) ; un texte déguisé en image est refusé par la politique de dépôt (`UPLOAD_TYPE_NOT_ALLOWED`) avant le domaine ; photos rendues servables par l'analyse (garde des fichiers) ; une photo retirée est purgée (plus de tombe) ; `listMine`/`listForPerson` → `paginateMyAlbums`/`paginatePersonAlbums` ; tests neufs : retenue d'une photo non analysée, zéro orphelin après suppression (purge par lots), album d'un autre réseau introuvable, clé rejouée ailleurs refusée, cloche des abonnés à la première publication seulement et re-gardée.
/**
 * ALBUMS — ce que ce fichier tient, dans l'ordre d'importance :
 *  1. l'audience est recontrôlée à CHAQUE lecture — liste, détail, vignette et
 *     lien direct passent par la même garde ;
 *  2. anti-énumération : album inconnu, brouillon d'autrui, album réservé, album
 *     d'un autre réseau rendent le MÊME résultat ;
 *  3. la provenance d'une photo est un dépôt neuf de son propriétaire ;
 *  4. l'idempotence est PAR PHOTO ;
 *  5. aucun identifiant de stockage dans un DTO, aucune photo retenue montrée à
 *     un autre que son propriétaire, aucun orphelin après une suppression.
 */
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; handle: string }

const A = api.modules.albums.albums
const PAGE = { numItems: 10, cursor: null }

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 9, 15, 13, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string): Promise<Person> {
  vi.setSystemTime(Date.now() + 1000)
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: `Nom publié ${handle}` })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  return { as, personId, handle }
}

async function connect(t: T, networkId: Id<"networks">, a: Person, b: Person): Promise<void> {
  await t.run(async (ctx) => {
    const [low, high] = a.personId < b.personId ? [a.personId, b.personId] : [b.personId, a.personId]
    await ctx.db.insert("connections", { networkId, personIdLow: low, personIdHigh: high, requestedByPersonId: a.personId, recipientPersonId: b.personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
  })
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

const codeOf = async (promise: Promise<unknown>) => engineErrorCode(await caught(promise))
const ruleOf = async (promise: Promise<unknown>) => engineErrorRule(await caught(promise))?.rule ?? null

/** Un blob RÉEL du harnais, AVEC son type (le patch système le pose ; `storage.store` ne l'enregistre pas). */
async function storeBlob(t: T, contentType = "image/jpeg", bytes = 64): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)], { type: contentType }))
    await (ctx.db as unknown as { patch: (table: "_storage", id: Id<"_storage">, value: { contentType: string }) => Promise<void> }).patch("_storage", storageId, { contentType })
    return storageId
  })
}

/** L'analyse a parlé pour toutes les photos de l'album : elles sont servables (saines). */
async function cleanAll(t: T, albumId: Id<"albums">): Promise<void> {
  await t.run(async (ctx) => {
    const items = await ctx.db
      .query("albumItems")
      .withIndex("by_album_position", (q) => q.eq("albumId", albumId))
      .take(300)
    for (const item of items) {
      const scan = await ctx.db
        .query("fileScans")
        .withIndex("by_storageId", (q) => q.eq("storageId", item.media.storageId))
        .first()
      if (scan) await ctx.db.patch(scan._id, { status: "clean", updatedAt: Date.now() })
    }
  })
}

async function declared(t: T, key: string, contentType = "image/jpeg") {
  return { storageId: await storeBlob(t, contentType), mimeType: contentType, sizeBytes: 64, idempotencyKey: key }
}

/** Un album PRÊT : créé, des photos SAINES dedans, publié si demandé. */
async function mkAlbum(t: T, owner: Person, networkId: Id<"networks">, options: { audience?: "public" | "connections"; publish?: boolean; photos?: number; servable?: boolean } = {}) {
  const { albumId } = await owner.as.mutation(A.create, { networkId, title: "Mission de terrain", audience: options.audience ?? "public" })
  const photos = options.photos ?? 1
  for (let start = 0; start < photos; start += 12) {
    const items = []
    for (let index = start; index < Math.min(photos, start + 12); index += 1) items.push(await declared(t, `photo-${index}`))
    await owner.as.mutation(A.addItems, { networkId, albumId, items })
  }
  if (options.servable !== false) await cleanAll(t, albumId)
  if (options.publish) await owner.as.mutation(A.publish, { networkId, albumId })
  return albumId
}

// ═══════════════════════════════════════════════════════════════
// Préparation — privé par défaut
// ═══════════════════════════════════════════════════════════════

describe("créer — le brouillon est PRIVÉ, quelle que soit l'audience", () => {
  it("naît en brouillon, et le brouillon ne sort d'aucune liste publique", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await connect(t, root, alice, bob)
    const albumId = await mkAlbum(t, alice, root, { audience: "public" })
    const mine = await alice.as.query(A.paginateMyAlbums, { networkId: root, paginationOpts: PAGE })
    expect(mine.page.map((album) => album.status)).toEqual(["draft"])
    expect((await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })).page).toEqual([])
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
  })

  it("la clé d'idempotence rend l'album EXISTANT sans rien revalider ; rejouée dans un autre réseau, elle est refusée", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const first = await alice.as.mutation(A.create, { networkId: root, title: "Séminaire", audience: "public", idempotencyKey: "k1" })
    const replay = await alice.as.mutation(A.create, { networkId: root, title: "Autre titre", audience: "connections", idempotencyKey: "k1" })
    expect(first.created).toBe(true)
    expect(replay).toEqual({ albumId: first.albumId, created: false })
    const mine = await alice.as.query(A.paginateMyAlbums, { networkId: root, paginationOpts: PAGE })
    expect(mine.page.map((album) => album.title)).toEqual(["Séminaire"])
    await t.run(async (ctx) => {
      await ctx.db.insert("networkMemberships", { networkId: testClosed, personId: alice.personId, status: "declaree", role: "member", joinedAt: 1, statusChangedAt: 1 })
    })
    expect(await codeOf(alice.as.mutation(A.create, { networkId: testClosed, title: "Séminaire", audience: "public", idempotencyKey: "k1" }))).toBe("conflict")
  })

  it("un titre vide est refusé", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    expect(await ruleOf(alice.as.mutation(A.create, { networkId: root, title: "   ", audience: "public" }))).toBe("ALBUM_TITLE_REQUIRED")
  })
})

// ═══════════════════════════════════════════════════════════════
// Ajouter — idempotence par photo, reprise, plafond, provenance
// ═══════════════════════════════════════════════════════════════

describe("addItems — idempotent PAR PHOTO", () => {
  it("une DOUBLE SOUMISSION du même lot n'ajoute rien la seconde fois", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { albumId } = await alice.as.mutation(A.create, { networkId: root, title: "Chantier", audience: "public" })
    const lot = [await declared(t, "p1"), await declared(t, "p2")]
    const first = await alice.as.mutation(A.addItems, { networkId: root, albumId, items: lot })
    expect(first).toMatchObject({ added: 2, skipped: 0 })
    const second = await alice.as.mutation(A.addItems, { networkId: root, albumId, items: lot })
    expect(second).toMatchObject({ added: 0, skipped: 2 })
    expect(second.itemIds).toEqual(first.itemIds)
    const detail = await alice.as.query(A.getAlbum, { networkId: root, albumId })
    expect(detail?.items).toHaveLength(2)
    expect(detail?.album.itemCount).toBe(2)
  })

  it("REPREND un téléversement partiel : le renvoi n'ajoute que ce qui manque", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { albumId } = await alice.as.mutation(A.create, { networkId: root, title: "Reprise", audience: "public" })
    const deja = [await declared(t, "a"), await declared(t, "b")]
    await alice.as.mutation(A.addItems, { networkId: root, albumId, items: deja })
    const reprise = await alice.as.mutation(A.addItems, { networkId: root, albumId, items: [...deja, await declared(t, "c")] })
    expect(reprise).toMatchObject({ added: 1, skipped: 2 })
    const detail = await alice.as.query(A.getAlbum, { networkId: root, albumId })
    expect(detail?.items.map((item) => item.position)).toEqual([0, 1, 2])
  })

  it("un storageId ÉTRANGER se refuse INDISTINCTEMENT — inventé, ou déjà admis pour un autre", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const { albumId } = await alice.as.mutation(A.create, { networkId: root, title: "Provenance", audience: "public" })
    const inconnu = await storeBlob(t)
    await t.run(async (ctx) => await ctx.storage.delete(inconnu))
    expect(await codeOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: [{ storageId: inconnu, mimeType: "image/jpeg", sizeBytes: 64, idempotencyKey: "x" }] }))).toBe("notFound")
    // La photo d'un album de Bob ne s'attache pas à celui d'Alice.
    const bobAlbum = await mkAlbum(t, bob, root)
    const bobPhoto = await t.run(async (ctx) => (await ctx.db.query("albumItems").withIndex("by_album_position", (q) => q.eq("albumId", bobAlbum)).first())!.media.storageId)
    expect(await codeOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: [{ storageId: bobPhoto, mimeType: "image/jpeg", sizeBytes: 64, idempotencyKey: "y" }] }))).toBe("notFound")
  })

  it("la VÉRITÉ DU STOCKAGE écrase le déclaré : un texte déguisé en image est refusé", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { albumId } = await alice.as.mutation(A.create, { networkId: root, title: "Déguisement", audience: "public" })
    const texte = await storeBlob(t, "text/plain")
    expect(await ruleOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: [{ storageId: texte, mimeType: "image/jpeg", sizeBytes: 64, idempotencyKey: "x" }] }))).toBe(
      "UPLOAD_TYPE_NOT_ALLOWED",
    )
    const video = await storeBlob(t, "video/mp4")
    expect(await ruleOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: [{ storageId: video, mimeType: "video/mp4", sizeBytes: 64, idempotencyKey: "v" }] }))).toBe("ALBUM_MEDIA_MIME_INVALID")
  })

  it("l'album d'AUTRUI ne se remplit pas, et le refus est indistinct", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { publish: true })
    expect(await codeOf(bob.as.mutation(A.addItems, { networkId: root, albumId, items: [await declared(t, "intrus")] }))).toBe("notFound")
  })

  it("borne le LOT et le plafond — la reprise reste le chemin normal", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { albumId } = await alice.as.mutation(A.create, { networkId: root, title: "Gros lot", audience: "public" })
    const treize = []
    for (let index = 0; index < 13; index += 1) treize.push(await declared(t, `g-${index}`))
    expect(await ruleOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: treize }))).toBe("ALBUM_BATCH_TOO_LARGE")
    await t.run(async (ctx) => await ctx.db.patch(albumId, { itemCount: 60 }))
    expect(await ruleOf(alice.as.mutation(A.addItems, { networkId: root, albumId, items: [await declared(t, "soixante-et-un")] }))).toBe("ALBUM_FULL")
  })
})

// ═══════════════════════════════════════════════════════════════
// Ordonner, légender, couvrir, retirer une photo
// ═══════════════════════════════════════════════════════════════

describe("ordonner, légender, couvrir, retirer une photo", () => {
  it("réordonne, et la galerie rend le nouvel ordre ; un ordre PARTIEL est refusé", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const albumId = await mkAlbum(t, alice, root, { photos: 3 })
    const ids = (await alice.as.query(A.getAlbum, { networkId: root, albumId }))!.items.map((item) => item.itemId)
    expect(await alice.as.mutation(A.reorder, { networkId: root, albumId, itemIds: [ids[2]!, ids[0]!, ids[1]!] })).toEqual({ moved: 3 })
    expect((await alice.as.query(A.getAlbum, { networkId: root, albumId }))!.items.map((item) => item.itemId)).toEqual([ids[2], ids[0], ids[1]])
    expect(await ruleOf(alice.as.mutation(A.reorder, { networkId: root, albumId, itemIds: [ids[0]!] }))).toBe("ALBUM_REORDER_MISMATCH")
  })

  it("légende et texte alternatif reviennent au lecteur autorisé", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { publish: true })
    const [item] = (await alice.as.query(A.getAlbum, { networkId: root, albumId }))!.items
    await alice.as.mutation(A.setCaption, { networkId: root, itemId: item!.itemId, caption: "  Remise des clés  ", altText: "Un bâtiment neuf" })
    expect((await bob.as.query(A.getAlbum, { networkId: root, albumId }))!.items[0]).toMatchObject({ caption: "Remise des clés", altText: "Un bâtiment neuf" })
  })

  it("la couverture retirée REPLIE sur la première photo, et la photo retirée est PURGÉE", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const albumId = await mkAlbum(t, alice, root, { photos: 2, publish: true })
    const [premiere, seconde] = (await alice.as.query(A.getAlbum, { networkId: root, albumId }))!.items
    await alice.as.mutation(A.setCover, { networkId: root, albumId, itemId: seconde!.itemId })
    expect((await alice.as.query(A.getAlbum, { networkId: root, albumId }))!.coverItemId).toBe(seconde!.itemId)
    const blob = await t.run(async (ctx) => (await ctx.db.get(seconde!.itemId))!.media.storageId)
    expect(await alice.as.mutation(A.removeItem, { networkId: root, itemId: seconde!.itemId })).toEqual({ removed: true })
    expect(await alice.as.mutation(A.removeItem, { networkId: root, itemId: seconde!.itemId })).toEqual({ removed: false })
    const apres = await alice.as.query(A.getAlbum, { networkId: root, albumId })
    expect(apres?.coverItemId).toBe(premiere!.itemId)
    expect(apres?.album.itemCount).toBe(1)
    expect(apres?.album.cover?.url).toEqual(expect.any(String))
    expect(
      await t.run(async (ctx) => ({
        blob: (await ctx.db.system.get("_storage", blob)) !== null,
        scan: (await ctx.db.query("fileScans").withIndex("by_storageId", (q) => q.eq("storageId", blob)).first()) !== null,
      })),
    ).toEqual({ blob: false, scan: false })
  })
})

// ═══════════════════════════════════════════════════════════════
// Publier, lire, retirer — l'ACL
// ═══════════════════════════════════════════════════════════════

describe("ACL — l'audience recontrôlée à chaque lecture", () => {
  it("publié + connexions : la connexion voit, l'inconnu ne voit RIEN (même liste vide)", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, bob)
    const albumId = await mkAlbum(t, alice, root, { audience: "connections", publish: true })
    expect((await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })).page.map((album) => album.albumId)).toEqual([albumId])
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).not.toBeNull()
    expect((await carla.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })).page).toEqual([])
    expect(await carla.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
  })

  it("la connexion ROMPUE (ou un blocage) referme la galerie, sans révocation à faire", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await connect(t, root, alice, bob)
    const albumId = await mkAlbum(t, alice, root, { audience: "connections", publish: true })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).not.toBeNull()
    await bob.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: alice.personId })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
    expect((await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })).page).toEqual([])
  })

  it("un BLOCAGE ferme même une audience `public`", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { audience: "public", publish: true })
    await bob.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: alice.personId })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
  })

  it("un album RETIRÉ disparaît de la liste et du lien direct — son propriétaire le retrouve", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { publish: true })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).not.toBeNull()
    await alice.as.mutation(A.withdraw, { networkId: root, albumId })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
    expect((await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })).page).toEqual([])
    expect(await alice.as.query(A.getAlbum, { networkId: root, albumId })).not.toBeNull()
    expect(await ruleOf(alice.as.mutation(A.withdraw, { networkId: root, albumId }))).toBe("ALBUM_NOT_PUBLISHED")
  })

  it("un identifiant inconnu rend une liste vide et finie ; un album d'un autre réseau est introuvable", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const vide = await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "personne", paginationOpts: PAGE })
    expect(vide).toMatchObject({ page: [], isDone: true })
    await t.run(async (ctx) => {
      for (const person of [alice, bob]) await ctx.db.insert("networkMemberships", { networkId: testClosed, personId: person.personId, status: "declaree", role: "member", joinedAt: 1, statusChangedAt: 1 })
    })
    const closedAlbum = await mkAlbum(t, alice, testClosed, { publish: true })
    expect(await bob.as.query(A.getAlbum, { networkId: testClosed, albumId: closedAlbum })).not.toBeNull()
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId: closedAlbum })).toBeNull()
    expect(await alice.as.query(A.getAlbum, { networkId: root, albumId: closedAlbum })).toBeNull()
  })

  it("republier rouvre l'album en gardant sa date d'origine ; publier deux fois est un rejeu ; un album vide ne se publie pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { publish: true })
    const premier = await alice.as.query(A.getAlbum, { networkId: root, albumId })
    expect(await alice.as.mutation(A.publish, { networkId: root, albumId })).toEqual({ status: "published", published: false })
    vi.setSystemTime(Date.now() + 60_000)
    await alice.as.mutation(A.withdraw, { networkId: root, albumId })
    expect(await alice.as.mutation(A.publish, { networkId: root, albumId })).toEqual({ status: "published", published: true })
    expect((await alice.as.query(A.getAlbum, { networkId: root, albumId }))?.album.publishedAt).toBe(premier?.album.publishedAt)
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).not.toBeNull()
    const empty = await mkAlbum(t, alice, root, { photos: 0 })
    expect(await ruleOf(alice.as.mutation(A.publish, { networkId: root, albumId: empty }))).toBe("ALBUM_EMPTY")
  })

  it("un membre en attente prépare son album, mais ne le publie pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const albumId = await mkAlbum(t, alice, root)
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", alice.personId))
        .unique()
      await ctx.db.patch(membership!._id, { status: "en_attente" })
    })
    expect((await alice.as.mutation(A.update, { networkId: root, albumId, title: "Nouveau titre" })).updated).toBe(true)
    expect(await codeOf(alice.as.mutation(A.publish, { networkId: root, albumId }))).toBe("statusInsufficient")
  })
})

// ═══════════════════════════════════════════════════════════════
// Supprimer — zéro orphelin
// ═══════════════════════════════════════════════════════════════

describe("supprimer un album", () => {
  it("SUPPRIMER ferme tout aussitôt — le lien direct ne rend plus rien, pour personne", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { photos: 2, publish: true })
    expect(await alice.as.mutation(A.remove, { networkId: root, albumId })).toEqual({ removed: true, pending: false })
    expect(await bob.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
    expect(await alice.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
    expect(await codeOf(alice.as.mutation(A.remove, { networkId: root, albumId }))).toBe("notFound")
  })

  it("ne laisse AUCUN orphelin : photos, blobs et lignes d'analyse purgés par lots (D09)", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const albumId = await mkAlbum(t, alice, root, { photos: 35, publish: true })
    const blobs = await t.run(async (ctx) => (await ctx.db.query("albumItems").withIndex("by_album_position", (q) => q.eq("albumId", albumId)).take(100)).map((item) => item.media.storageId))
    expect(blobs).toHaveLength(35)
    // Le premier lot part avec la suppression ; l'album est déjà introuvable.
    expect(await alice.as.mutation(A.remove, { networkId: root, albumId })).toEqual({ removed: true, pending: true })
    expect(await alice.as.query(A.getAlbum, { networkId: root, albumId })).toBeNull()
    expect((await alice.as.query(A.paginateMyAlbums, { networkId: root, paginationOpts: PAGE })).page).toEqual([])
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const left = await t.run(async (ctx) => {
      let liveBlobs = 0
      let scans = 0
      for (const storageId of blobs) {
        if ((await ctx.db.system.get("_storage", storageId)) !== null) liveBlobs += 1
        if ((await ctx.db.query("fileScans").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).first()) !== null) scans += 1
      }
      return {
        album: (await ctx.db.get(albumId)) !== null,
        items: (await ctx.db.query("albumItems").withIndex("by_owner_createdAt", (q) => q.eq("ownerPersonId", alice.personId)).take(100)).length,
        liveBlobs,
        scans,
      }
    })
    expect(left).toEqual({ album: false, items: 0, liveBlobs: 0, scans: 0 })
  })
})

// ═══════════════════════════════════════════════════════════════
// Les DTO, la garde des fichiers, la cloche
// ═══════════════════════════════════════════════════════════════

describe("les DTO ne portent ni identifiant de stockage ni état civil", () => {
  it("détail et liste sont des allowlists", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { photos: 2, publish: true })
    const detail = await bob.as.query(A.getAlbum, { networkId: root, albumId })
    const serialised = JSON.stringify(detail)
    expect(serialised).not.toContain("storageId")
    expect(serialised).not.toContain("sizeBytes")
    expect(detail?.items[0]?.url).toEqual(expect.any(String))
    expect(detail?.owner).toMatchObject({ handle: "alice", displayName: "Nom publié alice" })
    expect(detail?.album.isOwner).toBe(false)
    const list = await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })
    expect(JSON.stringify(list)).not.toContain("storageId")
    expect(list.page[0]?.cover?.url).toEqual(expect.any(String))
  })

  it("une photo NON ANALYSÉE est retenue : montrée « en cours » à son propriétaire, absente pour les autres, vignette comprise", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const albumId = await mkAlbum(t, alice, root, { photos: 1, servable: false })
    await alice.as.mutation(A.publish, { networkId: root, albumId })
    expect((await alice.as.query(A.getAlbum, { networkId: root, albumId }))?.items).toMatchObject([{ url: null, withheld: "fileScanPending" }])
    const seen = await bob.as.query(A.getAlbum, { networkId: root, albumId })
    expect(seen?.items).toEqual([])
    expect(seen?.album.cover).toBeNull()
    await cleanAll(t, albumId)
    expect((await bob.as.query(A.getAlbum, { networkId: root, albumId }))?.items).toHaveLength(1)
  })

  it("la vignette d'un album fermé n'est jamais servie", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await mkAlbum(t, alice, root, { audience: "connections", publish: true })
    const list = await bob.as.query(A.paginatePersonAlbums, { networkId: root, handle: "alice", paginationOpts: PAGE })
    expect(list.page).toEqual([])
    expect(JSON.stringify(list)).not.toContain("http")
  })

  it("les abonnés sont prévenus à la PREMIÈRE publication seulement, et seulement s'ils voient l'album", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const follower = await enter(t, root, "abonne")
    const friend = await enter(t, root, "amie")
    await connect(t, root, alice, friend)
    for (const person of [follower, friend]) await person.as.mutation(api.modules.graph.follows.follow, { networkId: root, handle: "alice" })
    const bell = async (person: Person) => (await person.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: PAGE })).page
    const reserved = await mkAlbum(t, alice, root, { audience: "connections", publish: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await bell(friend)).filter((row) => row.kind === "album_published")).toMatchObject([{ subject: { kind: "album", id: reserved }, actor: { handle: "alice" } }])
    expect((await bell(follower)).filter((row) => row.kind === "album_published")).toEqual([])
    const open = await mkAlbum(t, alice, root, { publish: true })
    await alice.as.mutation(A.withdraw, { networkId: root, albumId: open })
    await alice.as.mutation(A.publish, { networkId: root, albumId: open })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await bell(follower)).filter((row) => row.kind === "album_published").map((row) => row.subject?.id)).toEqual([open])
  })
})

describe("pagination", () => {
  it("`paginateMyAlbums` pagine et borne la taille demandée", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    await t.run(async (ctx) => {
      for (let index = 0; index < 30; index += 1) {
        await ctx.db.insert("albums", { networkId: root, ownerPersonId: alice.personId, title: `Album ${index}`, audience: "public", status: "draft", itemCount: 0, createdAt: index, updatedAt: index })
      }
    })
    const first = await alice.as.query(A.paginateMyAlbums, { networkId: root, paginationOpts: { numItems: 100, cursor: null } })
    expect(first.page).toHaveLength(24)
    expect(first.isDone).toBe(false)
    const second = await alice.as.query(A.paginateMyAlbums, { networkId: root, paginationOpts: { numItems: 100, cursor: first.continueCursor } })
    expect(second.page).toHaveLength(6)
    expect(new Set([...first.page, ...second.page].map((album) => album.albumId)).size).toBe(30)
  })
})
