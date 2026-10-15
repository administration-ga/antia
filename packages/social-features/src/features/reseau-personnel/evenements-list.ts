// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/evenements-list.ts @ ad2e7fdc2 — adaptations : `EvenementListItem` tiré de l'API du moteur (`events.events.myAgenda`, organisateur nommé par le contrat `counterpartLabel`) au lieu d'un miroir recopié ; statuts et bornes tirés du domaine (`@antia/social-domain/events`) ; jour civil et dates dans le FUSEAU DU LECTEUR (paramètre `timeZone`, `viewerTimeZone()` = celui du navigateur) et la LANGUE courante (paramètre `locale` de `formatEventRange`) au lieu du fuseau de Libreville et du français imposés à tous ; libellés par l'i18n — `EVENT_SECTION_TITLES` → `EVENT_SECTION_TITLE_KEYS`, `t` en DERNIER paramètre de `myResponseLabel`, `emptyAgendaText`, `announceAudienceLabel`, `announceSummary` (clés `reseau:evenementsList.*`, pluriels par `count`) ; ajoutés pour la composition d'un évènement sur la page réseau (la composition vivait dans iAgenda, absent du moteur) : bornes et calculs du formulaire repris de `iagenda/personal-event-form.ts` (`isEndAfterStart`, `tomorrowLocalDate`, `localDateTimeMs`, `validateEventTitle`), récapitulatif des invitations (`eventInviteReportLabel`), réponse d'un invité (`participantStatusLabel`), nom neutre (`eventPersonName`) et lecture des refus du moteur (`eventActionErrorText`).
/**
 * evenements-list — ce que le volet ÉVÈNEMENTS décide, hors de tout composant.
 *
 * Le classement en sections, les libellés et les gardes d'affichage vivent
 * ici, où c'est vérifiable, et non dans le corps de `EvenementsPanel`.
 *
 * Le DTO est celui du moteur (`events.events.myAgenda`), tiré de son API : un
 * miroir recopié divergerait en silence. La garde de fond (qui peut répondre,
 * qui peut annuler) reste au serveur — ce module ne décide que ce qu'un écran
 * affiche.
 *
 * ⚠️ LE JOUR CIVIL EST CELUI DU LECTEUR. Le socle affichait tout à l'heure
 * de Libreville ; le moteur sert des réseaux dont les membres vivent sur
 * plusieurs fuseaux. Chaque fonction qui raisonne en jour reçoit donc le
 * fuseau en PARAMÈTRE — l'écran passe celui du navigateur (`viewerTimeZone`),
 * un test passe le sien. Jamais un fuseau imposé.
 *
 * Aucun import React ni runtime Convex : ce module ne connaît que des données.
 */

import type { api } from "@antia/api/engine"
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import type { PersonalReachAudience } from "@antia/social-domain/content"
import {
  PERSONAL_EVENT_DESCRIPTION_MAX_LENGTH,
  PERSONAL_EVENT_LOCATION_MAX_LENGTH,
  PERSONAL_EVENT_TITLE_MAX_LENGTH,
  PERSONAL_EVENT_TITLE_MIN_LENGTH,
  type PersonalEventParticipationStatus as DomainParticipationStatus,
  type PersonalEventStatus as DomainEventStatus,
} from "@antia/social-domain/events"
import type { FunctionReturnType } from "convex/server"
import type { TFunction } from "i18next"

export type PersonalEventStatus = DomainEventStatus

export type PersonalEventParticipationStatus = DomainParticipationStatus

/** Un évènement de MON agenda, tel que le moteur le rend (`events.events.myAgenda`). */
export type EvenementListItem = FunctionReturnType<typeof api.modules.events.events.myAgenda>["items"][number]

// ═══════════════════════════════════════════════════════════════
// Le jour civil DU LECTEUR — la seule notion de « aujourd'hui » du module
// ═══════════════════════════════════════════════════════════════

