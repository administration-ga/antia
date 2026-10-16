// Dupliqué de socle/convex/modules/direct/delegations.ts @ ad2e7fdc2 — adaptations : personnes et réseaux — constructeurs `networkQuery`/`networkMutation`, lecteur `directCaller`, cible `targetPersonId`, table `liveDelegations` (`networkId` copié de la session, `grantedByPersonId`), DTO en `personId` ; relation ACCEPTÉE avec l'hôte lue DANS le réseau de la session ; compte « actif » = personne non effacée (`deletionRequestedAt`), l'adhésion au réseau étant relue par la décision d'accès (V35) ; cible délégable = membre DÉCLARÉE du réseau de la session (`lib/access.memberHasStatus`, comme les appels) — un membre en attente est refusé `LIVE_NOT_DELEGABLE`, sans ligne écrite ; nom affiché du profil PUBLIÉ, `null` sans profil (l'écran traduit le nom neutre) ; refus à CODE de règle (`LIVE_ENDED`, `LIVE_NOT_DELEGABLE`, `LIVE_DELEGATIONS_FULL{max}`) et refus de droit `liveRoleRequired` (garde de la fondation) au lieu des phrases ; commentaires rapportés au moteur.
/**
 * DÉLÉGATIONS de gestion d'un direct — cohôte et modérateur (D-11, ADR-0144).
 * API publique : `api.modules.live.delegations.*`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉLÉGUER N'EST PAS PROMOUVOIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Accorder une délégation n'ouvre AUCUN micro : rien n'est écrit dans
 * `liveSpeakers`, aucun jeton n'est réémis, le SFU n'est pas touché. C'est
 * la contrepartie exacte de la doctrine du plateau — retirer de l'antenne
 * n'exclut pas, déléguer ne fait pas parler.
 *
 * ⚠️ Seul l'HÔTE accorde et révoque (`delegate`, refusé à tout délégué) : une
 * délégation qui se re-délègue n'a plus de fond, et l'hôte perdrait la trace de
 * qui tient sa salle.
 *
 * ⚠️ L'ÉLIGIBILITÉ est celle de l'invitation à l'antenne, à une exception près,
 * assumée : un INTERVENANT peut recevoir une délégation (`assertInvitableTarget`
 * refuserait `on_stage`, ce qui est juste pour inviter — la personne est déjà
 * là — et faux ici : le premier cohôte naturel d'un direct est souvent celui
 * qui est déjà à l'antenne). Tout le reste est relu à l'identique : relation
 * ACCEPTÉE avec l'hôte dans le réseau (ADR-0061, même sur un direct public),
 * adhésion DÉCLARÉE et audience, blocage, exclusion, personne non effacée,
 * profil publié.
 */
import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { memberHasStatus } from "../../lib/access"
import { failRule } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"
import { miniProfileCache, publishedMiniProfile } from "../people/miniProfile"
import { assertVisibleDirectSession, banRow, delegationRecord, directCaller, directSessionAccessDecision, requireDirectPermission } from "./access"
import { DIRECT_MAX_DELEGATIONS, defaultDelegationFlags, type DirectDelegationKind } from "./permissions"
import { directDelegationKindValidator } from "./validators"

type ReadCtx = Pick<QueryCtx, "db" | "storage">

/** Le refus opposé à une délégation impossible — UN seul code, exprès. */
function cannotDelegate(): never {
  return failRule("LIVE_NOT_DELEGABLE")
}

/**
 * Relit tout ce qui rend une personne délégable — les mêmes faits que
 * l'invitation à l'antenne, jugés maintenant et jamais hérités d'hier.
 */
