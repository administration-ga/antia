// Dupliqué de socle/convex/modules/direct/invitationSettle.ts @ ad2e7fdc2 — adaptations : tables `live*` (`liveSessions`, `liveInvitees`, `liveAntennaInvitations`) et personnes (`personId`, `inviteePersonId`) ; cloche du moteur — résolution par la porte unique (`resolveNotifications`, dans le RÉSEAU de la session), genres `live_invite` et `live_antenna_invite`, sujet `liveSession` ; replanification par `internal.modules.live.invitationSettle` ; commentaires rapportés au moteur (aucun trigger dans le moteur, `internalMutation` du serveur généré).
/**
 * SOLDER les invitations d'une conférence terminée (CH-094).
 *
 * Une invitation n'a plus d'objet quand la conférence qu'elle ouvrait est
 * finie : la cloche ne doit plus proposer « Rejoindre » ni « Accepter » à qui
 * arrive après coup. Ce job passe `expired` les notifications encore EN
 * ATTENTE de la session, et elles seules :
 *
 *  · `live_invite` — les invités nominatifs VIVANTS (`liveInvitees`,
 *    `revokedAt` absent). Un invité retiré a déjà sa cloche `cancelled`
 *    (`invitees.revoke`) : il n'est pas relu ici.
 *  · `live_antenna_invite` — les invitations d'antenne encore `pending` en
 *    base. Acceptées, refusées ou retirées, elles ont déjà leur résolution
 *    (`antenna.ts`) et la GARDENT : on ne relit que les `pending`.
 *
 * ⚠️ TOUJOURS PLANIFIÉ, JAMAIS INLINE : la récolte (`reap.reapStaleDirects`)
 * ferme jusqu'à cinquante sessions par passage et `closePageDirects` une page
 * entière — solder deux cents cloches par session dans CES transactions les
 * ferait tomber. Les trois fins d'un direct EN LIVE le planifient
 * (`sessions.end`, `reap.endLiveSession`, `revocation.closePageDirects`) ; une
 * session jamais démarrée ne planifie rien : aucune cloche n'a sonné avant le
 * live.
 *
 * ⚠️ Les LIGNES d'invitation ne sont pas réécrites : l'expiration d'une
 * invitation d'antenne reste DÉRIVÉE (`domain.effectiveDirectInvitationStatus`),
 * seule la cloche est soldée.
 *
 * Idempotent (`resolveNotifications` ne réécrit pas une ligne déjà
 * `expired`) et borné : les invités vivants tiennent en une lecture (plafond
 * `DIRECT_MAX_INVITEES`, tenu à l'ajout comme à la création), les invitations
 * d'antenne se lisent par pages chaînées — UNE `.paginate()` par exécution.
 */
import { v } from "convex/values"

import { internal } from "../../_generated/api"
// `internalMutation` BRUTE : le moteur n'a pas de triggers, ni sur les tables
// `live*` ni sur la cloche.
import { internalMutation } from "../../_generated/server"
import { resolveNotifications } from "../notifications/notify"
import { DIRECT_MAX_INVITEES } from "./domain"

/**
 * Invitations d'antenne soldées par exécution. Chacune coûte une lecture
 * bornée de cloches et, au plus, quelques écritures.
 */
export const DIRECT_INVITATION_SETTLE_PAGE = 100

/** Le bilan d'une exécution — ce qu'elle a relu, et combien de cloches ont changé. */
export type ExpireSessionInvitationsResult = {
  /** Invités nominatifs vivants relus (première exécution seulement). */
  invitees: number
  /** Invitations d'antenne `pending` relues dans CETTE page. */
  antennaInvitations: number
  /** Cloches effectivement passées `expired` (idempotence : 0 au rejeu). */
  resolved: number
  /** `false` : une continuation est planifiée pour la page suivante. */
  done: boolean
}

export const expireSessionInvitations = internalMutation({
  args: {
    sessionId: v.id("liveSessions"),
    /** L'instant de la fin — il devient `resolvedAt` des cloches soldées. */
    endedAt: v.number(),
    /**
     * Continuation des invitations d'antenne. Absent : première exécution,
     * qui solde AUSSI les invités nominatifs.
     */
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    invitees: v.number(),
    antennaInvitations: v.number(),
    resolved: v.number(),
    done: v.boolean(),
  }),
  // Type de retour EXPLICITE : la fonction se replanifie elle-même, et son
  // type ne doit pas dépendre de `internal` (circularité d'inférence).
  handler: async (ctx, args): Promise<ExpireSessionInvitationsResult> => {
    const session = await ctx.db.get(args.sessionId)
    // Rien à solder tant que la conférence n'est pas finie — un appel égaré
    // sur un direct encore live fermerait des invitations bien vivantes.
    if (session === null || session.status !== "ended") {
      return { invitees: 0, antennaInvitations: 0, resolved: 0, done: true }
    }
    const subject = { liveSession: session._id }
    let resolved = 0

    let invitees = 0
    if (args.cursor === undefined) {
      const rows = await ctx.db
        .query("liveInvitees")
        .withIndex("by_session_revokedAt", (q) => q.eq("sessionId", session._id).eq("revokedAt", undefined))
        .take(DIRECT_MAX_INVITEES)
      invitees = rows.length
      for (const row of rows) {
        const result = await resolveNotifications(ctx, {
          networkId: session.networkId,
          recipientPersonId: row.personId,
          kind: "live_invite",
          subject,
          resolution: "expired",
          at: args.endedAt,
        })
        resolved += result.resolved
      }
    }

    const page = await ctx.db
      .query("liveAntennaInvitations")
      .withIndex("by_session_status_updatedAt", (q) => q.eq("sessionId", session._id).eq("status", "pending"))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: DIRECT_INVITATION_SETTLE_PAGE,
      })
    for (const row of page.page) {
      const result = await resolveNotifications(ctx, {
        networkId: session.networkId,
        recipientPersonId: row.inviteePersonId,
        kind: "live_antenna_invite",
        subject,
        resolution: "expired",
        at: args.endedAt,
      })
      resolved += result.resolved
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.live.invitationSettle.expireSessionInvitations, {
        sessionId: session._id,
        endedAt: args.endedAt,
        cursor: page.continueCursor,
      })
    }
    return {
      invitees,
      antennaInvitations: page.page.length,
      resolved,
      done: page.isDone,
    }
  },
})