/** Le fuseau du LECTEUR — celui de son navigateur. Jamais un fuseau imposé. */
export function viewerTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Le formateur de la clé de jour : calendrier grégorien et chiffres latins
 * forcés, pour que la clé ne dépende jamais de la langue du système.
 */
function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  const known = dayKeyFormatters.get(timeZone)
  if (known !== undefined) return known
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "gregory",
    numberingSystem: "latn",
  })
  dayKeyFormatters.set(timeZone, formatter)
  return formatter
}

/**
 * Clé "AAAA-MM-JJ" du jour civil dans `timeZone` — une CLÉ, jamais affichée.
 * Le format ISO se compare en chaîne exactement comme des dates
 * (`"2026-08-18" < "2026-08-19"`) : pas besoin de recalculer des bornes en
 * millisecondes ni de supposer un décalage horaire fixe — `Intl` porte la
 * conversion de fuseau.
 */
function dayKey(ms: number, timeZone: string): string {
  const parts = dayKeyFormatter(timeZone).formatToParts(new Date(ms))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

// ═══════════════════════════════════════════════════════════════
// Passé, réponse possible
// ═══════════════════════════════════════════════════════════════

/**
 * L'évènement est-il PASSÉ ? Décision par JOUR CIVIL (du lecteur), pas par
 * instant exact : un évènement qui a fini ce matin reste « d'aujourd'hui »
 * jusqu'à minuit, comme dans n'importe quel agenda — il ne bascule pas en
 * historique au fil des heures. Seul un évènement dont la fin tombe un jour
 * CIVIL antérieur à aujourd'hui est passé.
 *
 * `now` et `timeZone` sont des PARAMÈTRES, jamais `Date.now()` ni le fuseau
 * lu en douce : sans quoi la fonction ne serait plus testable.
 */
export function isPastEvent(event: Pick<EvenementListItem, "endAt">, now: number, timeZone: string): boolean {
  return dayKey(event.endAt, timeZone) < dayKey(now, timeZone)
}

/**
 * MONTRER les boutons de réponse ? Le serveur (`canRespondToPersonalEvent`,
 * `@antia/social-domain/events`) n'exige qu'un évènement `scheduled` et une
 * ligne de participation à soi — il permettrait donc techniquement de répondre
 * à un évènement déjà passé (« consigner a posteriori » est un usage d'agenda
 * légitime côté serveur). Ce module est VOLONTAIREMENT plus strict à l'écran :
 * un évènement annulé OU déjà passé ne propose plus de bouton, parce que la
 * question qu'il pose (« y allez-vous ? ») n'a plus de sens une fois
 * l'évènement révolu. Le serveur reste seul juge — ceci n'est qu'un choix
 * d'affichage.
 */
export function canRespond(event: Pick<EvenementListItem, "status" | "myParticipation" | "endAt">, now: number, timeZone: string): boolean {
  if (event.status === "cancelled") return false
  // L'organisateur n'a pas de ligne de participation : il ne se répond pas
  // à lui-même (même règle que le serveur).
  if (event.myParticipation === null) return false
  if (isPastEvent(event, now, timeZone)) return false
  return true
}

// ═══════════════════════════════════════════════════════════════
// Tri
// ═══════════════════════════════════════════════════════════════

/** Ordre chronologique ASCENDANT (le plus proche du passé d'abord). */
export function sortEvents(events: readonly EvenementListItem[]): EvenementListItem[] {
  return [...events].sort((a, b) => a.startAt - b.startAt)
}

// ═══════════════════════════════════════════════════════════════
// Les quatre sections de l'agenda
// ═══════════════════════════════════════════════════════════════

export interface GroupedPersonalEvents {
  upcoming: EvenementListItem[]
  today: EvenementListItem[]
  pendingInvitations: EvenementListItem[]
  past: EvenementListItem[]
}

/** Les quatre sections, dans l'ordre d'AFFICHAGE (haut → bas de l'écran). */
export const EVENT_SECTIONS = ["upcoming", "today", "pendingInvitations", "past"] as const
export type EventSectionKey = (typeof EVENT_SECTIONS)[number]

/** Le titre de chaque section — une clé qualifiée, traduite par l'écran. */
export const EVENT_SECTION_TITLE_KEYS: Readonly<Record<EventSectionKey, string>> = Object.freeze({
  upcoming: "reseau:evenementsList.section.upcoming",
  today: "reseau:evenementsList.section.today",
  pendingInvitations: "reseau:evenementsList.section.pendingInvitations",
  past: "reseau:evenementsList.section.past",
})

/**
 * Classe MON agenda en quatre sections MUTUELLEMENT EXCLUSIVES — un évènement
 * ne tombe jamais dans deux d'entre elles à la fois.
 *
 * ⚠️ L'ORDRE D'AFFICHAGE (« À venir » puis « Aujourd'hui » puis « Invitations
 * en attente » puis « Passés ») n'est PAS l'ordre de CLASSEMENT : celui-ci
 * suit une priorité différente, documentée ici parce qu'un évènement peut
 * satisfaire plusieurs critères à la fois (une invitation de demain, encore
 * sans réponse, est à la fois « de demain » ET « en attente »).
 *
 * Priorité de classement (le premier critère qui matche gagne) :
 *
 *  1. PASSÉ (`isPastEvent`) — un évènement révolu est de l'historique, quel
 *     que soit mon statut de réponse. Répondre à une invitation pour un
 *     évènement qui a déjà eu lieu n'aide plus personne : mieux vaut le
 *     ranger avec le reste du passé que de laisser une invitation « en
 *     attente » qui ne le sera plus jamais.
 *  2. INVITATION EN ATTENTE — je ne suis pas l'organisateur, ma réponse est
 *     `pending`, et je PEUX encore répondre (`canRespond` : ni annulé, ni
 *     passé — donc ce critère ne peut plus matcher un évènement déjà écarté
 *     par la règle 1). Sortie du fil chronologique DÉLIBÉRÉMENT : c'est la
 *     seule section qui rassemble tout ce qui attend une décision de ma
 *     part, qu'elle soit pour aujourd'hui ou pour dans un mois, plutôt que de
 *     la laisser diluée entre « Aujourd'hui » et « À venir ».
 *  3. AUJOURD'HUI — le `startAt` tombe le jour civil courant du lecteur.
 *     Couvre mes évènements organisés et mes invitations déjà répondues
 *     (acceptée, déclinée, peut-être) du jour, ainsi qu'un évènement du jour
 *     ANNULÉ (un évènement annulé reste visible à sa date, pour qu'on le VOIE
 *     avant de s'y présenter — cf. le commentaire de tête de `events.ts`).
 *  4. À VENIR — tout le reste : une date future, organisée ou déjà répondue.
 *
 * Ces quatre règles sont EXHAUSTIVES et DISJOINTES par construction (chaque
 * évènement s'arrête à la première règle qui matche) : la somme des quatre
 * sections vaut toujours la longueur de l'entrée.
 */
export function groupEvents(events: readonly EvenementListItem[], now: number, timeZone: string): GroupedPersonalEvents {
  const todayKey = dayKey(now, timeZone)
  const upcoming: EvenementListItem[] = []
  const today: EvenementListItem[] = []
  const pendingInvitations: EvenementListItem[] = []
  const past: EvenementListItem[] = []

  for (const event of events) {
    if (isPastEvent(event, now, timeZone)) {
      past.push(event)
      continue
    }
    if (event.myParticipation?.status === "pending" && canRespond(event, now, timeZone)) {
      pendingInvitations.push(event)
      continue
    }
    if (dayKey(event.startAt, timeZone) === todayKey) {
      today.push(event)
      continue
    }
    upcoming.push(event)
  }

  return {
    upcoming: sortEvents(upcoming),
    today: sortEvents(today),
    pendingInvitations: sortEvents(pendingInvitations),
    past: sortEvents(past),
  }
}

/**
 * Aperçu du rail droit : les décisions en attente d'abord, puis ce qui se
 * passe aujourd'hui et enfin les prochaines dates. Le passé n'y revient pas
 * et chaque évènement n'apparaît qu'une fois grâce à `groupEvents`.
 */
export function eventsForRail(events: readonly EvenementListItem[], now: number, timeZone: string, limit = 3): EvenementListItem[] {
  if (limit <= 0) return []
  const grouped = groupEvents(events, now, timeZone)
  return [...grouped.pendingInvitations, ...grouped.today, ...grouped.upcoming].filter((event) => event.status !== "cancelled").slice(0, limit)
}

// ═══════════════════════════════════════════════════════════════
// Libellés
// ═══════════════════════════════════════════════════════════════

/**
 * Le libellé de MA réponse. `null` seulement quand je n'ai pas de ligne de
 * participation — c'est-à-dire quand j'organise : je ne me réponds pas à
 * moi-même (même règle que le serveur, `EventDto.myParticipation`).
 */
export function myResponseLabel(status: PersonalEventParticipationStatus | null, t: TFunction): string | null {
  switch (status) {
    case "accepted":
      return t("reseau:evenementsList.response.accepted")
    case "declined":
      return t("reseau:evenementsList.response.declined")
    case "maybe":
      return t("reseau:evenementsList.response.maybe")
    case "pending":
      return t("reseau:evenementsList.response.pending")
    case null:
      return null
  }
}

/** La réponse d'un INVITÉ, dite à la troisième personne (la liste des invités). */
export function participantStatusLabel(status: PersonalEventParticipationStatus, t: TFunction): string {
  switch (status) {
    case "accepted":
      return t("reseau:evenementsList.participant.accepted")
    case "declined":
      return t("reseau:evenementsList.participant.declined")
    case "maybe":
      return t("reseau:evenementsList.participant.maybe")
    case "pending":
      return t("reseau:evenementsList.participant.pending")
  }
}

/** L'état vide de TOUT l'agenda (les quatre sections sont vides). */
export const EMPTY_AGENDA_TEXT_KEY = "reseau:evenementsList.emptyAgenda"

export function emptyAgendaText(t: TFunction): string {
  return t(EMPTY_AGENDA_TEXT_KEY)
}

/**
 * Une personne sans profil publié n'a pas de nom à montrer : le moteur rend
 * `null` (jamais un état civil), l'écran dit un libellé neutre.
 */
export function eventPersonName(displayName: string | null, t: TFunction): string {
  const name = displayName?.trim()
  return name !== undefined && name.length > 0 ? name : t("reseau:evenementsList.unnamedPerson")
}

// ═══════════════════════════════════════════════════════════════
// ANNONCER au réseau — deux publics à ne jamais confondre (R-16)
// ═══════════════════════════════════════════════════════════════

/** Les deux portées d'une annonce — celles d'une publication personnelle (le domaine). */
export type AnnounceAudience = PersonalReachAudience

/**
 * Le libellé d'une audience d'ANNONCE, tel qu'il se lit DANS une phrase.
 *
 * Volontairement le même vocabulaire que `AUDIENCE_OPTIONS` (`shared.ts`) —
 * deux mots différents pour la même portée feraient croire à deux portées.
 */
export function announceAudienceLabel(audience: AnnounceAudience, t: TFunction): string {
  return audience === "public" ? t("reseau:evenementsList.announceAudience.public") : t("reseau:evenementsList.announceAudience.connections")
}

/**
 * Ce que l'annonce va faire, en une phrase, AVANT de l'envoyer.
 *
 * ⚠️ Deux publics, jamais le même : les INVITÉS (lignes de participation, qui
 * répondent) et les LECTEURS de l'annonce (l'audience de la publication, qui
 * la voient passer dans leur fil). L'écran les confondait — l'annonce partait
 * d'un clic, en `connections` codé en dur, sans dire à qui.
 */
export function announceSummary(event: Pick<EvenementListItem, "participantCount">, audience: AnnounceAudience, t: TFunction): string {
  return t("reseau:evenementsList.announceSummary", { count: event.participantCount, audience: announceAudienceLabel(audience, t) })
}

// ═══════════════════════════════════════════════════════════════
// La plage de dates — dans la langue et le fuseau du lecteur
// ═══════════════════════════════════════════════════════════════

const EVENT_DATE_OPTIONS: Readonly<Intl.DateTimeFormatOptions> = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}

