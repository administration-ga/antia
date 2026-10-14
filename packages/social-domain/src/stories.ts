// Dupliqué de socle/convex/modules/reseauPersonnel/domain.ts (l. 1142-1459) @ ad2e7fdc2 — adaptations : section des stories isolée dans son module ; surfaces `reseau`/`icom` (ADR-0079 du socle) retirées : une seule borne vidéo, la plus stricte du socle (50 Mo, 5 minutes) ; phrases de refus remplacées par `DomainViolation` (code + bornes, texte dans les locales de l'écran).
/**
 * STORIES — le contenu éphémère, 24 heures.
 */
import { POST_IMAGE_MAX_BYTES, POST_IMAGE_MIME_TYPES, type PersonalReachAudience, type PostMediaKind } from "./content"
import { DomainViolation, megabytes } from "./violation"

/**
 * Vingt-quatre heures, et rien ne les prolonge : un contenu dont l'expiration
 * se négocie n'est plus éphémère.
 */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000

/** Une légende, pas un billet — le fil existe pour ce qui mérite d'être écrit. */
export const STORY_CAPTION_MAX_LENGTH = 200

/** Même plafond qu'une image de publication : la borne connue des clients. */
export const STORY_IMAGE_MAX_BYTES = POST_IMAGE_MAX_BYTES

/**
 * Vingt stories vivantes par personne : ce qui empêche un plateau de devenir
 * illisible et une lecture de plateau de devenir non bornée.
 */
export const STORY_ACTIVE_PER_AUTHOR_MAX = 20

/** Les deux bornes d'une vidéo de story, sur un axe chacune. */
export interface StoryVideoLimits {
  maxBytes: number
  maxDurationMs: number
}

/**
 * Ce qu'une vidéo de story a le droit de peser et de durer. Le socle bornait
 * par surface (10 minutes sur le fil, 5 dans les Statuts) ; le moteur n'a
 * qu'une surface et retient la borne la plus stricte : une story se regarde
 * entre deux gestes, sur le forfait mobile de la personne.
 */
export const STORY_VIDEO_LIMITS: StoryVideoLimits = { maxBytes: 50 * 1024 * 1024, maxDurationMs: 5 * 60 * 1000 }
export const STORY_VIDEO_MAX_BYTES = STORY_VIDEO_LIMITS.maxBytes
export const STORY_VIDEO_MAX_DURATION_MS = STORY_VIDEO_LIMITS.maxDurationMs

export type StoryMediaInput = {
  kind: PostMediaKind
  mimeType: string
  sizeBytes: number
  durationMs?: number
}

/**
 * Vidéo de STORY : lisible PARTOUT, c'est le contrat. QuickTime (.mov) ne se
 * décode que dans Safari — une publication peut le tolérer, une story jouée
 * plein écran non. Le composeur CONVERTIT les autres conteneurs vers l'un de
 * ces deux formats avant le téléversement ; cette liste est la garantie côté
 * serveur que rien d'illisible n'entre.
 */
export const STORY_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const

/** Le média d'une story — UN seul, jamais une galerie. */
export function assertStoryMedia(media: StoryMediaInput): void {
  const allowed: readonly string[] = media.kind === "image" ? POST_IMAGE_MIME_TYPES : STORY_VIDEO_MIME_TYPES
  if (!allowed.includes(media.mimeType)) {
    throw new DomainViolation("STORY_MEDIA_MIME_INVALID")
  }
  const maxBytes = media.kind === "image" ? STORY_IMAGE_MAX_BYTES : STORY_VIDEO_LIMITS.maxBytes
  if (media.sizeBytes <= 0 || media.sizeBytes > maxBytes) {
    throw new DomainViolation("STORY_MEDIA_TOO_LARGE", { maxMegabytes: megabytes(maxBytes) })
  }
  // La durée est DÉCLARÉE par le client (le stockage ne la connaît pas) : on ne
  // peut que la refuser quand elle s'avoue trop longue. La borne réelle reste
  // le poids, qu'on relit, lui.
  if (media.kind === "video" && media.durationMs !== undefined && media.durationMs > STORY_VIDEO_LIMITS.maxDurationMs) {
    throw new DomainViolation("STORY_VIDEO_TOO_LONG", { maxMinutes: STORY_VIDEO_LIMITS.maxDurationMs / 60_000 })
  }
}

/** La légende, nettoyée — vide devient absente, jamais une chaîne blanche. */
export function assertStoryCaption(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const caption = raw.trim()
  if (caption.length === 0) return undefined
  if (caption.length > STORY_CAPTION_MAX_LENGTH) {
    throw new DomainViolation("STORY_CAPTION_TOO_LONG", { max: STORY_CAPTION_MAX_LENGTH })
  }
  return caption
}

/**
 * Qui voit cette story ? Une seule fonction, appelée à CHAQUE lecture, dont les
 * entrées sont des faits et jamais des décisions prises ailleurs. (La garde du
 * réseau passe avant, comme pour les publications.)
 *
 * L'expiration et le retrait referment la story pour tout le monde SAUF son
 * auteur, qui la voit jusqu'à la purge.
 */
export function isStoryVisibleTo(input: {
  audience: PersonalReachAudience
  isAuthor: boolean
  isConnected: boolean
  isBlockedWithAuthor: boolean
  isRemoved: boolean
  isExpired: boolean
}): boolean {
  if (input.isAuthor) return true
  if (input.isRemoved || input.isExpired) return false
  // Le blocage prime sur toute audience — y compris `public`.
  if (input.isBlockedWithAuthor) return false
  return input.audience === "public" ? true : input.isConnected
}

/** Expirée ? Une comparaison, isolée pour que le seuil ne se recopie pas. */
export function isStoryExpired(expiresAt: number, now: number): boolean {
  return expiresAt <= now
}

/** L'instant d'expiration d'une story publiée maintenant. */
export function storyExpiresAt(publishedAt: number): number {
  return publishedAt + STORY_TTL_MS
}
