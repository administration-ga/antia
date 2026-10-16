// Dupliqué de socle/packages/agent-features/src/features/messagerie/icom-public-reminders.ts @ ad2e7fdc2 — adaptations : DTO du moteur (`pages.followedUpdates.list` : `{ postId, publishedAt, excerpt, page }`, la page en carte `PageCard`) projeté par `pageUpdateFromEngine` ; BADGE de la page porté par le rappel (`pageBadge`, calculé par le serveur — une page de communauté n'est plus dite « officielle ») ; destination par la table des routes INJECTÉE et la règle d'`author-link` (`publicReminderHref(reminder, routes)` : une page sans route de page ne mène nulle part, jamais au profil d'une personne homonyme) ; heure relative traduite (`publicReminderTime(reminder, now, t)`).
/**
 * Adaptateur pur des rappels PUBLICS montrés sous les statuts d'iCom.
 *
 * iCom ne devient pas un second fil : il ne reçoit qu'un aperçu borné, sans
 * réaction ni commentaire, puis renvoie vers le réseau. Le serveur ne fournit
 * aucune URL de confiance ; la destination est reconstruite ici avec la règle
 * canonique des auteurs de page (`author-link`), sur les adresses que
 * l'application injecte.
 *
 * `channel` est réservé dans l'union pour une extension future. Il reste
 * volontairement NON RENDU tant que son contrat produit et sa route n'existent
 * pas : une branche inconnue ne doit jamais devenir un faux canal par défaut.
 */

import type { Badge } from "@antsia/social-domain/badges"
import type { TFunction } from "i18next"
import { authorHref, type AuthorRoutes } from "../reseau-personnel/author-link"
import { formatRelativeDate } from "../reseau-personnel/shared"

export const ICOM_PUBLIC_REMINDERS_MAX = 5

export interface IcomPageUpdateSource {
  kind: "page"
  postId: string
  publishedAt: number
  excerpt: string
  pageId: string
  pageHandle: string
  pageName: string
  pageLogoUrl?: string | null
  /** Le badge de confiance de la page, CALCULÉ par le serveur. */
  pageBadge: Badge
}

/** Forme réservée : aucun champ métier n'est inventé avant le vrai contrat. */
export interface IcomChannelUpdateSource {
  kind: "channel"
  [field: string]: unknown
}

export type IcomPublicUpdateSource =
  | IcomPageUpdateSource
  | IcomChannelUpdateSource

export interface IcomPageReminder {
  kind: "page"
  postId: string
  publishedAt: number
  excerpt: string
  pageId: string
  pageHandle: string
  pageName: string
  pageLogoUrl: string | null
  pageBadge: Badge
}

/**
 * Les rappels montrables aujourd'hui.
 *
 * Le retour reste discriminé, même s'il n'a qu'une branche pour l'instant :
 * l'arrivée d'un canal exigera une branche explicite au lieu d'être assimilée
 * silencieusement à une page.
 */
export type IcomPublicReminder = IcomPageReminder

/**
 * Un rappel tel que le moteur le rend (`pages.followedUpdates.list`) : la page
 * y est une CARTE (`PageCard`), dont seuls l'identité et le badge servent ici.
 */
export interface EngineFollowedUpdate {
  postId: string
  publishedAt: number
  excerpt: string
  page: {
    pageId: string
    handle: string
    name: string
    logoUrl: string | null
    badge: Badge
  }
}

/** Projette un rappel du moteur dans la forme de l'adaptateur. */
export function pageUpdateFromEngine(
  update: EngineFollowedUpdate,
): IcomPageUpdateSource {
  return {
    kind: "page",
    postId: String(update.postId),
    publishedAt: update.publishedAt,
    excerpt: update.excerpt,
    pageId: String(update.page.pageId),
    pageHandle: update.page.handle,
    pageName: update.page.name,
    pageLogoUrl: update.page.logoUrl,
    pageBadge: update.page.badge,
  }
}

function cleanExcerpt(excerpt: string): string {
  return excerpt.replace(/\s+/g, " ").trim()
}

export function publicRemindersForIcom(
  updates: readonly IcomPublicUpdateSource[],
): IcomPublicReminder[] {
  const reminders: IcomPublicReminder[] = []

  for (const update of updates) {
    if (reminders.length >= ICOM_PUBLIC_REMINDERS_MAX) break
    if (update.kind !== "page") continue

    reminders.push({
      kind: "page",
      postId: update.postId,
      publishedAt: update.publishedAt,
      excerpt: cleanExcerpt(update.excerpt),
      pageId: update.pageId,
      pageHandle: update.pageHandle,
      pageName: update.pageName,
      pageLogoUrl: update.pageLogoUrl ?? null,
      pageBadge: update.pageBadge,
    })
  }

  return reminders
}

/**
 * Destination reconstruite côté UI — jamais une URL transportée par le DTO.
 *
 * `null` quand l'application ne sert pas de page (`routes.page` absente) : le
 * rappel se lit alors sans lien. Mener au PROFIL du même identifiant serait
 * pire qu'un texte — les identifiants de pages et de personnes ne partagent
 * pas leur espace, et l'homonyme y prendrait la parole de la page.
 */
export function publicReminderHref(
  reminder: IcomPublicReminder,
  routes: AuthorRoutes,
): string | null {
  switch (reminder.kind) {
    case "page":
      return authorHref({ authorKind: "page", handle: reminder.pageHandle }, routes)
  }
}

export function publicReminderTime(
  reminder: IcomPublicReminder,
  now: number,
  t: TFunction,
): string {
  return formatRelativeDate(reminder.publishedAt, now, t)
}