const EVENT_TIME_OPTIONS: Readonly<Intl.DateTimeFormatOptions> = {
  hour: "2-digit",
  minute: "2-digit",
}

const rangeFormatters = new Map<string, Intl.DateTimeFormat>()

function rangeFormatter(kind: "date" | "time", locale: string, timeZone: string): Intl.DateTimeFormat {
  const key = `${kind}|${locale}|${timeZone}`
  const known = rangeFormatters.get(key)
  if (known !== undefined) return known
  const formatter = new Intl.DateTimeFormat(locale, { ...(kind === "date" ? EVENT_DATE_OPTIONS : EVENT_TIME_OPTIONS), timeZone })
  rangeFormatters.set(key, formatter)
  return formatter
}

/**
 * La plage lisible d'un évènement, dans la LANGUE de l'écran (`locale`) et le
 * FUSEAU du lecteur (`timeZone`) — quel que soit le fuseau dans lequel il a été
 * pensé (`timeZone` du DTO, fixé à la création).
 *
 * Trois formes, selon la fenêtre :
 *  - même jour civil : une seule date, une plage d'heures ("mercredi 19 août
 *    2026, 09:00 → 11:00") ;
 *  - jours différents : date et heure des DEUX bornes ("mercredi 19 août
 *    2026, 09:00 → jeudi 20 août 2026, 11:00") ;
 *  - `endsAt` absent (`null`) : seule la date de début, sans flèche — un
 *    évènement personnel a toujours une fin au schéma, mais la fonction reste
 *    défensive pour rester réutilisable ailleurs sans porter cette hypothèse.
 */
