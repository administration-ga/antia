// Dupliqué de socle/convex/modules/reseauPersonnel/feedScale.ts @ ad2e7fdc2 — adaptations : `Id<…>` du schéma généré remplacé par des identifiants génériques (`extends string`) : un `Id<"posts">` ou un `Id<"persons">` du moteur s'y passe tel quel, et le domaine reste pur.
/**
 * Les primitives pures du fil : elles gardent le choix de pagination et le
 * signal de lacune vérifiables sans Convex. Un résultat candidat ne porte
 * jamais un droit : la garde `feedAdmissionFor` reste appelée après la fusion.
 */

export type PersonalFeedCursor<PostId extends string = string> = {
  publishedAt: number
  postId: PostId
  /** Absents sur les anciens curseurs et les murs ; aucune bascule en cours de parcours. */
  strategy?: "legacy" | "materialized"
  generation?: number
  windowStart?: number
  postCreationTime?: number
}

/** Historique explicite : la matérialisation ne promet jamais l'antériorité. */
export const MATERIALIZED_FEED_HISTORY_MS = 30 * 86_400_000
export const MATERIALIZED_FEED_BATCH = 20
export const MATERIALIZED_FEED_SCAN = 100
export const MATERIALIZED_FEED_REBUILD_MS = 24 * 60 * 60_000

export function shouldMaterializeFeed(input: { personSources: number; pageSources: number; truncated: boolean }): boolean {
  return input.truncated || input.personSources + input.pageSources > PERSONAL_FEED_AUTHORS_MAX || input.pageSources > 50
}

/** Une génération incomplète ou remplacée n'est jamais une continuation silencieuse. */
export function materializedCursorMatches(cursor: PersonalFeedCursor | undefined, state: { generation: number; windowStart: number; status: string } | null): boolean {
  return state !== null && state.status === "ready" && (cursor === undefined || (cursor.strategy === "materialized" && cursor.generation === state.generation && cursor.windowStart === state.windowStart && Number.isFinite(cursor.postCreationTime)))
}

type OrderedPost<PostId extends string = string> = {
  _id: PostId
  _creationTime: number
  publishedAt: number
}

/**
 * Borne assumée du palier « éventail à la lecture ».
 *
 * Elle ne promet PAS un fil exhaustif au-delà : soi + 199 liens déterministes
 * sont interrogés, les liens supplémentaires restent hors de toutes les pages.
 * Monter ce plafond augmente directement le nombre de lectures par requête ;
 * l'exhaustivité demanderait un fil matérialisé, pas une constante plus haute.
 */
export const PERSONAL_FEED_AUTHORS_MAX = 200

/**
 * Choisit les sources bornées sans jamais évincer le lecteur de son propre fil.
 * Les autres identifiants gardent l'ordre déterministe historique.
 */
export function boundedFeedSourceIds<PersonId extends string>(input: {
  selfId: PersonId
  connections: Iterable<string>
  follows: Iterable<string>
  max?: number
}): PersonId[] {
  const max = Math.max(0, Math.trunc(input.max ?? PERSONAL_FEED_AUTHORS_MAX))
  if (max === 0) return []

  const self = String(input.selfId)
  const others = new Set([...input.connections, ...input.follows])
  others.delete(self)
  return [self, ...Array.from(others).sort().slice(0, max - 1)] as PersonId[]
}

/**
 * Ordre stable décroissant identique à celui de l'index Convex :
 * `publishedAt`, puis son tie-breaker implicite `_creationTime`.
 * `_id` ne sert que de dernier repli défensif si deux fixtures fabriquent la
 * même heure de création.
 */
export function compareFeedPosts<PostId extends string>(left: OrderedPost<PostId>, right: OrderedPost<PostId>): number {
  if (left.publishedAt !== right.publishedAt) return right.publishedAt - left.publishedAt
  if (left._creationTime !== right._creationTime) return right._creationTime - left._creationTime
  const leftId = String(left._id)
  const rightId = String(right._id)
  return leftId === rightId ? 0 : leftId < rightId ? 1 : -1
}

/**
 * Une ligne est-elle strictement derrière le curseur composite ?
 *
 * Le curseur public reste (`publishedAt` + `postId`). Le serveur relit ce post
 * pour retrouver `_creationTime`, qui est le véritable tie-breaker de l'index.
 * Sans cette résolution (curseur forgé ou post absent), le repli par
 * identifiant conserve le comportement historique.
 */
export function isAfterFeedCursor<PostId extends string>(
  post: OrderedPost<PostId>,
  cursor: PersonalFeedCursor<PostId>,
  cursorCreationTime?: number,
): boolean {
  if (post.publishedAt !== cursor.publishedAt) {
    return post.publishedAt < cursor.publishedAt
  }
  if (cursorCreationTime !== undefined && post._creationTime !== cursorCreationTime) {
    return post._creationTime < cursorCreationTime
  }
  return String(post._id) < String(cursor.postId)
}

export function cursorForFeedPost<PostId extends string>(post: OrderedPost<PostId>): PersonalFeedCursor<PostId> {
  return { publishedAt: post.publishedAt, postId: post._id }
}

/**
 * Signal déjà disponible dans le chemin de lecture : aucune seconde lecture,
 * aucun recomptage. La bascule d'un éventail à l'écriture reste interdite sans
 * mesure.
 */
export function isLacunarFeedWindow(input: {
  candidatesLength: number
  scanLimit: number
  selectedLength: number
  pageLimit: number
}): boolean {
  return input.candidatesLength === input.scanLimit && input.selectedLength < input.pageLimit
}

export function exceedsLacunaThreshold(input: { reads: number; lacunaryReads: number }): boolean {
  return input.reads > 0 && input.lacunaryReads / input.reads > 0.05
}

/**
 * FUSIONNE des fenêtres bornées (une par auteur, une par voie) sans jamais
 * ouvrir de trou. Une fenêtre PLEINE n'a rien dit de ce qui est plus ancien que
 * sa dernière ligne : la plus récente de ces dernières lignes est la FRONTIÈRE,
 * et rien de plus ancien ne s'examine dans cette page — la suivante reprendra
 * de là, chaque fenêtre derrière le même curseur. Doublons écartés.
 */
export function mergeFeedWindows<PostId extends string, Post extends OrderedPost<PostId>>(windows: readonly { rows: readonly Post[]; wasFull: boolean }[]): { rows: Post[]; wasFull: boolean } {
  const seen = new Set<string>()
  const rows: Post[] = []
  for (const window of windows) {
    for (const row of window.rows) {
      if (seen.has(String(row._id))) continue
      seen.add(String(row._id))
      rows.push(row)
    }
  }
  rows.sort(compareFeedPosts)
  let frontier: Post | null = null
  for (const window of windows) {
    const last = window.wasFull ? window.rows.at(-1) : undefined
    if (last !== undefined && (frontier === null || compareFeedPosts(last, frontier) < 0)) frontier = last
  }
  if (frontier === null) return { rows, wasFull: false }
  const cut = frontier
  return { rows: rows.filter((row) => compareFeedPosts(row, cut) <= 0), wasFull: true }
}