async function isDelegableTarget(ctx: ReadCtx, session: Doc<"liveSessions">, targetPersonId: Id<"persons">): Promise<boolean> {
  if (targetPersonId === session.hostPersonId) return false

  const person = await ctx.db.get(targetPersonId)
  if (!person || person.deletionRequestedAt !== undefined) {
    return false
  }
  const profile = await publishedMiniProfile(ctx, targetPersonId)
  if (!profile.hasPublishedProfile) return false
  // On ne confie pas un rôle qu'on ne peut pas exercer : gérer la salle, c'est
  // écrire, et toute écriture exige une adhésion DÉCLARÉE au réseau de la
  // session (même aide que les appels). Un membre en attente voit la
  // conférence, il n'y gère rien — même refus que toute cible non délégable.
  if (!(await memberHasStatus(ctx, session.networkId, targetPersonId, "declaree"))) return false

  if ((await directSessionAccessDecision(ctx, targetPersonId, session)) !== "allowed") {
    return false
  }
  // ADR-0061 : le lien NÉGOCIÉ reste exigé, même sur un direct public.
  if (!(await isConnectedTo(ctx, session.networkId, session.hostPersonId, targetPersonId))) {
    return false
  }
  if (await isBlockedBetween(ctx, session.hostPersonId, targetPersonId)) {
    return false
  }
  if (await banRow(ctx, session._id, targetPersonId)) return false
  return true
}

async function assertDelegableTarget(ctx: ReadCtx, session: Doc<"liveSessions">, targetPersonId: Id<"persons">): Promise<void> {
  if (!(await isDelegableTarget(ctx, session, targetPersonId))) cannotDelegate()
}

/** Candidats privés de l'hôte, jugés avec les mêmes règles que grant.
 * Une page de relations par côté : pas d'annuaire ni de balayage illimité.
 * Les invités et intervenants déjà liés restent candidats, sans faux refus. */
export const searchCandidates = networkQuery({
  args: {
    sessionId: v.id("liveSessions"),
    side: v.union(v.literal("low"), v.literal("high")),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(v.object({
    personId: v.id("persons"),
    displayName: v.union(v.string(), v.null()),
    handle: v.union(v.string(), v.null()),
    avatarUrl: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args): Promise<PaginationResult<Pick<DirectDelegationDto, "personId" | "displayName" | "handle" | "avatarUrl">>> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "delegate")
    if (session.status === "ended") return { page: [], isDone: true, continueCursor: "" }
    const opts = { ...args.paginationOpts, numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 25) }
    const rows = await (args.side === "low"
      ? ctx.db.query("connections").withIndex("by_network_low_status", (q) => q.eq("networkId", ctx.networkId).eq("personIdLow", ctx.person._id).eq("status", "accepted"))
      : ctx.db.query("connections").withIndex("by_network_high_status", (q) => q.eq("networkId", ctx.networkId).eq("personIdHigh", ctx.person._id).eq("status", "accepted")))
      .order("desc").paginate(opts)
    const profileOf = miniProfileCache(ctx)
    const needle = args.search.trim().replace(/^@/, "").toLocaleLowerCase()
    const page: Pick<DirectDelegationDto, "personId" | "displayName" | "handle" | "avatarUrl">[] = []
    for (const connection of rows.page) {
      const personId = connection.personIdLow === ctx.person._id ? connection.personIdHigh : connection.personIdLow
      if (!(await isDelegableTarget(ctx, session, personId))) continue
      const profile = await profileOf(personId)
      if (needle && !(profile.displayName ?? "").toLocaleLowerCase().includes(needle) && !(profile.handle ?? "").toLocaleLowerCase().includes(needle)) continue
      page.push({ personId, displayName: profile.displayName, handle: profile.handle, avatarUrl: profile.avatarUrl })
    }
    return { ...rows, page }
  },
})

export type DirectDelegationDto = {
  personId: Id<"persons">
  kind: DirectDelegationKind
  canAdmitToStage: boolean
  canExclude: boolean
  canEndOrTransfer: boolean
  grantedAt: number
  /** `null` = nom neutre (profil non publié) : l'écran le traduit. */
  displayName: string | null
  handle: string | null
  avatarUrl: string | null
}

/**
 * ACCORDER une délégation. Hôte seul, idempotente par personne.
 *
 * ⚠️ Ré-accorder ROUVRE la même ligne (`by_session_person` est lu en
 * `.unique()`) : deux lignes pour une personne feraient lever toutes les
 * gardes d'un coup. Les drapeaux absents prennent le DÉFAUT du genre — c'est
 * la seule chose que le genre décide (`permissions.ts`).
 */