export function formatEventRange(startsAt: number, endsAt: number | null, locale: string, timeZone: string): string {
  const startDate = rangeFormatter("date", locale, timeZone).format(new Date(startsAt))
  const startTime = rangeFormatter("time", locale, timeZone).format(new Date(startsAt))
  if (endsAt === null) return `${startDate}, ${startTime}`

  const endTime = rangeFormatter("time", locale, timeZone).format(new Date(endsAt))
  if (dayKey(startsAt, timeZone) === dayKey(endsAt, timeZone)) {
    return `${startDate}, ${startTime} → ${endTime}`
  }
  const endDate = rangeFormatter("date", locale, timeZone).format(new Date(endsAt))
  return `${startDate}, ${startTime} → ${endDate}, ${endTime}`
}

// ═══════════════════════════════════════════════════════════════
// COMPOSER un évènement — sur la page réseau (iAgenda n'existe pas ici)
// ═══════════════════════════════════════════════════════════════
//
// Au socle, la composition vivait dans iAgenda (`PersonalEventDialog`,
// `personal-event-form.ts`) : le réseau y envoyait par une INTENTION portée
// par l'adresse (`agenda-create-intent.ts`). Le moteur n'a pas d'iAgenda :
// l'intention vise la page réseau, et le volet Évènements compose lui-même.
// Les calculs du formulaire sont repris ici, purs et testés.

