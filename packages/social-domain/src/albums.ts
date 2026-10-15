// Dupliqué de socle/convex/modules/reseauAlbums/domain.ts @ ad2e7fdc2 — adaptations : refus à CODE de règle (`DomainViolation` et ses bornes) au lieu de `ReseauAlbumsViolation` et de ses phrases — le libellé « 20 Mo » devient le paramètre `maxMb` ; constantes des publications importées du domaine du moteur (`./content`) ; aucune autre adaptation (tel quel). Le backend ne laisse plus de tombe (une photo retirée est purgée, D09) : `ALBUM_ITEMS_SCAN_MAX` reste la borne dure de lecture.
/**
 * Le DOMAINE des albums — pur, sans `ctx`, sans base, testé en `node`.
 *
 * Tout ce qui se décide sans lire la base vit ici : les bornes, les refus de
 * forme, la matrice de visibilité, le réordonnancement. La garde
 * (`access.ts`) et l'API (`albums.ts`) n'ont plus qu'à appliquer.
 *
 * ⚠️ Aucun littéral de plafond ailleurs que dans ce fichier : le plan exige un
 * plafond CONFIGURABLE, et un nombre recopié dans trois écrans est un plafond
 * qu'on ne peut plus relever.
 */
import { type PersonalReachAudience, POST_IMAGE_MAX_BYTES, POST_IMAGE_MIME_TYPES, POST_MEDIA_ALT_MAX_LENGTH } from "./content"
import { DomainViolation, megabytes } from "./violation"

// ═══════════════════════════════════════════════════════════════
// Bornes — le plafond produit, en UN endroit
// ═══════════════════════════════════════════════════════════════

/**
 * Combien de photos dans un album. 60, pas 4 : le plan interdit explicitement
 * de reprendre la limite de la publication comme modèle d'album.
 *
 * Cette borne est aussi la borne de LECTURE : `getAlbum` sert la galerie
 * entière par un `.take(ALBUM_ITEMS_MAX)`, donc la relever relève les deux
 * ensemble — ce qui est voulu, et ce qui oblige à mesurer avant de le faire.
 */
export const ALBUM_ITEMS_MAX = 60

/**
 * La FENÊTRE de lecture des éléments d'un album — plus large que le plafond,
 * et bornée dur.
 *
 * Une photo retirée laisse sa ligne (le blob n'est pas purgé, `tables.ts`).
 * Lire exactement `ALBUM_ITEMS_MAX` ferait donc disparaître des photos VIVANTES
 * derrière les tombes dès la première suppression. Quatre fois le plafond
 * couvre 180 retraits sur un album de 60 : au-delà, la galerie se tronque —
 * consciemment, plutôt que d'ouvrir une lecture non bornée.
 */
export const ALBUM_ITEMS_SCAN_MAX = ALBUM_ITEMS_MAX * 4

/** Combien d'éléments un seul appel `addItems` accepte — la reprise fait le reste. */
export const ALBUM_ADD_BATCH_MAX = 12

export const ALBUM_TITLE_MAX = 120
export const ALBUM_DESCRIPTION_MAX = 600
export const ALBUM_CAPTION_MAX = 300
/** Le texte alternatif suit la règle du fil — une seule longueur dans l'espace. */
export const ALBUM_ALT_TEXT_MAX = POST_MEDIA_ALT_MAX_LENGTH

/** Plafond d'une page de liste — une lecture bornée, jamais une page ouverte. */
export const ALBUM_PAGE_MAX = 24

/** Les formats d'image acceptés — ceux du fil, pas une seconde liste. */
export const ALBUM_IMAGE_MIME_TYPES = POST_IMAGE_MIME_TYPES
export const ALBUM_IMAGE_MAX_BYTES = POST_IMAGE_MAX_BYTES

// ═══════════════════════════════════════════════════════════════
// États et audiences
// ═══════════════════════════════════════════════════════════════

/**
 * Les trois états d'un album.
 *
 * ⚠️ Cette liste DOIT rester le miroir exact d'`albumStatusValidator`
 * (`validators.ts`) : le validateur décide ce que la base accepte, cette
 * constante décide ce que le code sait traiter.
 */
export const ALBUM_STATUSES = ["draft", "published", "withdrawn"] as const
export type AlbumStatus = (typeof ALBUM_STATUSES)[number]

/**
 * L'audience d'un album — les DEUX portées du réseau personnel, et rien de
 * plus (ADR-0145 §2). Pas de `group`, pas de `page`, pas d'« Internet ».
 */
