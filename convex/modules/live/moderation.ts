// Dupliqué de socle/convex/modules/direct/moderation.ts @ ad2e7fdc2 — adaptations : personnes et réseaux — constructeurs `networkQuery`/`networkMutation`, lecteur `directCaller`, cible `targetPersonId`, tables `liveBans`/`liveChatMutes`/`liveDelegations`/`liveSpeakers`/`liveViewerGrants` (`networkId` copié de la session, champs `bannedPersonId`/`byPersonId`/`liftedByPersonId`/`spotlightPersonId`), DTO du panneau en `personId` ; sortie de la salle planifiée sous `modules/live/livekitActions`, sujet LiveKit = `authUserId` de la personne ; compte « actif » = personne non effacée (`deletionRequestedAt`), l'adhésion au réseau étant relue par la décision d'accès (V35) ; nom affiché du profil PUBLIÉ, `null` sans profil (l'écran traduit le nom neutre) ; refus à CODE de règle (`LIVE_SELF_EXCLUDE`, `LIVE_SELF_MUTE`, `LIVE_HOST_NOT_MODERATABLE` — la garde de cible reçoit la règle au lieu d'une phrase) et refus de droit `liveRoleRequired` ; commentaires rapportés au moteur.
/**
 * MODÉRATION du direct — exclusion, réintégration, sourdine, participants.
 * API publique : `api.modules.live.moderation.*`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS GESTES, TROIS PORTÉES — on ne les confond pas
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · **Retirer de l'antenne** (`speakers.demote`) coupe le micro et laisse la
 *    personne dans la salle. Ce n'est PAS une sanction.
 *  · **Couper le chat** (`muteChat`) fait taire UNE personne sans toucher à ce
 *    que les autres écrivent, ni à sa place dans la salle. C'est l'outil
 *    intermédiaire qui manquait entre « ne rien faire » et « exclure ».
 *  · **Exclure** (`ban`) ferme tout : plus de jeton, plus de page, plus de
 *    commentaire ni de réaction, sortie de la salle (kick SFU planifié) et
 *    rétrogradation si la personne était à l'antenne.
 *
 * ⚠️ L'exclusion n'est PLUS définitive (D-11) : `reinstate` la lève, et la
 * personne peut redemander un jeton. Elle ne remonte pas à l'antenne pour
 * autant — une réintégration rend l'accès, jamais un rôle.
 *
 * ⚠️ Ces gestes ne sont plus « hôte seul » : ils passent par
 * `requireDirectPermission` (ADR-0144), qui accorde aussi à un délégué portant
 * le drapeau correspondant. Ce que la garde ne cède JAMAIS : personne ne touche
 * à l'HÔTE, et personne ne se sanctionne soi-même.
 */
import type { DomainRule } from "@antia/social-domain/violation"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { fail, failRule } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { miniProfileCache } from "../people/miniProfile"
import {
  assertVisibleDirectSession,
  banRecord,
  chatMuteRecord,
  chatMuteRow,
  delegationRecord,
  directCaller,
  directPermissionsOf,
  directSessionAccessDecision,
  liveSpeakerRow,
  requireDirectPermission,
} from "./access"

/**
 * La cible d'un geste de police : ni soi-même, ni l'hôte.
 *
 * ⚠️ La seconde moitié est NÉE avec la délégation. Tant que seul l'hôte
 * modérait, « pas l'hôte » se déduisait de « pas soi-même ». Un cohôte portant
 * `canExclude`, lui, pouvait exclure le titulaire de sa propre conférence — et
 * `authorizeToken` lui aurait refusé son prochain jeton.
 */
function assertModeratableTarget(
  session: Pick<Doc<"liveSessions">, "hostPersonId">,
  actorPersonId: Id<"persons">,
  targetPersonId: Id<"persons">,
  selfRule: DomainRule,
): void {
  if (targetPersonId === actorPersonId) {
    failRule(selfRule)
  }
  if (targetPersonId === session.hostPersonId) {
    failRule("LIVE_HOST_NOT_MODERATABLE")
  }
}

