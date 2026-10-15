// Dupliqué de socle/convex/modules/iappel/groupCalls.ts (avec socle/convex/modules/reseauPersonnel/groupes.ts, l. 349-371 et 433-446 ; socle/convex/modules/iappel/calls.ts, l. 466-508) @ ad2e7fdc2 — adaptations : l. 99-169 (`inviteOf`, `invitesOf`, `loadGroupParticipants`) sur les tables du moteur, la présence lue sur les lignes de `callParticipants` (D27) au lieu du tableau `meetings.participants`, ordre d'arrivée rendu par la date de la ligne ; `isLiveMemberOfGroupCall` relu sur le fil porté par l'APPEL (`groupThreadId`) au lieu d'un pointeur `activeMeetingId` sur le fil ; `liveActiveCall` → `liveThreadCall` (index `by_groupThread_status`) ; garde commune des gestes (`requireCallParticipant`) : l'appel est du RÉSEAU de la fonction, une ligne de participation existe, le fil d'origine est relu — tout manquement rend le refus indistinct.
/**
 * Appels — LA GARDE, et les lectures que tous les chemins partagent.
 *
 * Connaître un identifiant d'appel ne donne AUCUN droit, pas même celui
 * d'apprendre qu'il existe : appel inconnu, d'un autre réseau, dont je n'ai pas
 * de ligne, ou d'un fil que j'ai quitté — la même réponse.
 */
import { GROUP_CALL_INVITES_SCAN, type GroupParticipantView, participantStateOf } from "@antia/social-contracts/callGroup"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { memberHasStatus } from "../../lib/access"
import { notFound } from "../../lib/errors"
import { liveMembershipOrNull } from "../groups/access"
import { findPublishedPersonByHandle, livePersonProfile } from "../people/miniProfile"

type ReadCtx = Pick<QueryCtx, "db">

/** Qui l'on appelle : une personne désignée par son identifiant de personne (journal, grille) ou par son identifiant public. */
export type CallTarget = { personId: Id<"persons"> } | { handle: string }

/**
 * La personne JOIGNABLE dans ce réseau, ou `null` : profil publié, personne non
 * effacée, membre DÉCLARÉE du réseau (elle doit pouvoir décrocher — un membre en
 * attente est visible, il n'agit pas encore). Identifiant inconnu, profil retiré,
 * non-membre : un seul et même `null`, traduit par l'appelant en un seul refus.
 */
export async function reachablePerson(ctx: ReadCtx, networkId: Id<"networks">, target: CallTarget): Promise<Doc<"persons"> | null> {
  const person = "handle" in target ? await findPublishedPersonByHandle(ctx, networkId, target.handle) : await livePersonProfile(ctx, target.personId)
  if (!person) return null
  return (await memberHasStatus(ctx, networkId, person._id, "declaree")) ? person : null
}

/** Le nom de la salle d'un appel — reconnaissable dans les journaux du serveur, jamais une donnée métier. */
export function callRoomName(kind: "direct" | "group", now: number): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  return `${kind === "group" ? "call-grp" : "call"}-${now.toString(36)}-${suffix}`
}

/** L'appel, s'il est de CE réseau — sinon le refus indistinct. */
export async function requireCallInNetwork(ctx: ReadCtx, networkId: Id<"networks">, callId: Id<"calls">): Promise<Doc<"calls">> {
  const call = await ctx.db.get(callId)
  if (!call || call.networkId !== networkId) return notFound()
  return call
}

/** La ligne d'une personne sur un appel, ou `null`. */
export async function participationOf(ctx: ReadCtx, callId: Id<"calls">, personId: Id<"persons">): Promise<Doc<"callParticipants"> | null> {
  return await ctx.db
    .query("callParticipants")
    .withIndex("by_call_person", (q) => q.eq("callId", callId).eq("personId", personId))
    .unique()
}

/**
 * Toutes les lignes d'un appel, dans l'ORDRE D'ARRIVÉE (l'hôte d'abord). Bornées
 * par construction : une par personne conviée, et l'ajout refuse au-delà de la
 * borne de balayage (`GROUP_CALL_INVITES_SCAN`).
 */
export async function participationsOf(ctx: ReadCtx, callId: Id<"calls">): Promise<Doc<"callParticipants">[]> {
  const rows = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_person", (q) => q.eq("callId", callId))
    .take(GROUP_CALL_INVITES_SCAN)
  return rows.sort((a, b) => a._creationTime - b._creationTime)
}