export type AlbumAudience = PersonalReachAudience

// ═══════════════════════════════════════════════════════════════
// Refus de forme
// ═══════════════════════════════════════════════════════════════

/** Le titre : obligatoire, borné. Rendu NETTOYÉ — c'est lui qui sera écrit. */
export function assertAlbumTitle(raw: string): string {
  const title = raw.trim()
  if (title.length === 0) {
    throw new DomainViolation("ALBUM_TITLE_REQUIRED")
  }
  if (title.length > ALBUM_TITLE_MAX) {
    throw new DomainViolation("ALBUM_TITLE_TOO_LONG", { max: ALBUM_TITLE_MAX })
  }
  return title
}

/** La description : facultative. Une chaîne d'espaces vaut ABSENCE. */
export function assertAlbumDescription(raw?: string): string | undefined {
  const description = (raw ?? "").trim()
  if (description.length === 0) return undefined
  if (description.length > ALBUM_DESCRIPTION_MAX) {
    throw new DomainViolation("ALBUM_DESCRIPTION_TOO_LONG", { max: ALBUM_DESCRIPTION_MAX })
  }
  return description
}

/** La légende d'une photo : facultative, bornée. */
export function assertAlbumCaption(raw?: string): string | undefined {
  const caption = (raw ?? "").trim()
  if (caption.length === 0) return undefined
  if (caption.length > ALBUM_CAPTION_MAX) {
    throw new DomainViolation("ALBUM_CAPTION_TOO_LONG", { max: ALBUM_CAPTION_MAX })
  }
  return caption
}

/** Le texte alternatif : facultatif, borné comme au fil. */
export function assertAlbumAltText(raw?: string): string | undefined {
  const altText = (raw ?? "").trim()
  if (altText.length === 0) return undefined
  if (altText.length > ALBUM_ALT_TEXT_MAX) {
    throw new DomainViolation("ALBUM_ALT_TOO_LONG", { max: ALBUM_ALT_TEXT_MAX })
  }
  return altText
}

export type AlbumMediaInput = {
  mimeType: string
  sizeBytes: number
}

/**
 * Les photos d'un lot, ensemble.
 *
 * IMAGES SEULEMENT en V1 : une vidéo dans une galerie change ce qu'on regarde
 * (et son poids ferait d'un album un téléchargement). Le genre n'est donc même
 * pas un paramètre — l'album ne connaît que l'image.
 */
export function assertAlbumMedia(media: readonly AlbumMediaInput[]): void {
  if (media.length === 0) {
    throw new DomainViolation("ALBUM_ITEMS_EMPTY")
  }
  if (media.length > ALBUM_ADD_BATCH_MAX) {
    throw new DomainViolation("ALBUM_BATCH_TOO_LARGE", { max: ALBUM_ADD_BATCH_MAX })
  }
  for (const item of media) {
    if (!(ALBUM_IMAGE_MIME_TYPES as readonly string[]).includes(item.mimeType)) {
      throw new DomainViolation("ALBUM_MEDIA_MIME_INVALID")
    }
    if (item.sizeBytes <= 0 || item.sizeBytes > ALBUM_IMAGE_MAX_BYTES) {
      throw new DomainViolation("ALBUM_MEDIA_TOO_LARGE", { maxMb: megabytes(ALBUM_IMAGE_MAX_BYTES) })
    }
  }
}

/** Le plafond de l'album, une fois le lot ajouté. */
export function assertAlbumCapacity(input: {
  current: number
  adding: number
}): void {
  if (input.current + input.adding > ALBUM_ITEMS_MAX) {
    throw new DomainViolation("ALBUM_FULL", { max: ALBUM_ITEMS_MAX })
  }
}

// ═══════════════════════════════════════════════════════════════
// Visibilité — LA règle, pure, évaluée à chaque lecture
// ═══════════════════════════════════════════════════════════════

export type AlbumReadContext = {
  isOwner: boolean
  /** Connexion ACCEPTÉE avec le propriétaire — relue à l'acte, jamais cachée. */
  isConnected: boolean
  /** Blocage dans UN SENS OU L'AUTRE : il ferme les deux (cf. `graph.ts`). */
  isBlocked: boolean
}

