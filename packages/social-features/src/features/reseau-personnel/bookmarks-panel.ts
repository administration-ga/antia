// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/bookmarks-panel.ts @ ad2e7fdc2 — adaptations : `BookmarkedPostSummary` tiré de l'API du moteur (`marks.marks.paginateBookmarks`, auteur au nom NULLABLE, carte de la PAGE quand la publication parle en son nom) au lieu d'un miroir recopié ; libellés par l'i18n — `t` en DERNIER paramètre de `emptyBookmarksText` et `bookmarksCountLabel` (clés `reseau:bookmarksPanel.*`, pluriel par `count`, zéro au pluriel comme au socle) ; ajoutés : l'identité affichée d'un aperçu (`bookmarkIdentity` : la page, sinon l'auteur, sinon un nom neutre) et la lecture des refus du moteur (`markActionErrorText`).
/**
 * bookmarks-panel — ce que le volet ENREGISTREMENTS décide, hors de tout
 * composant.
 *
 * Les libellés, l'identité d'un aperçu et l'état vide vivent ici, où c'est
 * vérifiable, et non dans le corps de `BookmarksPanel`.
 *
 * Le DTO est celui du moteur (`marks.marks.paginateBookmarks`) : une
 * PROJECTION RÉDUITE d'une publication — ni médias, ni réactions, ni audience,
 * ni raison — donc PAS le DTO que `PostCard` attend : le panneau rend une
 * carte à lui, pas `PostCard`.
 *
 * Aucun import React ni runtime Convex : ce module ne connaît que des données.
 */

import type { api } from "@antia/api/engine"
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import type { FunctionReturnType } from "convex/server"
import type { TFunction } from "i18next"

/** Un aperçu de publication enregistrée, tel que le moteur le rend (une page de `paginateBookmarks`). */
export type BookmarkedPostSummary = FunctionReturnType<typeof api.modules.marks.marks.paginateBookmarks>["page"][number]

/**
 * L'état vide — il EXPLIQUE le geste qui peuple cette liste, plutôt que de
 * se contenter de dire qu'elle est vide : sans ce mode d'emploi, rien à
 * l'écran ne dit qu'un menu « … » ailleurs dans le fil peut la remplir.
 */
export function emptyBookmarksText(t: TFunction): string {
  return t("reseau:bookmarksPanel.empty")
}

/** « 3 publications enregistrées » — accord, 0 compris (comme `memberCountLabel`). */
export function bookmarksCountLabel(n: number, t: TFunction): string {
  return t("reseau:bookmarksPanel.count", { count: n })
}

/** Qui l'aperçu montre en tête : un nom, une image, la forme de la pastille. */
export interface BookmarkIdentity {
  name: string
  imageUrl: string | null
  /** Le nom est-il celui qu'une personne ou une page a PUBLIÉ ? Sinon, pas d'initiales à tirer. */
  hasIdentity: boolean
  shape: "round" | "square"
}

/**
 * L'en-tête d'un aperçu : la PAGE quand la publication parle en son nom (son
 * signataire n'en est pas l'auteur affiché), sinon l'AUTEUR, sinon un nom
 * neutre — le moteur rend `null` pour une personne sans profil publié, jamais
 * un état civil.
 */
export function bookmarkIdentity(item: Pick<BookmarkedPostSummary, "author" | "page">, t: TFunction): BookmarkIdentity {
  if (item.page !== null) {
    return { name: item.page.name, imageUrl: item.page.logoUrl, hasIdentity: true, shape: "square" }
  }
  const name = item.author.displayName?.trim()
  if (name !== undefined && name.length > 0) {
    return { name, imageUrl: item.author.avatarUrl, hasIdentity: true, shape: "round" }
  }
  return { name: t("reseau:bookmarksPanel.unnamedAuthor"), imageUrl: item.author.avatarUrl, hasIdentity: false, shape: "round" }
}

/** Les codes qui disent moins que la phrase du geste (refus indistinct, argument, conflit). */
const SILENT_ENGINE_CODES: readonly string[] = Object.freeze(["notFound", "invalidArgument", "conflict"])

/**
 * Le texte d'un geste refusé : la RÈGLE du domaine enfreinte, sinon un code
 * PARLANT du moteur (débit…), sinon la phrase du geste (`fallbackKey`, clé
 * qualifiée). Jamais le message brut d'une erreur serveur.
 */
export function markActionErrorText(error: unknown, fallbackKey: string, t: TFunction): string {
  const rule = engineErrorRule(error)
  if (rule !== null) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(error)
  if (code !== null && !SILENT_ENGINE_CODES.includes(code)) return t(`errors:${code}`)
  return t(fallbackKey)
}