/** Les bornes du domaine — le client borne pour éviter un aller-retour perdu, le serveur reste seul juge. */
export const EVENT_TITLE_MIN_LENGTH = PERSONAL_EVENT_TITLE_MIN_LENGTH
export const EVENT_TITLE_MAX_LENGTH = PERSONAL_EVENT_TITLE_MAX_LENGTH
export const EVENT_DESCRIPTION_MAX_LENGTH = PERSONAL_EVENT_DESCRIPTION_MAX_LENGTH
export const EVENT_LOCATION_MAX_LENGTH = PERSONAL_EVENT_LOCATION_MAX_LENGTH

/** La phrase d'une fin qui ne suit pas le début — clé qualifiée. */
export const END_BEFORE_START_KEY = "reseau:evenementsList.endBeforeStart"

/** La règle, seule : une fin strictement après le début. */
export function isEndAfterStart(startAt: number, endAt: number): boolean {
  return Number.isFinite(startAt) && Number.isFinite(endAt) && endAt > startAt
}

/**
 * `AAAA-MM-JJ` local — la valeur par défaut du champ date (demain).
 *
 * ⚠️ En heure LOCALE du navigateur de l'organisateur : c'est ce fuseau-là qui
 * est FIXÉ à la création côté serveur. `now` est un PARAMÈTRE.
 */
