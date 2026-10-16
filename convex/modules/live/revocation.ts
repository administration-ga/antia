// Dupliqué de socle/convex/modules/direct/revocation.ts @ ad2e7fdc2 — adaptations : tables `live*` et personnes ; coupure SFU par le sujet d'authentification de la personne (`persons.authUserId`) vers `livekitActions.applyDirectSfuState`, salle et capture fermées par `livekitActions.closeDirectRoom` / `stopDirectEgress` du module ; `kickUserFromOrgDirects` (rattachement révoqué → directs « organisation » de la page de l'administration) devient `kickUserFromPageDirects` (V38) : SORTIE DU CERCLE d'une page — abonnement retiré, signature retirée — vers les directs `followers` de CETTE page, lus par l'index `by_page_status`, la décision d'accès seule juge (un ancien signataire qui suit encore la page la voit toujours) ; `kickUserFromInviteeDirects` (« devient citoyen » : les seules conférences où il entrait invité) devient `kickUserFromNetworkDirects` (V35, V38) : PERTE D'ADHÉSION au réseau (départ, suspension ; à la racine, tous les réseaux) — toutes les conférences en direct du réseau où la personne a été ADMISE (admission de spectateur ou ligne d'antenne, sans quoi aucun jeton n'a été émis), paginées, la décision d'accès seule juge ; le helper `revokeConnectionDirects` du socle (`reseau/connections.ts`) devient une mutation interne de ce module, planifiée par le blocage du graphe (les deux expulsions symétriques) ; `closePageDirects` lit les seuls directs de la page (`by_page_status`) au lieu de tous les directs vivants ; validateurs de retour (`v.null()`) et types de retour explicites (fonctions qui se replanifient).
/**
 * Révocation temps réel des accès au direct.
 *
 * Les gardes Convex ferment immédiatement les nouvelles lectures et les
 * nouveaux jetons. Ces continuations bornées ferment aussi les connexions
 * LiveKit déjà établies, sans scan non borné dans la mutation métier qui a
 * retiré le droit.
 *
 * Quatre portes d'entrée, chacune planifiée (`runAfter(0, …)`) par le geste
 * qui retire le droit, APRÈS sa transaction :
 *  · une relation rompue (blocage, `graph/connections.blockPerson`) →
 *    `revokeConnectionDirects` ;
 *  · une adhésion perdue (départ, suspension, `people/admission.setMembershipStatus`)
 *    → `kickUserFromNetworkDirects` ;
 *  · une sortie du cercle d'une page (abonnement ou signature retirés) →
 *    `kickUserFromPageDirects` ;
 *  · une page retirée (`pages/admin.setPageStatus`) → `closePageDirects`.
 */
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type QueryCtx } from "../../_generated/server"
import { directSessionAccessDecision } from "./access"
import { recomputeAggregates } from "./reap"

const LIVE_SCAN_PAGE = 50

const cursorValidator = v.union(v.string(), v.null())

type ReadCtx = Pick<QueryCtx, "db">

/**
 * Cette personne a-t-elle pu se CONNECTER à cette salle ? Un jeton n'est émis
 * qu'à qui a une admission de spectateur (`liveViewerGrants`) ou une ligne
 * d'antenne (`liveSpeakers`, l'hôte compris) : sans l'une ni l'autre, il n'y a
 * aucune connexion à couper, et aucune action à planifier.
 */
async function mayBeConnected(ctx: ReadCtx, sessionId: Id<"liveSessions">, personId: Id<"persons">): Promise<boolean> {
  const grant = await ctx.db
    .query("liveViewerGrants")
    .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", personId))
    .unique()
  if (grant !== null) return true
  const speaker = await ctx.db
    .query("liveSpeakers")
    .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", personId))
    .unique()
  return speaker !== null
}

/**
 * Une personne qui SORT DU CERCLE d'une page (elle ne la suit plus, sa
 * signature est retirée) est coupée des directs réservés aux abonnés de cette
 * page — si la décision d'accès ne la laisse plus entrer : un signataire retiré
 * qui suit encore la page, ou l'inverse, reste dans la salle.
 */
export const kickUserFromPageDirects = internalMutation({
  args: {
    personId: v.id("persons"),
    pageId: v.id("pages"),
    cursor: cursorValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const [person, page] = await Promise.all([ctx.db.get(args.personId), ctx.db.get(args.pageId)])
    if (!person || !page) return null

    const batch = await ctx.db
      .query("liveSessions")
      .withIndex("by_page_status", (q) => q.eq("pageId", page._id).eq("status", "live"))
      .paginate({ cursor: args.cursor, numItems: LIVE_SCAN_PAGE })
    for (const session of batch.page) {
      // Une conférence publique AU NOM de la page ne dépend pas de son cercle.
      if (session.audience !== "followers") continue
      if ((await directSessionAccessDecision(ctx, args.personId, session)) === "allowed") {
        continue
      }
      await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.applyDirectSfuState, {
        roomName: session.roomName,
        subject: person.authUserId,
        mode: "kick" as const,
      })
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromPageDirects, { ...args, cursor: batch.continueCursor })
    }
    return null
  },
})