export const grant = networkMutation({
  writeBucket: "live.manage",
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
    kind: directDelegationKindValidator,
    canAdmitToStage: v.optional(v.boolean()),
    canExclude: v.optional(v.boolean()),
    canEndOrTransfer: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ delegationId: Id<"liveDelegations">; granted: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "delegate")
    if (session.status === "ended") {
      return failRule("LIVE_ENDED")
    }
    await assertDelegableTarget(ctx, session, args.targetPersonId)

    const defaults = defaultDelegationFlags(args.kind)
    const flags = {
      canAdmitToStage: args.canAdmitToStage ?? defaults.canAdmitToStage,
      canExclude: args.canExclude ?? defaults.canExclude,
      canEndOrTransfer: args.canEndOrTransfer ?? defaults.canEndOrTransfer,
    }
    const now = Date.now()
    const existing = await delegationRecord(ctx, session._id, args.targetPersonId)
    if (existing) {
      const wasLive = existing.revokedAt === undefined
      await ctx.db.patch(existing._id, {
        kind: args.kind,
        ...flags,
        grantedByPersonId: ctx.person._id,
        grantedAt: now,
        revokedAt: undefined,
      })
      return { delegationId: existing._id, granted: !wasLive }
    }

    // Le plafond ne se compte que sur les lignes VIVANTES : une révocation
    // libère sa place, une trace n'en occupe aucune.
    const live = await ctx.db
      .query("liveDelegations")
      .withIndex("by_session_revokedAt", (q) => q.eq("sessionId", session._id).eq("revokedAt", undefined))
      .take(DIRECT_MAX_DELEGATIONS + 1)
    if (live.length >= DIRECT_MAX_DELEGATIONS) {
      return failRule("LIVE_DELEGATIONS_FULL", { max: DIRECT_MAX_DELEGATIONS })
    }

    const delegationId = await ctx.db.insert("liveDelegations", {
      networkId: session.networkId,
      sessionId: session._id,
      personId: args.targetPersonId,
      kind: args.kind,
      ...flags,
      grantedByPersonId: ctx.person._id,
      grantedAt: now,
    })
    return { delegationId, granted: true }
  },
})

/**
 * RÉVOQUER une délégation. Hôte seul, idempotente.
 *
 * La ligne n'est jamais supprimée : `revokedAt` la neutralise et garde la trace
 * de qui a tenu quoi. Le refus est IMMÉDIAT — la garde relit la ligne à chaque
 * acte, il n'y a rien à expulser du SFU (déléguer n'ouvrait aucun flux).
 */
export const revoke = networkMutation({
  writeBucket: "live.manage",
  args: {
    sessionId: v.id("liveSessions"),
    targetPersonId: v.id("persons"),
  },
  handler: async (ctx, args): Promise<{ revoked: boolean }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "delegate")

    const existing = await delegationRecord(ctx, session._id, args.targetPersonId)
    if (!existing || existing.revokedAt !== undefined) {
      return { revoked: false }
    }
    await ctx.db.patch(existing._id, { revokedAt: Date.now() })
    return { revoked: true }
  },
})

/**
 * La console des délégations — hôte seul, bornée aux lignes VIVANTES.
 *
 * Une personne devenue invisible de la session (adhésion perdue, relation
 * rompue, blocage, exclusion) sort silencieusement de la liste : sa ligne
 * survit en base, mais la console ne prétend pas qu'elle gère encore.
 */
export const listForSession = networkQuery({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, args): Promise<DirectDelegationDto[]> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    await requireDirectPermission(ctx, session, ctx.person._id, "delegate")

    const rows = await ctx.db
      .query("liveDelegations")
      .withIndex("by_session_revokedAt", (q) => q.eq("sessionId", session._id).eq("revokedAt", undefined))
      .take(DIRECT_MAX_DELEGATIONS)

    const profileOf = miniProfileCache(ctx)
    const out: DirectDelegationDto[] = []
    for (const row of rows) {
      if ((await directSessionAccessDecision(ctx, row.personId, session)) !== "allowed") {
        continue
      }
      const profile = await profileOf(row.personId)
      out.push({
        personId: row.personId,
        kind: row.kind,
        canAdmitToStage: row.canAdmitToStage,
        canExclude: row.canExclude,
        canEndOrTransfer: row.canEndOrTransfer,
        grantedAt: row.grantedAt,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
      })
    }
    return out.sort((a, b) => b.grantedAt - a.grantedAt)
  },
})