export function tomorrowLocalDate(now: number): string {
  const date = new Date(now + 24 * 3600 * 1000)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Millisecondes locales d'un couple (date, heure) saisi au formulaire.
 *
 * Rend `NaN` sur une saisie incomplète ou illisible — l'appelant le teste
 * (`Number.isFinite`) et le DIT, plutôt que d'envoyer un instant absurde.
 */
export function localDateTimeMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime()
}

/** Le titre proposé est-il recevable ? `null` quand ça passe, la phrase du refus sinon. */
export function validateEventTitle(raw: string, t: TFunction): string | null {
  const title = raw.trim()
  if (title.length < EVENT_TITLE_MIN_LENGTH || title.length > EVENT_TITLE_MAX_LENGTH) {
    return t("reseau:evenementsList.titleLength", { min: EVENT_TITLE_MIN_LENGTH, max: EVENT_TITLE_MAX_LENGTH })
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// INVITER des relations à un évènement
// ═══════════════════════════════════════════════════════════════

/**
 * La réponse du serveur à UNE invitation : `invited: false` quand la personne
 * a DÉJÀ répondu « je participe » ou « peut-être » — rien à réinviter.
 */
export type EventInviteOutcomeKind = "invited" | "alreadyResponded"

export function classifyEventInviteResult(result: { invited: boolean }): EventInviteOutcomeKind {
  return result.invited ? "invited" : "alreadyResponded"
}

/** Le décompte d'un envoi groupé — une case par personne, jamais deux. */
export interface EventInviteOutcome {
  invited: number
  alreadyResponded: number
  failed: number
}

/**
 * Ce que l'envoi a produit, en une phrase — dire « Invitations envoyées »
 * quand la moitié des personnes avaient déjà répondu serait un mensonge poli.
 */
export function eventInviteReportLabel(outcome: EventInviteOutcome, t: TFunction): string {
  const parts: string[] = []
  if (outcome.invited > 0) parts.push(t("reseau:evenementsList.inviteReport.invited", { count: outcome.invited }))
  if (outcome.alreadyResponded > 0) parts.push(t("reseau:evenementsList.inviteReport.alreadyResponded", { count: outcome.alreadyResponded }))
  if (outcome.failed > 0) parts.push(t("reseau:evenementsList.inviteReport.failed", { count: outcome.failed }))
  if (parts.length === 0) return t("reseau:evenementsList.inviteReport.none")
  return t("reseau:evenementsList.inviteReport.sentence", { parts: parts.join(", ") })
}

/** Les codes qui disent moins que la phrase du geste (refus indistinct, argument, conflit). */
const SILENT_ENGINE_CODES: readonly string[] = Object.freeze(["notFound", "invalidArgument", "conflict"])

/**
 * Le texte d'un geste refusé : la RÈGLE du domaine enfreinte (évènement annulé,
 * fenêtre invalide…, avec ses bornes), sinon un code PARLANT du moteur (débit,
 * organisateur seul…), sinon la phrase du geste (`fallbackKey`, clé
 * qualifiée). Jamais le message brut d'une erreur serveur.
 */
export function eventActionErrorText(error: unknown, fallbackKey: string, t: TFunction): string {
  const rule = engineErrorRule(error)
  if (rule !== null) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(error)
  if (code !== null && !SILENT_ENGINE_CODES.includes(code)) return t(`errors:${code}`)
  return t(fallbackKey)
}