/** Une ligne est PRÉSENTE : la personne est entrée et n'est pas partie. */
export function isPresent(row: Pick<Doc<"callParticipants">, "joinedAt" | "leftAt">): boolean {
  return row.joinedAt !== undefined && row.leftAt === undefined
}

/** Le ticket d'une personne sur un appel de groupe — `null` si elle n'a pas été conviée. */
export async function inviteOf(ctx: ReadCtx, callId: Id<"calls">, personId: Id<"persons">): Promise<Doc<"callInvites"> | null> {
  return await ctx.db
    .query("callInvites")
    .withIndex("by_call_person", (q) => q.eq("callId", callId).eq("personId", personId))
    .unique()
}

/**
 * Tous les tickets d'un appel. Un refus, un manqué ou un départ libère une place
 * mais garde sa ligne d'historique : tronquer ferait réapparaître une sonnerie
 * et une place fantômes — d'où la même borne que les lignes de participation.
 */
export async function invitesOf(ctx: ReadCtx, callId: Id<"calls">): Promise<Doc<"callInvites">[]> {
  return await ctx.db
    .query("callInvites")
    .withIndex("by_call_person", (q) => q.eq("callId", callId))
    .take(GROUP_CALL_INVITES_SCAN)
}

/**
 * Le droit VIVANT d'être dans un appel lancé depuis un fil de groupe : `null` si
 * l'appel ne part pas d'un fil ; `false` ferme l'accès, même quand une ancienne
 * ligne de participation demeure (le membre a quitté le fil, le fil est fermé ou
 * en suppression). Le serveur multimédia n'est jamais la source du droit.
 */
export async function isLiveMemberOfThreadCall(ctx: ReadCtx, call: Doc<"calls">, personId: Id<"persons">): Promise<boolean | null> {
  if (call.groupThreadId === undefined) return null
  const thread = await ctx.db.get(call.groupThreadId)
  if (!thread || thread.closedAt !== undefined || thread.deletingAt !== undefined) return false
  return (await liveMembershipOrNull(ctx, thread._id, personId)) !== null
}

/**
 * LA garde d'un geste sur un appel : il est de CE réseau, j'en ai une ligne, et
 * — s'il part d'un fil — j'en suis membre vivant. Tout manquement : le refus
 * indistinct.
 */
export async function requireCallParticipant(
  ctx: ReadCtx,
  networkId: Id<"networks">,
  callId: Id<"calls">,
  personId: Id<"persons">,
): Promise<{ call: Doc<"calls">; participation: Doc<"callParticipants"> }> {
  const call = await requireCallInNetwork(ctx, networkId, callId)
  const participation = await participationOf(ctx, callId, personId)
  if (!participation) return notFound()
  if ((await isLiveMemberOfThreadCall(ctx, call, personId)) === false) return notFound()
  return { call, participation }
}

/**
 * L'appel VIVANT d'un fil, ou `null` : un fil n'a qu'un appel à la fois, le
 * second départ le REJOINT au lieu de lui faire concurrence.
 */
export async function liveThreadCall(ctx: ReadCtx, threadId: Id<"groupThreads">): Promise<Doc<"calls"> | null> {
  return await ctx.db
    .query("calls")
    .withIndex("by_groupThread_status", (q) => q.eq("groupThreadId", threadId).eq("status", "active"))
    .first()
}

/**
 * L'état de CHAQUE personne conviée, tickets et présence FUSIONNÉS. Trois
 * chemins en dépendent et doivent voir la même chose : la grille, la décision
 * de fin et le refus — deux lectures divergentes afficheraient un appel vivant
 * pendant qu'un autre chemin le termine. Pour un tête-à-tête non promu : l'hôte
 * et le destinataire (« sonne » sans ticket, « connecté » s'il a décroché).
 */
export async function loadGroupParticipants(ctx: ReadCtx, call: Doc<"calls">): Promise<GroupParticipantView[]> {
  const [rows, invites] = await Promise.all([participationsOf(ctx, call._id), invitesOf(ctx, call._id)])
  const ticketOf = new Map(invites.map((invite) => [invite.personId as string, invite]))
  return rows.map((row) => {
    const ticket = ticketOf.get(row.personId) ?? null
    return participantStateOf({
      isHost: row.personId === call.createdByPersonId,
      invite: ticket === null ? null : { personId: row.personId, status: ticket.status, reason: ticket.reason ?? null },
      presence: { personId: row.personId, joinedAt: row.joinedAt ?? null, leftAt: row.leftAt ?? null },
    })
  })
}
