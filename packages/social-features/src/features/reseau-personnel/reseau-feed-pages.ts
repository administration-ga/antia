// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-feed-pages.ts @ ad2e7fdc2 — adaptations : annonce du « Voir plus » par l'i18n (`loadMoreAnnouncement(added, t)` : `t` en DERNIER paramètre, clés qualifiées `reseau:reseauFeedPages.*`, pluriel par `count`) ; chaîne de pages inchangée.
/**
 * reseau-feed-pages — la pagination du fil, décidée hors composant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE CHAÎNE DE PAGES, ET NI L'UN NI L'AUTRE DES DEUX RÉFLEXES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `myFeed` rend `{ items, nextCursor }`. Jusqu'au 2026-08-05, l'écran se
 * contentait d'une phrase morte : « D'autres publications existent au-delà de
 * cette fenêtre. » — une information sans issue.
 *
 * Ce qu'on ne fait PAS, et pourquoi :
 *
 * · **Gonfler `limit`** — il est plafonné à 50 côté serveur, et refaire la
 *   requête entière à chaque clic rejoue tout le fil déjà lu.
 * · **Défilement infini** — cet écran porte une barre basse flottante et une
 *   réserve `pb-mobile-nav-md`. Un fil qui repousse indéfiniment son pied rend
 *   ce pied inatteignable, et l'ajout automatique déplace le contexte de
 *   lecture (WCAG 2.4.5 et 3.2.5).
 *
 * Ce qu'on fait : une CHAÎNE DE PAGES MONTÉES. `myFeed` n'est pas une query
 * `paginationOpts`, donc `usePaginatedQuery` ne s'applique pas. Chaque page est
 * un composant portant SON propre curseur et SON propre abonnement — les hooks
 * restent hors de toute boucle conditionnelle, et chaque page garde le temps
 * réel.
 *
 * Ce module ne connaît ni React ni Convex : il ne tient que la liste des
 * curseurs montés et ce qu'on a le droit d'en déduire. Aucune phrase n'y est
 * écrite : l'annonce reçoit `t` et n'emploie que des clés qualifiées.
 */

import type { TFunction } from "i18next"

/**
 * Curseur stable d'une page. Le couple instant + identifiant garde les
 * publications créées dans la même milliseconde, contrairement à l'ancien
 * curseur numérique. `null` = la première page.
 */
export type FeedCursor<TPostId extends string = string> = {
  publishedAt: number
  postId: TPostId
  strategy?: "legacy" | "materialized"
  generation?: number
  windowStart?: number
  postCreationTime?: number
}

export function feedCursorKey<TPostId extends string>(
  cursor: FeedCursor<TPostId> | null,
): string {
  if (cursor === null) return "first"
  const anchor = `${cursor.publishedAt}:${cursor.postId}`
  // Les murs anciens conservent leur clé ; une génération du fil ne peut réutiliser cette frontière.
  return cursor.strategy === undefined ? anchor : `${anchor}:${cursor.strategy}:${cursor.generation ?? ""}:${cursor.windowStart ?? ""}:${cursor.postCreationTime ?? ""}`
}

export interface FeedPagesState<TCursor = FeedCursor> {
  /** Les pages MONTÉES, dans l'ordre. Toujours au moins la première. */
  cursors: (TCursor | null)[]
  /**
   * La dernière page a-t-elle annoncé qu'il n'y a plus rien derrière ?
   * `false` tant qu'elle n'a pas répondu — on ne conclut pas d'un silence.
   */
  exhausted: boolean
}

export function initialFeedPages<TCursor = FeedCursor>(): FeedPagesState<TCursor> {
  return { cursors: [null], exhausted: false }
}

/**
 * Enregistre ce que la DERNIÈRE page a répondu.
 *
 * `nextCursor === null` signifie « plus rien derrière » : la chaîne est close.
 * Sinon on retient le curseur, sans monter la page — la monter ici ferait du
 * chargement automatique, c'est-à-dire le défilement infini qu'on a écarté.
 */
export function recordTail<TCursor>(
  state: FeedPagesState<TCursor>,
  nextCursor: TCursor | null,
): FeedPagesState<TCursor> {
  if (nextCursor === null) {
    return state.exhausted ? state : { ...state, exhausted: true }
  }
  return state.exhausted ? { ...state, exhausted: false } : state
}

/**
 * Monte la page suivante — le geste explicite de « Voir plus ».
 *
 * Idempotent sur un curseur déjà monté : un double-clic, ou un rendu rejoué,
 * ne doit pas afficher deux fois la même page. C'est le seul endroit où la
 * liste grandit.
 */
export function appendPage<TCursor>(
  state: FeedPagesState<TCursor>,
  nextCursor: TCursor | null,
): FeedPagesState<TCursor> {
  if (nextCursor === null) return { ...state, exhausted: true }
  if (
    state.cursors.some(
      (cursor) => JSON.stringify(cursor) === JSON.stringify(nextCursor),
    )
  ) return state
  return { cursors: [...state.cursors, nextCursor], exhausted: false }
}

/**
 * Réaligne les pages déjà montées quand une page AMONT change de frontière.
 *
 * Une souscription temps réel peut recevoir une nouvelle publication en tête :
 * sa dernière ligne se décale alors, mais la page suivante reste encore
 * montée avec l'ancien curseur. La conserver créerait un trou (ou un doublon)
 * entre les deux pages. On remplace donc cette frontière et on abandonne les
 * pages plus profondes, qui pourront être redemandées explicitement.
 *
 * `pageIndex` ne peut désigner que la page qui précède une page déjà montée.
 * La dernière page publie son curseur via `recordTail`, pas ici.
 */
export function rebasePagesAfter<TCursor>(
  state: FeedPagesState<TCursor>,
  pageIndex: number,
  nextCursor: TCursor | null,
): FeedPagesState<TCursor> {
  if (pageIndex < 0 || pageIndex >= state.cursors.length - 1) return state

  const mountedNext = state.cursors[pageIndex + 1] ?? null
  if (JSON.stringify(mountedNext) === JSON.stringify(nextCursor)) return state

  const prefix = state.cursors.slice(0, pageIndex + 1)
  if (nextCursor === null) {
    return { cursors: prefix, exhausted: true }
  }
  return { cursors: [...prefix, nextCursor], exhausted: false }
}

/**
 * Le bouton « Voir plus » a-t-il lieu d'être ?
 *
 * Il exige un curseur RÉEL : tant que la dernière page n'a pas répondu, on ne
 * propose pas une suite dont on ignore l'existence. Proposer puis retirer
 * serait pire que d'attendre.
 */
export function shouldShowLoadMore<TCursor>(
  state: FeedPagesState<TCursor>,
  tailCursor: TCursor | null,
): boolean {
  if (state.exhausted) return false
  if (tailCursor === null) return false
  return !state.cursors.some(
    (cursor) => JSON.stringify(cursor) === JSON.stringify(tailCursor),
  )
}

/** Nombre de pages montées — une page de plus est un abonnement de plus. */
export function mountedPageCount<TCursor>(state: FeedPagesState<TCursor>): number {
  return state.cursors.length
}

/**
 * Ce qu'on annonce à voix haute après un « Voir plus ».
 *
 * Un bouton qui ajoute du contenu SOUS lui ne dit rien à qui ne voit pas
 * l'écran : la région vivante porte le résultat, pas l'intention.
 */
export function loadMoreAnnouncement(added: number, t: TFunction): string {
  if (added <= 0) return t("reseau:reseauFeedPages.loadMore.none")
  return t("reseau:reseauFeedPages.loadMore.added", { count: added })
}
