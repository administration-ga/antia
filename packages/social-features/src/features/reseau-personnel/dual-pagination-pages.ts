// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/dual-pagination-pages.ts @ ad2e7fdc2 — adaptations : code inchangé ; en-tête rapporté au moteur (un seul graphe par réseau : `graph.connections.paginateMine` pagine les deux côtés, `paginatePendingForMe` un seul index, présenté au hook avec un côté haut toujours épuisé).
/**
 * dual-pagination-pages — la chaîne de pages des relations, décidée hors
 * composant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX CURSEURS PAR PAGE, ET DES PAGES QUI NE SONT PAS TOUTES VIVANTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une relation est rangée d'un côté de la paire canonique (`low`/`high`) :
 * `graph.connections.paginateMine` pagine les deux côtés à la fois, chacun avec
 * SON curseur natif. Une page est donc désignée par un COUPLE de curseurs, et sa
 * suite par le couple de continuation qu'elle annonce.
 *
 * Les demandes REÇUES (`graph.connections.paginatePendingForMe`) ne paginent
 * qu'un index — celui du destinataire. Le hook les présente comme une paire dont
 * le côté haut est toujours épuisé : la même chaîne, les mêmes règles de
 * réalignement, sans un second mécanisme à tenir d'accord.
 *
 * `use-dual-connection-pagination.ts` n'abonne que DEUX pages : la PREMIÈRE
 * (curseurs nuls), toujours, et la page COURANTE — la dernière demandée. Les
 * pages intermédiaires sont des INSTANTANÉS : rien ne les rafraîchit. Tant que
 * la chaîne reste contiguë, c'est sans conséquence. Elle cesse de l'être dès
 * qu'une relation entre dans la première page ou en sort (invitation reçue,
 * acceptée ou retirée ailleurs) : la première page se décale, sa frontière
 * avec la suivante bouge, et les instantanés plus profonds décrivent une
 * chaîne qui n'existe plus — une ligne poussée hors de la première page ne
 * figurait plus nulle part, une ligne retirée survivait, figée, jusqu'au
 * démontage.
 *
 * La règle est celle du fil (`reseau-feed-pages.ts`, `rebasePagesAfter`) :
 * dès que la continuation annoncée par la première page — toujours vivante —
 * diffère de la page montée derrière elle, les pages plus profondes sont
 * abandonnées et la chaîne repart de la nouvelle frontière. Le chargement
 * automatique la reparcourt ; ailleurs, « Voir plus » la redemande.
 *
 * ⚠️ Ce que cette règle ne voit PAS : un retrait à l'intérieur d'une page
 * intermédiaire, quand la première page n'a pas bougé. Aucune page vivante ne
 * le reflète — ni la première, dont la frontière est intacte, ni la courante,
 * dont le curseur de départ est une POSITION et non un rang. Il se résorbe au
 * prochain décalage de la première page ou au remontage.
 *
 * `remove()` reste un masquage OPTIMISTE et immédiat : la relation sort, au
 * geste, de toutes les pages reçues, sans attendre le serveur. Une page
 * VIVANTE qui la rendrait encore l'y remettrait : c'est le serveur qui a
 * raison.
 *
 * Ce module ne connaît ni React ni Convex. Fonctions PURES : chacune rend un
 * nouvel état, ou LA MÊME RÉFÉRENCE quand rien ne change.
 */

/** Le couple de curseurs natifs d'une page ; `null` = le début d'un côté. */
export interface DualCursors {
  readonly low: string | null
  readonly high: string | null
}

/** La première page : les deux côtés depuis leur début. */
export const FIRST_DUAL_CURSORS: DualCursors = Object.freeze({
  low: null,
  high: null,
})

export function isFirstDualCursors(cursors: DualCursors): boolean {
  return cursors.low === null && cursors.high === null
}

/** Clé stable d'une page — celle sous laquelle ses lignes sont rangées. */
export function dualCursorsKey(cursors: DualCursors): string {
  return `${cursors.low ?? "start"}|${cursors.high ?? "start"}`
}

function sameDualCursors(
  left: DualCursors | null,
  right: DualCursors | null,
): boolean {
  if (left === null || right === null) return left === right
  return left.low === right.low && left.high === right.high
}

/** Un côté de la paire, tel que le rend `paginate()`. */
export interface DualSide<T> {
  readonly page: readonly T[]
  readonly isDone: boolean
  readonly continueCursor: string
}

/** Une page : ses deux côtés. */
export interface DualPageData<T> {
  readonly low: DualSide<T>
  readonly high: DualSide<T>
}

/**
 * La suite annoncée par une page : son couple de continuation, ou `null`
 * quand ses DEUX côtés sont épuisés. Un côté épuisé garde son curseur de fin :
 * la page suivante le reçoit tel quel et y rend une page vide.
 */
export function dualContinuation<T>(data: DualPageData<T>): DualCursors | null {
  if (data.low.isDone && data.high.isDone) return null
  return { low: data.low.continueCursor, high: data.high.continueCursor }
}

export interface DualPagesState<T> {
  /** Les pages MONTÉES, dans l'ordre de la chaîne. Toujours au moins la première. */
  readonly cursors: readonly DualCursors[]
  /**
   * Ce que chaque page montée a rendu, par clé (`dualCursorsKey`),
   * dédoublonné par relation. Absente = la page n'a pas encore répondu.
   */
  readonly rows: Readonly<Record<string, readonly T[]>>
}

export function initialDualPages<T>(): DualPagesState<T> {
  return { cursors: [FIRST_DUAL_CURSORS], rows: {} }
}

