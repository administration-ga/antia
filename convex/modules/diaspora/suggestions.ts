/**
 * Suggestions de relations de DIASPORALE (EXF-DG-18).
 *
 * Le chemin générique du moteur (`follows.suggestions`) refuse ce réseau : il
 * ignore l'annuaire opt-in. Ici, le vivier est l'annuaire (`peopleDirectory`,
 * pré-filtre `listed`) et chaque candidat passe la MÊME règle que la recherche
 * (`listedMemberFor`). Le classement est celui du domaine (`rankSuggestions`),
 * lu sur la facette PROJETÉE pour le lecteur : même pays, même ville,
 * associations communes, relations communes. Jamais soi, une relation, une
 * demande en cours, un refus, un blocage, ni une personne écartée par « ne plus
 * me proposer » — le masquage GÉNÉRIQUE du moteur (`suggestions.dismiss`,
 * `restore`, par réseau), un choix privé que l'autre n'apprend pas.
 */
import { rankSuggestions, type SuggestionReasons, suggestionReasons, SUGGESTIONS_MAX, suggestionScore } from "@diasporale/domain"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { networkQuery } from "../../lib/functions"
import { badgeValidator } from "../../lib/validators"
import { acceptedCounterpartIds, findConnection } from "../graph/graph"
import { miniProfileCache } from "../people/miniProfile"
import { directoryReader, type ListedMember, listedMemberFor } from "./directory"
import { assertDiasporaNetwork } from "./facts"
import { facetProjectionValidator, toProjection } from "./profile"

/** Annuaire lu par demande, du plus récent : une borne de lecture, pas un parcours. */
const SUGGESTION_POOL = 120
/** Relations communes comptées pour les mieux placés seulement. */
const MUTUAL_CANDIDATES = 18
/** Relations d'un candidat relues pour compter les communes (par côté de la paire). */
const MUTUAL_SCAN = 100
/** Choix « ne plus me proposer » relus par demande. */
const DISMISSALS_SCAN = 500

export const suggestionValidator = v.object({
  personId: v.id("persons"),
  handle: v.string(),
  displayName: v.string(),
  headline: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  badges: v.array(badgeValidator),
  /** Les seuls champs de la facette que le lecteur a le droit de voir. */
  facet: facetProjectionValidator,
  reasons: v.object({ sameCountry: v.boolean(), sameCity: v.boolean(), sharedAssociations: v.number(), mutualConnections: v.number() }),
})

/** Les relations communes du lecteur et d'un candidat, comptées sur une lecture bornée. */
async function mutualConnections(ctx: QueryCtx, networkId: Id<"networks">, candidateId: Id<"persons">, mine: ReadonlySet<string>): Promise<number> {
  const [asLow, asHigh] = await Promise.all([
    ctx.db
      .query("connections")
      .withIndex("by_network_low_status", (q) => q.eq("networkId", networkId).eq("personIdLow", candidateId).eq("status", "accepted"))
      .take(MUTUAL_SCAN),
    ctx.db
      .query("connections")
      .withIndex("by_network_high_status", (q) => q.eq("networkId", networkId).eq("personIdHigh", candidateId).eq("status", "accepted"))
      .take(MUTUAL_SCAN),
  ])
  return asLow.filter((row) => mine.has(row.personIdHigh)).length + asHigh.filter((row) => mine.has(row.personIdLow)).length
}

/** Mes suggestions : six au plus, chacune avec ce qui nous rapproche. Réservées aux membres actifs. */
export const forMe = networkQuery({
  minStatus: "declaree",
  args: {},
  returns: v.array(suggestionValidator),
  handler: async (ctx) => {
    assertDiasporaNetwork(ctx.network)
    const reader = await directoryReader(ctx, ctx.network, ctx.person._id)
    if (!reader) return []
    const [rows, connections, dismissals] = await Promise.all([
      ctx.db
        .query("peopleDirectory")
        .withIndex("by_network_listed", (q) => q.eq("networkId", ctx.networkId).eq("listed", true))
        .order("desc")
        .take(SUGGESTION_POOL),
      acceptedCounterpartIds(ctx, ctx.networkId, ctx.person._id),
      ctx.db
        .query("suggestionDismissals")
        .withIndex("by_network_person_dismissed", (q) => q.eq("networkId", ctx.networkId).eq("personId", ctx.person._id))
        .take(DISMISSALS_SCAN),
    ])
    const dismissed = new Set<string>(dismissals.map((row) => row.dismissedPersonId))

    // Premier passage : la règle de l'annuaire, puis ce qui rapproche, sans les relations communes.
    const pool: { member: ListedMember; reasons: SuggestionReasons }[] = []
    for (const row of rows) {
      const personId = row.personId
      if (personId === ctx.person._id || dismissed.has(personId) || connections.ids.has(personId)) continue
      // Une ligne de connexion, quelle qu'elle soit (demande, refus, blocage) : pas une suggestion.
      if (await findConnection(ctx, ctx.networkId, ctx.person._id, personId)) continue
      const member = await listedMemberFor(ctx, ctx.network, reader, personId)
      if (member) pool.push({ member, reasons: suggestionReasons(reader.facet, member.projection, 0) })
    }

    // Second passage : les relations communes, pour les mieux placés seulement (lectures bornées).
    const order = pool
      .map((entry, index) => ({ index, score: suggestionScore(entry.reasons) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, MUTUAL_CANDIDATES)
    for (const { index } of order) {
      const entry = pool[index]
      if (!entry) continue
      const mutual = await mutualConnections(ctx, ctx.networkId, entry.member.personId, connections.ids)
      if (mutual > 0) pool[index] = { ...entry, reasons: suggestionReasons(reader.facet, entry.member.projection, mutual) }
    }

    const profileOf = miniProfileCache(ctx)
    const out: (typeof suggestionValidator.type)[] = []
    for (const { member, reasons } of rankSuggestions(pool, SUGGESTIONS_MAX)) {
      const profile = await profileOf(member.personId)
      if (!profile.handle || !profile.displayName) continue
      out.push({
        personId: member.personId,
        handle: profile.handle,
        displayName: profile.displayName,
        headline: profile.headline,
        avatarUrl: profile.avatarUrl,
        badges: profile.badges,
        facet: toProjection(member.projection),
        reasons,
      })
    }
    return out
  },
})
