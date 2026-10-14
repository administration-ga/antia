/**
 * Violation d'une règle du domaine — remplace `ReseauPersonnelViolation` et
 * `ReseauAlbumsViolation` du socle.
 *
 * Le domaine ne parle pas : il lève le CODE de la règle enfreinte et ses
 * paramètres (bornes, jamais une valeur saisie). Le texte vit dans les locales
 * de l'écran (`errors` → `rules.<code>`, fr et en, interpolation des
 * paramètres). Au bord, une fonction Convex traduit la violation en
 * `invalidArgument` portant `{ rule, params }` (`convex/lib/errors.ts`).
 *
 * Les codes reprennent ceux du socle : un écran porté et un test porté les
 * reconnaissent tels quels.
 */
export const DOMAIN_RULES = [
  // Médias et contenu d'une publication
  "AVATAR_MIME_INVALID",
  "AVATAR_TOO_LARGE",
  "POST_MEDIA_TOO_MANY",
  "POST_VIDEO_MUST_BE_ALONE",
  "POST_MEDIA_MIME_INVALID",
  "POST_MEDIA_TOO_LARGE",
  "POST_MEDIA_ALT_TOO_LONG",
  "POST_SHARE_WITH_MEDIA",
  "POST_EMPTY",
  "POST_TOO_LONG",
  "POST_NOT_SHAREABLE",
  "COMMENT_EMPTY",
  "COMMENT_TOO_LONG",
  // Profil
  "HANDLE_LENGTH",
  "HANDLE_CHARSET",
  "HEADLINE_TOO_LONG",
  "CONNECTION_MESSAGE_TOO_LONG",
  // Forme d'une publication de groupe ou de page
  "POST_GROUP_REQUIRED",
  "POST_GROUP_FORBIDDEN",
  "PAGE_POST_AUDIENCE_INVALID",
  "PAGE_POST_FORBIDS_GROUP",
  "PAGE_POST_FORBIDS_SHARE",
  // Groupes thématiques
  "GROUP_NAME_LENGTH",
  "GROUP_DESCRIPTION_TOO_LONG",
  // Évènements
  "EVENT_TITLE_LENGTH",
  "EVENT_DESCRIPTION_TOO_LONG",
  "EVENT_LOCATION_TOO_LONG",
  "EVENT_WINDOW_INVALID",
  "EVENT_TOO_LONG",
  "EVENT_TIMEZONE_INVALID",
  // Stories
  "STORY_MEDIA_MIME_INVALID",
  "STORY_MEDIA_TOO_LARGE",
  "STORY_VIDEO_TOO_LONG",
  "STORY_CAPTION_TOO_LONG",
] as const
export type DomainRule = (typeof DOMAIN_RULES)[number]

/** Paramètres d'une violation : des bornes, jamais une valeur saisie par la personne. */
export type DomainRuleParams = Readonly<Record<string, number>>

export class DomainViolation extends Error {
  constructor(
    readonly code: DomainRule,
    readonly params: DomainRuleParams = {},
  ) {
    super(code)
    this.name = "DomainViolation"
  }
}

export function isDomainViolation(error: unknown): error is DomainViolation {
  return error instanceof DomainViolation
}

/** Octets → mébioctets entiers, pour les paramètres de taille (« 20 Mo »). */
export function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024))
}