/** La page que l'on suit — la dernière montée, abonnée avec la première. */
export function currentDualCursors<T>(state: DualPagesState<T>): DualCursors {
  return state.cursors[state.cursors.length - 1] ?? FIRST_DUAL_CURSORS
}

/** Au moins une page a-t-elle répondu ? */
export function dualPagesLoaded<T>(state: DualPagesState<T>): boolean {
  return Object.keys(state.rows).length > 0
}

type Identified = { connectionId: unknown }

function rowKey(row: Identified): string {
  return String(row.connectionId)
}

/**
 * Enregistre ce qu'une page MONTÉE vient de rendre.
 *
 * Une réponse arrivée pour une page qui n'est plus montée (la chaîne a été
 * réalignée entre-temps) est ignorée : la réinscrire ressusciterait
 * précisément l'instantané qu'on vient d'abandonner.
 *
 * La PREMIÈRE page réaligne ensuite la chaîne sur la suite qu'elle annonce
 * (`rebaseDualPages`) : c'est la seule page vivante qui en précède d'autres,
 * donc la seule qui puisse dire que la chaîne a bougé.
 */
export function recordDualPage<T extends Identified>(
  state: DualPagesState<T>,
  cursors: DualCursors,
  data: DualPageData<T>,
): DualPagesState<T> {
  const key = dualCursorsKey(cursors)
  if (!state.cursors.some((mounted) => dualCursorsKey(mounted) === key)) {
    return state
  }
  const unique = new Map<string, T>()
  for (const row of [...data.low.page, ...data.high.page]) {
    unique.set(rowKey(row), row)
  }
  const recorded: DualPagesState<T> = {
    ...state,
    rows: { ...state.rows, [key]: [...unique.values()] },
  }
  return isFirstDualCursors(cursors)
    ? rebaseDualPages(recorded, dualContinuation(data))
    : recorded
}

/**
 * Réaligne la chaîne quand la PREMIÈRE page annonce une autre suite que la
 * page montée derrière elle : cette frontière est remplacée par la nouvelle,
 * les pages plus profondes et leurs lignes sont abandonnées. Une première
 * page désormais épuisée (`null`) referme la chaîne sur elle seule.
 *
 * Rien à faire tant qu'aucune page n'est montée derrière la première : sa
 * suite n'est encore qu'une promesse, que `appendDualPage` tiendra au geste.
 */
export function rebaseDualPages<T>(
  state: DualPagesState<T>,
  firstNext: DualCursors | null,
): DualPagesState<T> {
  if (state.cursors.length < 2) return state
  if (sameDualCursors(state.cursors[1] ?? null, firstNext)) return state
  const firstKey = dualCursorsKey(FIRST_DUAL_CURSORS)
  const firstRows = state.rows[firstKey]
  return {
    cursors:
      firstNext === null
        ? [FIRST_DUAL_CURSORS]
        : [FIRST_DUAL_CURSORS, firstNext],
    rows: firstRows === undefined ? {} : { [firstKey]: firstRows },
  }
}

/**
 * Monte la page suivante — « Voir plus », ou le chargement automatique.
 *
 * `after` est la page dont on a lu la suite. Si elle n'est plus la dernière
 * montée (la chaîne a été réalignée entre le rendu et le geste), le geste est
 * périmé et ignoré : la suite d'une page abandonnée n'a rien à faire au bout
 * de la nouvelle chaîne. Idempotent sur une page déjà montée : un double-clic
 * ne monte pas deux fois la même page.
 */
export function appendDualPage<T>(
  state: DualPagesState<T>,
  after: DualCursors,
  next: DualCursors | null,
): DualPagesState<T> {
  if (next === null) return state
  if (!sameDualCursors(currentDualCursors(state), after)) return state
  if (state.cursors.some((mounted) => sameDualCursors(mounted, next))) {
    return state
  }
  return { ...state, cursors: [...state.cursors, next] }
}

/**
 * Masque OPTIMISTE : la relation sort, au geste, de toutes les pages reçues.
 * Même référence quand elle n'y figurait pas.
 */
export function removeDualRow<T extends Identified>(
  state: DualPagesState<T>,
  connectionId: unknown,
): DualPagesState<T> {
  const key = String(connectionId)
  let changed = false
  const rows: Record<string, readonly T[]> = {}
  for (const [pageKey, pageRows] of Object.entries(state.rows)) {
    const kept = pageRows.filter((row) => rowKey(row) !== key)
    if (kept.length === pageRows.length) {
      rows[pageKey] = pageRows
    } else {
      rows[pageKey] = kept
      changed = true
    }
  }
  return changed ? { ...state, rows } : state
}

/**
 * Les relations à afficher : l'union des pages reçues, dédoublonnée par
 * relation, de la plus récente à la plus ancienne.
 *
 * Une relation vue deux fois garde la version d'une page VIVANTE : les pages
 * profondes sont lues dans l'ordre de la chaîne — les instantanés
 * intermédiaires, puis la page courante, qui la termine —, la première en
 * dernier. La dernière lecture l'emporte.
 */
export function mergeDualRows<T extends Identified>(
  state: DualPagesState<T>,
  timestamp: (row: T) => number,
): T[] {
  const order = [...state.cursors.slice(1), FIRST_DUAL_CURSORS]
  const unique = new Map<string, T>()
  for (const cursors of order) {
    for (const row of state.rows[dualCursorsKey(cursors)] ?? []) {
      unique.set(rowKey(row), row)
    }
  }
  return [...unique.values()].sort(
    (left, right) => timestamp(right) - timestamp(left),
  )
}
