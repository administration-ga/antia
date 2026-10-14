// Dupliqué de socle/convex/modules/reseauPersonnel/searchText.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle ; commentaires d'origine conservés).
/**
 * Normalisation du texte de RECHERCHE — module isolé, sans dépendance.
 *
 * Adapté de PRO_GA (`packages/pro-domain/src/search-text.ts`), où il sert
 * l'annuaire public ET le fil personnel. Ici il ne sert que le fil, mais il
 * reste séparé du domaine : le jour où l'annuaire institutionnel voudra le
 * même repli, un repli qui divergerait ferait qu'une recherche marche d'un
 * côté et pas de l'autre.
 */

/**
 * Replie les diacritiques : « Ménagère » → « menagere ».
 *
 * POURQUOI. L'index plein-texte de Convex compare des jetons littéraux : sans
 * repli, `menagere` ne trouve pas `Ménagère`. Au Gabon — où l'on tape
 * couramment sans accents, et où les claviers mobiles les posent au hasard —
 * c'est la moitié des requêtes qui ne rendraient rien.
 *
 * COMMENT. `NFD` sépare la lettre de son signe (« é » → « e » + U+0301), et la
 * plage des diacritiques combinants retire les signes. Le « ß », le « œ » et
 * le « æ » ne sont PAS des lettres accentuées et survivent intacts — c'est
 * correct : ce sont des lettres à part entière, pas des variantes.
 */
export function foldDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/**
 * Le texte à INDEXER : l'original ET son repli, séparés d'une espace.
 *
 * Garder les deux formes permet à « Ménagère » ET à « menagere » de trouver la
 * même publication, sans changer le `searchField` de l'index — donc SANS
 * nouvelle version d'index (un `searchIndex` Convex ne se modifie jamais en
 * place ; seul son CONTENU peut changer). Le doublon ne coûte que du volume.
 *
 * Le repli n'est ajouté que s'il diffère : un texte sans accent ne se duplique
 * pas pour rien.
 */
export function buildSearchableText(
  ...parts: readonly (string | undefined | null)[]
): string {
  const original = parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .trim()
  if (original.length === 0) return ""
  const folded = foldDiacritics(original)
  return folded === original.toLowerCase() ? original : `${original} ${folded}`
}

/**
 * Le terme à CHERCHER : replié, pour rencontrer la moitié repliée de l'index.
 *
 * ⚠️ Toujours appeler ceci sur la requête utilisateur, sinon le repli du
 * contenu ne sert à rien — « Ménagère » tapé accentué ne rencontrerait que la
 * moitié accentuée (ce qui marchait déjà), et « menagere » ne trouverait
 * toujours rien.
 */
export function foldSearchQuery(query: string): string {
  return foldDiacritics(query).trim()
}
