// Dupliqué de socle/convex/modules/reseauPersonnel/people.ts (l. 547-650, `searchPeople`) @ ad2e7fdc2 — adaptations : annuaire PAR RÉSEAU — projection cherchable dénormalisée (`peopleDirectory`, `filterFields: ["networkId", "listed"]`) au lieu d'un index global des profils, pour ne jamais rendre un non-membre ni une personne d'un autre réseau ; recherche repliée sans accents (`foldSearchQuery`) ; badges calculés joints ; garde d'adhésion par le constructeur au lieu d'`assertNotSuspended` ; filtre du blocage branché avec le graphe (lot 4).
/**
 * L'annuaire d'un réseau : chercher une personne parmi les MEMBRES qui ont
 * choisi d'être trouvés (profil publié, non privé).
 *
 * Une requête vide ne rend RIEN — délibérément : « chercher sans chercher »
 * serait un déversement de l'annuaire. L'identifiant est une ADRESSE : il se
 * cherche aussi EXACTEMENT, en plus de la ressemblance du nom.
 */
import type { Badge } from "@antia/social-domain/badges"
import { normalizeHandle } from "@antia/social-domain/content"
import { isActiveStatus } from "@antia/social-domain/membership"
import { buildSearchableText, foldSearchQuery } from "@antia/social-domain/searchText"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { networkQuery } from "../../lib/functions"
import { badgeValidator } from "../../lib/validators"
import { servableUrl } from "../files/storageGuard"
import { isDiscoverablePerson } from "./miniProfile"
import { badgesOf } from "./persons"

const SEARCH_LIMIT_DEFAULT = 10
const SEARCH_LIMIT_MAX = 25

/**
 * Recalcule les lignes d'annuaire d'une personne : une par adhésion ACTIVE
 * (réseau actif), `listed` si le profil est découvrable et la racine non
 * suspendue ; les lignes des adhésions closes disparaissent. Idempotent, borné
 * (une personne appartient à peu de réseaux), sans écriture inutile. À appeler
 * après tout changement de profil ou de statut d'adhésion.
 */
export async function syncPersonDirectory(ctx: MutationCtx, personId: Id<"persons">): Promise<void> {
  const person = await ctx.db.get(personId)
  // borné : une personne appartient à peu de réseaux ; 200 lignes au plus.
  const rows = await ctx.db
    .query("peopleDirectory")
    .withIndex("by_person", (q) => q.eq("personId", personId))
    .take(200)
  const wanted = new Map<Id<"networks">, boolean>()
  if (person) {
    const discoverable = isDiscoverablePerson(person)
    const memberships: Doc<"networkMemberships">[] = []
    for (const status of ["en_attente", "declaree", "verifiee", "suspendue"] as const) {
      // borné : une personne appartient à peu de réseaux ; 200 par statut au plus.
      memberships.push(
        ...(await ctx.db
          .query("networkMemberships")
          .withIndex("by_person_and_status", (q) => q.eq("personId", personId).eq("status", status))
          .take(200)),
      )
    }
    const rootSuspended = await rootIsSuspended(ctx, memberships)
    for (const membership of memberships) {
      if (!isActiveStatus(membership.status)) continue
      const network = await ctx.db.get(membership.networkId)
      if (!network || network.status !== "active") continue
      wanted.set(network._id, discoverable && !rootSuspended)
    }
  }
  const searchName = person ? buildSearchableText(person.displayName, person.handle) : ""
  const now = Date.now()
  for (const row of rows) {
    const listed = wanted.get(row.networkId)
    if (listed === undefined) {
      await ctx.db.delete(row._id)
      continue
    }
    wanted.delete(row.networkId)
    if (row.listed !== listed || row.searchName !== searchName) await ctx.db.patch(row._id, { listed, searchName, updatedAt: now })
  }
  for (const [networkId, listed] of wanted) {
    await ctx.db.insert("peopleDirectory", { networkId, personId, searchName, listed, updatedAt: now })
  }
}

async function rootIsSuspended(ctx: MutationCtx, memberships: readonly Doc<"networkMemberships">[]): Promise<boolean> {
  for (const membership of memberships) {
    if (membership.status !== "suspendue") continue
    const network = await ctx.db.get(membership.networkId)
    if (network?.kind === "root") return true
  }
  return false
}

const personHitValidator = v.object({
  personId: v.id("persons"),
  handle: v.string(),
  displayName: v.string(),
  headline: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  badges: v.array(badgeValidator),
})

type PersonHit = { personId: Id<"persons">; handle: string; displayName: string; headline: string | null; avatarUrl: string | null; badges: Badge[] }

/**
 * Chercher une personne parmi les membres découvrables du réseau. Jamais soi-même.
 */
export const searchPeople = networkQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(personHitValidator),
  handler: async (ctx, args) => {
    const term = args.query.trim()
    if (term.length === 0) return []
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? SEARCH_LIMIT_DEFAULT), 1), SEARCH_LIMIT_MAX)

    const byName = await ctx.db
      .query("peopleDirectory")
      .withSearchIndex("search_name", (q) => q.search("searchName", foldSearchQuery(term)).eq("networkId", ctx.networkId).eq("listed", true))
      .take(limit)
    const personIds = byName.map((row) => row.personId)

    // L'identifiant est une ADRESSE : cherché exactement, en tête des résultats.
    const exact = await ctx.db
      .query("persons")
      .withIndex("by_handle", (q) => q.eq("handle", normalizeHandle(term)))
      .unique()
    if (exact && isDiscoverablePerson(exact) && !personIds.includes(exact._id) && (await isActiveMember(ctx, ctx.networkId, exact._id))) {
      personIds.unshift(exact._id)
    }

    const hits: PersonHit[] = []
    for (const personId of personIds.slice(0, limit)) {
      if (personId === ctx.person._id) continue
      const person = await ctx.db.get(personId)
      if (!person || !isDiscoverablePerson(person) || !person.handle || !person.displayName) continue
      hits.push({
        personId,
        handle: person.handle,
        displayName: person.displayName,
        headline: person.headline ?? null,
        avatarUrl: person.avatarStorageId ? await servableUrl(ctx, person.avatarStorageId) : null,
        badges: await badgesOf(ctx, personId),
      })
    }
    return hits
  },
})
