/**
 * Annuaire des membres de DIASPORALE (EXF-DG-19, EXF-DG-46) — opt-in, par niveau.
 *
 * La recherche générique du moteur (`searchPeople`) refuse ce réseau : le niveau
 * « pays » dépend du LECTEUR, que la projection générique `peopleDirectory` ne
 * connaît pas. Elle sert ici de PRÉ-FILTRE — `listed`, posé par la tranche au
 * choix d'un niveau visible (`syncDirectoryListing`) — et chaque candidat est
 * REJUGÉ par la règle du domaine (`isListedInDirectoryFor`) : niveau choisi,
 * consentement EN VIGUEUR (un retrait passé par le chemin générique compte
 * aussitôt), statut, pays du lecteur, blocage dans la paire. Un identifiant exact
 * passe par la même règle : masqué reste masqué, comme un identifiant inconnu.
 *
 * Le résultat ne porte que la facette PROJETÉE pour le lecteur (`projectFacet`),
 * aucune coordonnée — le contact passe par la messagerie. Une page bornée, sans
 * curseur : on affine la recherche, on ne parcourt pas l'annuaire.
 */
import { normalizeHandle } from "@antia/social-domain/content"
import { foldSearchQuery } from "@antia/social-domain/searchText"
import { DIRECTORY_PAGE_SIZE_MAX, isListedInDirectoryFor, isResidenceCountry, normalizeCountryCode, projectFacet } from "@diasporale/domain"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { networkQuery } from "../../lib/functions"
import { badgeValidator } from "../../lib/validators"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"
import { isDiscoverablePerson, miniProfileCache } from "../people/miniProfile"
import { assertDiasporaNetwork, consentInForce, effectiveStatusIn, facetOf, privacyOf } from "./facts"
import { facetProjectionValidator, toProjection } from "./profile"

/** Une requête plus courte ne cherche pas : « chercher sans chercher » viderait l'annuaire. */
export const DIRECTORY_QUERY_MIN_LENGTH = 2

/** Candidats lus par recherche, avant la règle : une borne de lecture, pas un parcours. */
const DIRECTORY_SCAN = 60

export const directoryEntryValidator = v.object({
  personId: v.id("persons"),
  handle: v.string(),
  displayName: v.string(),
  headline: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  badges: v.array(badgeValidator),
  /** Les seuls champs de la facette que le lecteur a le droit de voir. */
  facet: facetProjectionValidator,
})

/**
 * Chercher un membre par son nom ou son identifiant, parmi ceux qui ont choisi
 * d'être trouvés par ce lecteur. Réservé aux membres actifs (« déclaré » ou
 * « vérifié ») : un compte en attente lit le réseau, il ne consulte pas
 * l'annuaire. Le filtre de pays restreint, il n'ouvre jamais rien.
 */
export const searchMembers = networkQuery({
  minStatus: "declaree",
  args: { query: v.string(), country: v.optional(v.string()) },
  returns: v.array(directoryEntryValidator),
  handler: async (ctx, args) => {
    assertDiasporaNetwork(ctx.network)
    const term = args.query.trim().replace(/^@/, "")
    if (term.length < DIRECTORY_QUERY_MIN_LENGTH) return []
    const only = args.country === undefined ? null : normalizeCountryCode(args.country)
    if (only !== null && !isResidenceCountry(only)) return []
    const viewerFacet = await facetOf(ctx, ctx.networkId, ctx.person._id)
    const { status: viewerStatus } = await effectiveStatusIn(ctx, ctx.network, ctx.person._id)
    if (!viewerFacet || !viewerStatus) return []

    const rows = await ctx.db
      .query("peopleDirectory")
      .withSearchIndex("search_name", (q) => q.search("searchName", foldSearchQuery(term)).eq("networkId", ctx.networkId).eq("listed", true))
      .take(DIRECTORY_SCAN)
    const candidates: Id<"persons">[] = rows.map((row) => row.personId)
    // L'identifiant est une ADRESSE : cherché exactement, en tête — et jugé par la même règle.
    const exact = await ctx.db
      .query("persons")
      .withIndex("by_handle", (q) => q.eq("handle", normalizeHandle(term)))
      .unique()
    if (exact && !candidates.includes(exact._id)) candidates.unshift(exact._id)

    const profileOf = miniProfileCache(ctx)
    const entries: (typeof directoryEntryValidator.type)[] = []
    for (const personId of candidates) {
      if (entries.length >= DIRECTORY_PAGE_SIZE_MAX) break
      const isSelf = personId === ctx.person._id
      const [person, privacy, facet] = await Promise.all([
        ctx.db.get(personId),
        privacyOf(ctx, ctx.networkId, personId),
        facetOf(ctx, ctx.networkId, personId),
      ])
      if (!person || !isDiscoverablePerson(person) || !privacy || !facet) continue
      if (only !== null && facet.countryOfResidence !== only) continue
      const { status } = await effectiveStatusIn(ctx, ctx.network, personId)
      if (!status) continue
      const listed = isListedInDirectoryFor(
        {
          status,
          visibility: privacy.directoryVisibility,
          consentActive: await consentInForce(ctx, ctx.networkId, personId, "directory"),
          country: facet.countryOfResidence,
        },
        {
          status: viewerStatus,
          country: viewerFacet.countryOfResidence,
          isSelf,
          blockedWithTarget: !isSelf && (await isBlockedBetween(ctx, ctx.person._id, personId)),
        },
      )
      if (!listed) continue
      const profile = await profileOf(personId)
      if (!profile.handle || !profile.displayName) continue
      const projection = projectFacet(facet, {
        isSelf,
        isConnection: !isSelf && (await isConnectedTo(ctx, ctx.networkId, ctx.person._id, personId)),
        isSameCountryMember: viewerFacet.countryOfResidence === facet.countryOfResidence,
        isActiveMember: true,
      })
      entries.push({
        personId,
        handle: profile.handle,
        displayName: profile.displayName,
        headline: profile.headline,
        avatarUrl: profile.avatarUrl,
        badges: profile.badges,
        facet: toProjection(projection),
      })
    }
    return entries
  },
})
