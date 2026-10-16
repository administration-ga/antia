// Dupliqué de socle/convex/modules/direct/reactions.ts @ ad2e7fdc2 — adaptations : constructeurs `networkMutation` / `networkQuery`, visibilité par le lecteur du réseau (`assertVisibleDirectSession(ctx, directCaller(ctx), …)` : session inconnue, d'un autre réseau ou hors audience → `notFound` indistinct) ; table `liveReactions` (avec `networkId`, copié de la session), personne (`personId`) au lieu de l'utilisateur ; refus à CODE au lieu de la phrase (règle `LIVE_NOT_LIVE`) ; débit `live.reaction` par `enforceRateLimit` (le limiteur `directReaction` du socle, mêmes valeurs ; refus `rateLimited` avec délai, plus de phrase) ; une rafale non numérique (`NaN`) crédite UNE réaction au lieu d'empoisonner la ligne de la personne et le total recomposé ; genres typés par le vocabulaire du fil (`PersonalReactionKind`, celui du validateur) ; commentaires rapportés au moteur (total recomposé dans `liveSessionCounters`, D28).
/**
 * Les RÉACTIONS du direct — le chemin CHAUD, et sa règle d'or.
 * API publique : `api.modules.live.reactions.*`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * JAMAIS D'INCRÉMENT D'UN DOCUMENT PARTAGÉ SUR LE CHEMIN CHAUD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cent spectateurs qui applaudissent en même temps n'écrivent JAMAIS la même
 * ligne : chacun incrémente SA ligne (session, personne, genre) — zéro
 * conflit OCC entre spectateurs. Les totaux sont recomposés par l'écrivain
 * unique (`reap.recomputeAggregates`, D28), à la minute et aux transitions :
 * ni la session ni ses compteurs ne s'écrivent ici.
 *
 * Le client BATCHE : il accumule les taps et envoie une rafale (≤ 12) — le
 * serveur re-borne quoi qu'il envoie, et le seau `live.reaction` borne la
 * cadence des rafales.
 */
import type { PersonalReactionKind } from "@antia/social-domain/content"
import { v } from "convex/values"

import { failRule } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { assertVisibleDirectSession, directCaller } from "./access"
import { DIRECT_REACTION_BURST_MAX } from "./domain"
import { directReactionKindValidator } from "./validators"

/** Lignes balayées pour le résumé (spectateurs × genres, borné). */
const REACTIONS_SUMMARY_SCAN = 1000

/**
 * Envoyer une RAFALE de réactions d'un genre. Session LIVE seulement — on ne
 * réagit pas à un replay (le replay se regarde, le direct se vit).
 */
export const react = networkMutation({
  args: {
    sessionId: v.id("liveSessions"),
    kind: directReactionKindValidator,
    /** Taille de la rafale accumulée côté client — re-bornée ici. */
    burst: v.number(),
  },
  handler: async (ctx, args): Promise<{ credited: number }> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)
    if (session.status !== "live") return failRule("LIVE_NOT_LIVE")

    await enforceRateLimit(ctx, "live.reaction", ctx.person._id)

    // ⚠️ `NaN` traverse `Math.trunc`, `Math.max` et `Math.min` : la ligne, puis
    // le total recomposé, deviendraient `NaN` pour toujours. Une rafale
    // illisible vaut UN tap.
    const requested = Number.isNaN(args.burst) ? 1 : Math.trunc(args.burst)
    const credited = Math.min(Math.max(requested, 1), DIRECT_REACTION_BURST_MAX)

    // MA ligne, et seulement la mienne — upsert par (session, personne, genre).
    const existing = await ctx.db
      .query("liveReactions")
      .withIndex("by_session_person_kind", (q) => q.eq("sessionId", session._id).eq("personId", ctx.person._id).eq("kind", args.kind))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + credited,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("liveReactions", {
        networkId: session.networkId,
        sessionId: session._id,
        personId: ctx.person._id,
        kind: args.kind,
        count: credited,
        updatedAt: now,
      })
    }
    return { credited }
  },
})

export type DirectReactionSummary = {
  total: number
  byKind: { kind: PersonalReactionKind; count: number }[]
  /** MES envois par genre — ce que l'écran anime en local. */
  mine: { kind: PersonalReactionKind; count: number }[]
}

/**
 * Le RÉSUMÉ des réactions — recomposé des lignes par personne, borné.
 * Abonnement OPT-IN côté client, comme les commentaires : la barre fermée ne
 * souscrit pas.
 */
export const summary = networkQuery({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, args): Promise<DirectReactionSummary> => {
    const session = await assertVisibleDirectSession(ctx, directCaller(ctx), args.sessionId)

    const rows = await ctx.db
      .query("liveReactions")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .take(REACTIONS_SUMMARY_SCAN)

    const byKind = new Map<PersonalReactionKind, number>()
    const mine = new Map<PersonalReactionKind, number>()
    let total = 0
    for (const row of rows) {
      total += row.count
      byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.count)
      if (row.personId === ctx.person._id) {
        mine.set(row.kind, (mine.get(row.kind) ?? 0) + row.count)
      }
    }
    return {
      total,
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })),
      mine: [...mine.entries()].map(([kind, count]) => ({ kind, count })),
    }
  },
})