/** Exclure une personne de CE direct. Permission `exclude`, idempotent. */
export const ban = networkMutation({
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
  },
  handler: async (ctx, args): Promise<{ banned: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "exclude")
    assertModeratableTarget(session, ctx.person._id, args.targetPersonId, "LIVE_SELF_EXCLUDE")

    const now = Date.now()
    const already = await banRecord(ctx, session._id, args.targetPersonId)
    if (already === null) {
      await ctx.db.insert("liveBans", {
        networkId: session.networkId,
        sessionId: session._id,
        bannedPersonId: args.targetPersonId,
        byPersonId: ctx.person._id,
        createdAt: now,
      })
    } else if (already.liftedAt !== undefined) {
      // Ré-exclure ROUVRE la même ligne : `by_session_banned` est lu en
      // `.unique()`, une seconde ligne ferait lever toutes les gardes.
      await ctx.db.patch(already._id, {
        byPersonId: ctx.person._id,
        createdAt: now,
        liftedAt: undefined,
        liftedByPersonId: undefined,
      })
    }
    const wasBanned = already !== null && already.liftedAt === undefined

    // ⚠️ Une personne exclue ne garde pas la police de la salle : sa
    // délégation tombe avec elle. Sans cela, un cohôte exclu continuait de
    // modérer un direct dont il ne pouvait plus obtenir de jeton.
    const delegation = await delegationRecord(ctx, session._id, args.targetPersonId)
    if (delegation && delegation.revokedAt === undefined) {
      await ctx.db.patch(delegation._id, { revokedAt: now })
    }

    // À l'antenne ? La rétrogradation accompagne l'exclusion — même écriture
    // durable que `speakers.demote`, même époque qui avance.
    const speaker = await liveSpeakerRow(ctx, session._id, args.targetPersonId)
    if (speaker !== null) {
      await ctx.db.patch(speaker._id, {
        grantEpoch: speaker.grantEpoch + 1,
        sfuAppliedAt: undefined,
        removedAt: now,
      })
    }
    // Une mise en avant ne survit pas à sa personne — même invariant que
    // `demoteSpeakerRow` : le DTO ne la servirait déjà plus (elle est
    // filtrée sur les intervenants visibles), la base ne doit pas la garder.
    if (session.spotlightPersonId === args.targetPersonId) {
      await ctx.db.patch(session._id, { spotlightPersonId: undefined })
    }

    // Sortir la personne de la salle — après la transaction, TTL en filet.
    if (session.status === "live") {
      const target = await ctx.db.get(args.targetPersonId)
      if (target) {
        await ctx.scheduler.runAfter(0, internal.modules.live.livekitActions.applyDirectSfuState, {
          roomName: session.roomName,
          subject: target.authUserId,
          mode: "kick" as const,
        })
      }
    }
    return { banned: !wasBanned }
  },
})

/**
 * RÉINTÉGRER une personne exclue. Permission `reinstate`, idempotente.
 *
 * ⚠️ Elle rend l'ACCÈS, jamais un rôle : aucune re-promotion à l'antenne,
 * aucune délégation restaurée. La personne redemande un jeton comme n'importe
 * quel spectateur — et `authorizeToken` la laisse passer parce que `banRow` ne
 * rend plus sa ligne (point UNIQUE, `access.ts`).
 */
export const reinstate = networkMutation({
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
  },
  handler: async (ctx, args): Promise<{ reinstated: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "reinstate")

    const row = await banRecord(ctx, session._id, args.targetPersonId)
    if (!row || row.liftedAt !== undefined) return { reinstated: false }
    await ctx.db.patch(row._id, {
      liftedAt: Date.now(),
      liftedByPersonId: ctx.person._id,
    })
    return { reinstated: true }
  },
})

/**
 * COUPER le chat d'une personne. Permission `moderateChat`, idempotente.
 *
 * La personne reste dans la salle, voit, entend et réagit ; seul `comments.send`
 * la refuse. C'est l'écart entre « ne rien faire » et « exclure ».
 */
export const muteChat = networkMutation({
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
  },
  handler: async (ctx, args): Promise<{ muted: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "moderateChat")
    assertModeratableTarget(session, ctx.person._id, args.targetPersonId, "LIVE_SELF_MUTE")

    const now = Date.now()
    const existing = await chatMuteRecord(ctx, session._id, args.targetPersonId)
    if (!existing) {
      await ctx.db.insert("liveChatMutes", {
        networkId: session.networkId,
        sessionId: session._id,
        personId: args.targetPersonId,
        byPersonId: ctx.person._id,
        createdAt: now,
      })
      return { muted: true }
    }
    if (existing.liftedAt === undefined) return { muted: false }
    await ctx.db.patch(existing._id, {
      byPersonId: ctx.person._id,
      createdAt: now,
      liftedAt: undefined,
      liftedByPersonId: undefined,
    })
    return { muted: true }
  },
})