/**
 * Un album est-il visible par ce lecteur ? Miroir d'`isPersonalPostVisibleTo`,
 * quatre étapes dans cet ordre — une règle par cas, jamais une condition
 * composée qu'il faudrait dérouler de tête :
 *
 *  1. un blocage ferme tout à qui n'est pas le propriétaire ;
 *  2. un album non publié n'est lisible que de son propriétaire — c'est le
 *     « privé par défaut » du plan §2.1, tenu par le SERVEUR ;
 *  3. le propriétaire voit toujours son album vivant ;
 *  4. l'audience tranche, et rien d'autre.
 */
export function isAlbumVisibleTo(
  input: {
    audience: AlbumAudience
    status: AlbumStatus
  } & AlbumReadContext,
): boolean {
  // ── 1. Le blocage ferme, dans les deux sens.
  if (input.isBlocked && !input.isOwner) return false
  // ── 2. Brouillon et retrait : le propriétaire, et personne d'autre.
  if (input.status !== "published") return input.isOwner
  // ── 3. Son auteur voit toujours son album vivant.
  if (input.isOwner) return true
  // ── 4. L'audience tranche.
  switch (input.audience) {
    case "public":
      return true
    case "connections":
      return input.isConnected
  }
}

// ═══════════════════════════════════════════════════════════════
// Transitions d'état
// ═══════════════════════════════════════════════════════════════

/**
 * Publier : depuis un brouillon, ou depuis un retrait (republier). Publier un
 * album déjà publié n'est pas une erreur — c'est un rejeu, traité comme tel par
 * l'API, qui ne réécrit alors rien.
 *
 * Un album VIDE ne se publie pas : une galerie sans photo n'annonce rien et
 * apprendrait seulement au réseau qu'on prépare quelque chose.
 */
export function assertAlbumPublishable(input: {
  status: AlbumStatus
  itemCount: number
}): void {
  if (input.itemCount === 0) {
    throw new DomainViolation("ALBUM_EMPTY")
  }
}

/** Retirer : seul un album PUBLIÉ se retire. Un brouillon n'a rien à refermer. */
export function assertAlbumWithdrawable(status: AlbumStatus): void {
  if (status !== "published") {
    throw new DomainViolation("ALBUM_NOT_PUBLISHED")
  }
}

// ═══════════════════════════════════════════════════════════════
// Ordre — le réordonnancement, pur
// ═══════════════════════════════════════════════════════════════

/** La position du prochain élément — jamais un trou, jamais un doublon. */
export function nextPosition(positions: readonly number[]): number {
  if (positions.length === 0) return 0
  return Math.max(...positions) + 1
}

export type AlbumOrderedItem = { id: string; position: number }

/**
 * Réordonner : l'ordre demandé doit être une PERMUTATION exacte des éléments
 * vivants de l'album.
 *
 * Exiger la liste complète plutôt qu'un déplacement relatif (« monter d'un
 * cran ») est ce qui rend le geste sûr à plusieurs onglets : un ordre partiel
 * appliqué sur une liste qui a changé entre-temps laisserait un album dont
 * personne ne sait plus l'ordre. Un identifiant inconnu, un manquant, un
 * doublon : le lot entier est refusé.
 *
 * Rend UNIQUEMENT les éléments dont la position CHANGE — écrire soixante lignes
 * pour en déplacer deux ferait soixante conflits d'écriture.
 */
export function reorderPositions(
  current: readonly AlbumOrderedItem[],
  requested: readonly string[],
): AlbumOrderedItem[] {
  const known = new Set(current.map((item) => item.id))
  const seen = new Set<string>()
  for (const id of requested) {
    if (!known.has(id) || seen.has(id)) {
      throw new DomainViolation("ALBUM_REORDER_MISMATCH")
    }
    seen.add(id)
  }
  if (seen.size !== current.length) {
    throw new DomainViolation("ALBUM_REORDER_MISMATCH")
  }
  const positionOf = new Map(current.map((item) => [item.id, item.position]))
  const changed: AlbumOrderedItem[] = []
  requested.forEach((id, index) => {
    if (positionOf.get(id) !== index) changed.push({ id, position: index })
  })
  return changed
}

/**
 * La couverture d'un album, à la lecture.
 *
 * `coverItemId` est une PRÉFÉRENCE, pas une garantie : la photo choisie peut
 * avoir été retirée depuis. Le repli est la PREMIÈRE photo vivante — jamais un
 * trou, jamais une vignette morte.
 */
export function resolveCoverId<T extends { id: string }>(
  items: readonly T[],
  coverItemId: string | undefined,
): string | undefined {
  if (items.length === 0) return undefined
  if (coverItemId !== undefined && items.some((item) => item.id === coverItemId)) {
    return coverItemId
  }
  return items[0]?.id
}