/** Une relation rompue ferme les directs « connexions » de l'autre personne. */
export const kickUserFromConnectionDirects = internalMutation({
  args: {
    revokedPersonId: v.id("persons"),
    hostPersonId: v.id("persons"),
    cursor: cursorValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const revokedPerson = await ctx.db.get(args.revokedPersonId)
    if (!revokedPerson) return null

    // Le blocage vaut sur toute la paire, dans tous les réseaux : tous les
    // directs vivants sont relus, page par page.
    const batch = await ctx.db
      .query("liveSessions")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .paginate({ cursor: args.cursor, numItems: LIVE_SCAN_PAGE })
    for (const session of batch.page) {
      // ⚠️ « Invités seulement » est examinée AUSSI : c'est une audience
      // restreinte, et un blocage posé pendant le live doit couper l'invité
      // maintenant, pas au jeton suivant — une connexion LiveKit établie
      // survit à l'expiration de son jeton (ADR-0150, A). Les audiences
      // `public` et `followers` restent hors de ce passage, comme avant.
      if ((session.audience !== "connections" && session.audience !== "invitees") || session.hostPersonId !== args.hostPersonId) {
        continue
      }
      // ⚠️ Un invité NOMINATIF ne tenait pas sa place de la relation rompue
      // (ADR-0150) : il voit toujours la conférence, on ne le coupe pas. La
      // décision d'accès reste seule juge — ce saut n'ouvre rien qu'elle
      // n'ouvrirait pas, il évite une coupure qu'elle ne justifie plus. Un
      // BLOCAGE, lui, ferme la décision : l'invité est coupé ici, maintenant.
      if ((await directSessionAccessDecision(ctx, args.revokedPersonId, session)) === "allowed") {
        continue
      }
      await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.applyDirectSfuState, {
        roomName: session.roomName,
        subject: revokedPerson.authUserId,
        mode: "kick" as const,
      })
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromConnectionDirects, { ...args, cursor: batch.continueCursor })
    }
    return null
  },
})

/**
 * Une PAIRE qui se ferme (blocage) : les deux expulsions symétriques — chacune
 * des deux personnes est relue dans les directs de l'autre. Planifiée par
 * `graph/connections.blockPerson`, en une ligne.
 */
export const revokeConnectionDirects = internalMutation({
  args: {
    firstPersonId: v.id("persons"),
    secondPersonId: v.id("persons"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromConnectionDirects, {
      revokedPersonId: args.secondPersonId,
      hostPersonId: args.firstPersonId,
      cursor: null,
    })
    await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromConnectionDirects, {
      revokedPersonId: args.firstPersonId,
      hostPersonId: args.secondPersonId,
      cursor: null,
    })
    return null
  },
})

/**
 * Une personne qui PERD SON ADHÉSION au réseau (départ, suspension) ne voit
 * plus aucune conférence de ce réseau (V35) : elle est coupée de celles où
 * elle a été admise — spectatrice, intervenante, hôte compris. Au socle, la
 * perte du dernier rattachement (« devient citoyen ») ne fermait que les
 * conférences où l'on entrait invité ; dans le moteur, l'adhésion est exigée
 * pour TOUTE audience.
 *
 * ⚠️ Planifié APRÈS le changement de statut (`setMembershipStatus`) : la
 * transaction qui pose `partie` ou `suspendue` est déjà validée, la décision la
 * voit. La décision d'accès reste seule juge — une personne revenue entre-temps
 * n'est pas coupée. La RACINE gouverne tous les réseaux (une suspension à la
 * racine vaut partout, la quitter fait quitter les réseaux fermés) : son
 * passage relit tous les directs vivants ; ailleurs, ceux du seul réseau.
 */
export const kickUserFromNetworkDirects = internalMutation({
  args: {
    personId: v.id("persons"),
    networkId: v.id("networks"),
    cursor: cursorValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const [person, network] = await Promise.all([ctx.db.get(args.personId), ctx.db.get(args.networkId)])
    if (!person || !network) return null

    const batch =
      network.kind === "root"
        ? await ctx.db
            .query("liveSessions")
            .withIndex("by_status", (q) => q.eq("status", "live"))
            .paginate({ cursor: args.cursor, numItems: LIVE_SCAN_PAGE })
        : await ctx.db
            .query("liveSessions")
            .withIndex("by_network_status_startedAt", (q) => q.eq("networkId", network._id).eq("status", "live"))
            .paginate({ cursor: args.cursor, numItems: LIVE_SCAN_PAGE })
    for (const session of batch.page) {
      if (!(await mayBeConnected(ctx, session._id, args.personId))) continue
      if ((await directSessionAccessDecision(ctx, args.personId, session)) === "allowed") {
        continue
      }
      await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.applyDirectSfuState, {
        roomName: session.roomName,
        subject: person.authUserId,
        mode: "kick" as const,
      })
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromNetworkDirects, { ...args, cursor: batch.continueCursor })
    }
    return null
  },
})

/** Retirer une page termine et vide tous ses directs encore ouverts. */
export const closePageDirects = internalMutation({
  args: {
    pageId: v.id("pages"),
    cursor: cursorValidator,
    revokedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const batch = await ctx.db
      .query("liveSessions")
      .withIndex("by_page_status", (q) => q.eq("pageId", args.pageId).eq("status", "live"))
      .paginate({ cursor: args.cursor, numItems: LIVE_SCAN_PAGE })
    for (const session of batch.page) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: args.revokedAt,
        // La page qui signait la conférence a été retirée — ce n'est ni un
        // abandon de l'hôte, ni une limite atteinte, et l'écran ne doit pas
        // le raconter comme tel (D-14).
        endReason: "revoked",
        updatedAt: args.revokedAt,
      })
      await recomputeAggregates(ctx, session._id)
      await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.closeDirectRoom, { roomName: session.roomName })
      if (session.egressId !== undefined) {
        await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.stopDirectEgress, { egressId: session.egressId })
      }
      // CH-094 — les cloches d'invitation se soldent en JOB, une session à la
      // fois : ce lot en ferme jusqu'à `LIVE_SCAN_PAGE`.
      await ctx.scheduler.runAfter(0, internal.modules.live.invitationSettle.expireSessionInvitations, { sessionId: session._id, endedAt: args.revokedAt })
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.closePageDirects, { ...args, cursor: batch.continueCursor })
    }
    return null
  },
})
