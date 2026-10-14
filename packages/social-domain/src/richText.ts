// Dupliqué de socle/convex/modules/reseauPersonnel/domain.ts (l. 664-754 et 939-988) @ ad2e7fdc2 — adaptations : hashtags, mentions et découpage riche réunis dans leur propre module (même code, mêmes motifs).
/**
 * Le texte RICHE d'une publication : hashtags, mentions, et le découpage en
 * segments qui permet de les rendre cliquables SANS jamais interpréter de
 * balisage.
 */

// ═══════════════════════════════════════════════════════════════
// Hashtags
// ═══════════════════════════════════════════════════════════════

export const HASHTAG_MAX_PER_POST = 10
/** Lettres (accents compris), chiffres, tiret bas — 2 à 30 caractères. */
const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,30})/gu

/**
 * Les hashtags d'un corps, en minuscules, uniques, plafonnés. Dénormalisés sur
 * la ligne AU MOMENT DE LA PUBLICATION — jamais recalculés en lecture.
 */
export function extractHashtags(body: string): string[] {
  const seen = new Set<string>()
  for (const match of body.matchAll(HASHTAG_PATTERN)) {
    const tag = (match[1] ?? "").toLowerCase()
    if (tag.length === 0) continue
    seen.add(tag)
    if (seen.size >= HASHTAG_MAX_PER_POST) break
  }
  return [...seen]
}

// ═══════════════════════════════════════════════════════════════
// Mentions
// ═══════════════════════════════════════════════════════════════

export const MENTION_MAX_PER_POST = 10

/**
 * Le cœur d'un handle cité — la MÊME forme que `assertHandle` : 3 à 30
 * caractères, minuscules, chiffres, point, tiret ou souligné, jamais un
 * séparateur aux extrémités. Une divergence entre les deux ne peut que faire
 * MANQUER une mention, jamais en inventer une.
 */
const MENTION_CORE = "[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]"

/**
 * Ce qui garde une mention d'être une adresse électronique : le « @ » ne compte
 * QUE s'il n'est précédé ni d'une lettre, ni d'un chiffre, ni de « _ », « - »,
 * « . » ou d'un autre « @ ». « contact@exemple.ga » ne cite donc personne.
 */
const MENTION_LOOKBEHIND = "(?<![\\p{L}\\p{N}_@.-])"

/**
 * Et ce qui l'empêche de MORDRE : un handle de 45 caractères n'est pas un
 * handle. ⚠️ Ni le tiret ni le point ne figurent dans cette classe : « @nadia. »
 * doit citer `nadia`. Le cas est verrouillé par test.
 */
const MENTION_LOOKAHEAD = "(?![a-z0-9])"

const MENTION_PATTERN = new RegExp(`${MENTION_LOOKBEHIND}@(${MENTION_CORE})${MENTION_LOOKAHEAD}`, "giu")

/**
 * Les handles cités dans un corps — minuscules, uniques, plafonnés. Ce n'est
 * qu'un PARSING : le serveur résout ensuite chaque handle contre les profils
 * PUBLIÉS et n'en notifie que ceux qui voient déjà la publication — citer
 * quelqu'un ne lui ouvre JAMAIS une porte.
 */
export function extractMentionHandles(body: string): string[] {
  const seen = new Set<string>()
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const handle = (match[1] ?? "").toLowerCase()
    if (handle.length === 0) continue
    seen.add(handle)
    if (seen.size >= MENTION_MAX_PER_POST) break
  }
  return [...seen]
}

// ═══════════════════════════════════════════════════════════════
// Découpage riche du corps
// ═══════════════════════════════════════════════════════════════

export type PostBodySegment = { type: "text"; value: string } | { type: "tag"; value: string } | { type: "mention"; value: string }

/**
 * Le motif COMBINÉ — une seule passe, donc un seul ordre de segments. Les deux
 * alternatives ne peuvent pas se chevaucher (« # » contre « @ »).
 */
const RICH_PATTERN = new RegExp(
  `#(?<tag>[\\p{L}\\p{N}_]{2,30})|${MENTION_LOOKBEHIND}@(?<mention>${MENTION_CORE})${MENTION_LOOKAHEAD}`,
  "giu",
)

/**
 * Découpe un corps en segments texte / hashtag / mention, pour un rendu SANS
 * HTML : l'écran mappe les segments sur des nœuds React, aucun balisage n'est
 * jamais interprété. La reconstruction est FIDÈLE (à la casse des tags et
 * mentions près) : un test le vérifie.
 */
export function splitBodyRich(body: string): PostBodySegment[] {
  const segments: PostBodySegment[] = []
  let cursor = 0
  for (const match of body.matchAll(RICH_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: "text", value: body.slice(cursor, index) })
    const tag = match.groups?.tag
    const mention = match.groups?.mention
    if (tag !== undefined) segments.push({ type: "tag", value: tag.toLowerCase() })
    else if (mention !== undefined) segments.push({ type: "mention", value: mention.toLowerCase() })
    cursor = index + match[0].length
  }
  if (cursor < body.length) segments.push({ type: "text", value: body.slice(cursor) })
  return segments
}