/** RÉTABLIR le chat d'une personne. Permission `moderateChat`, idempotente. */
export const unmuteChat = networkMutation({
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
  },
  handler: async (ctx, args): Promise<{ unmuted: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "moderateChat")

    const row = await chatMuteRecord(ctx, session._id, args.targetPersonId)
    if (!row || row.liftedAt !== undefined) return { unmuted: false }
    await ctx.db.patch(row._id, {
      liftedAt: Date.now(),
      liftedByPersonId: ctx.person._id,
    })
    return { unmuted: true }
  },
})

/** Une personne admise dans la salle, telle que le panneau la rend. */
export type DirectParticipantDto = {
  personId: Id<"persons">
  /** `null` = nom neutre (profil non publié) : l'écran le traduit. */
  displayName: string | null
  handle: string | null
  avatarUrl: string | null
  /** À l'antenne en ce moment — « Retirer » y renvoie, « Exclure » non. */
  onStage: boolean
  /** Exclusion EN VIGUEUR — la ligne propose alors « Réintégrer ». */
  banned: boolean
  /** Sourdine EN VIGUEUR. */
  muted: boolean
  /** Rôle de gestion vivant, quand il y en a un. */
  delegation: { kind: "cohost" | "moderator" } | null
  firstGrantedAt: number
}

/**
 * LES PARTICIPANTS ADMIS — la liste qui manquait (D-11).
 *
 * ⚠️ C'est le cœur du constat : le seul chemin vers « Exclure » était une LIGNE
 * DE COMMENTAIRE. Une personne silencieuse — celle qui perturbe une conférence
 * sans jamais écrire — n'était donc gérable par personne. Cette page la rend.
 *
 * ⚠️ UNE seule `.paginate()`, sur `liveViewerGrants` : la liste des admis,
 * pas une présence. Qui est CONNECTÉ en ce moment relève du bail de présence
 * et n'est pas promis ici — un champ « présent » qu'aucune source n'alimente
 * vaudrait moins que son absence.
 *
 * ⚠️ L'HÔTE et les intervenants sans admission spectateur n'y figurent pas :
 * ils n'ont pas de ligne `liveViewerGrants`. Le roster de l'antenne se lit
 * là où il vit (`sessions.get`, `antenna.hostState`).
 */
export const listAdmitted = networkQuery({
  args: {
    sessionId: v.id("liveSessions"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args): Promise<PaginationResult<DirectParticipantDto>> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    // Voir la salle est un acte de POLICE : soit on peut exclure, soit on
    // modère la conversation. Un spectateur n'a rien à faire de cette liste —
    // ce serait un annuaire des personnes présentes à une conférence.
    await requireModerationView(ctx, session, ctx.person._id)

    const result = await ctx.db
      .query("liveViewerGrants")
      .withIndex("by_session_person", (q) => q.eq("sessionId", session._id))
      .order("desc")
      .paginate(args.paginationOpts)

    const profileOf = miniProfileCache(ctx)
    const page: DirectParticipantDto[] = []
    for (const row of result.page) {
      const person = await ctx.db.get(row.personId)
      if (!person || person.deletionRequestedAt !== undefined) {
        continue
      }
      // Hors audience pour une autre raison que l'exclusion (adhésion perdue,
      // blocage, relation rompue) : la personne n'est plus dans cette salle.
      const decision = await directSessionAccessDecision(ctx, row.personId, session)
      if (decision !== "allowed" && decision !== "banned") continue

      const [speaker, mute, delegation] = await Promise.all([
        liveSpeakerRow(ctx, session._id, row.personId),
        chatMuteRow(ctx, session._id, row.personId),
        delegationRecord(ctx, session._id, row.personId),
      ])
      const profile = await profileOf(row.personId)
      page.push({
        personId: row.personId,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        onStage: speaker !== null,
        banned: decision === "banned",
        muted: mute !== null,
        delegation: delegation && delegation.revokedAt === undefined ? { kind: delegation.kind } : null,
        firstGrantedAt: row.firstGrantedAt,
      })
    }
    return { ...result, page }
  },
})

/**
 * La garde de LECTURE du panneau : exclure OU modérer suffit.
 *
 * Deux permissions, un seul refus — un modérateur sans `canExclude` doit voir
 * la salle (c'est là qu'il coupe un chat), et un cohôte qui exclut aussi.
 * Le refus est celui de tout ce lot : explicite (`liveRoleRequired`), parce
 * que l'appelant VOIT déjà la session.
 */
async function requireModerationView(
  ctx: Pick<QueryCtx, "db">,
  session: Pick<Doc<"liveSessions">, "_id" | "hostPersonId">,
  personId: Id<"persons">,
): Promise<void> {
  const permissions = await directPermissionsOf(ctx, session, personId)
  if (permissions.exclude || permissions.moderateChat) return
  fail("liveRoleRequired")
}
