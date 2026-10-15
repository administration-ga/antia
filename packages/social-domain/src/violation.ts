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
  "POST_SHARE_IN_GROUP",
  "POST_PIN_GROUP",
  "POST_REACH_INVALID",
  "POST_COUNTRY_INVALID",
  "FEED_LANES_INVALID",
  "POST_COUNTRY_REQUIRED",
  "COMMENT_EMPTY",
  "COMMENT_TOO_LONG",
  // Profil
  "HANDLE_LENGTH",
  "HANDLE_CHARSET",
  "DISPLAY_NAME_LENGTH",
  "HEADLINE_TOO_LONG",
  "CONNECTION_MESSAGE_TOO_LONG",
  // Forme d'une publication de groupe ou de page
  "POST_GROUP_REQUIRED",
  "POST_GROUP_FORBIDDEN",
  "PAGE_POST_AUDIENCE_INVALID",
  "PAGE_POST_FORBIDS_GROUP",
  "PAGE_POST_FORBIDS_SHARE",
  "POST_FOLLOWERS_REQUIRES_PAGE",
  "POST_PIN_PAGE",
  // Pages : identité, nature, confiance, signataires, revendications
  "PAGE_HANDLE_LENGTH",
  "PAGE_HANDLE_CHARSET",
  "PAGE_NAME_LENGTH",
  "PAGE_SHORT_NAME_TOO_LONG",
  "PAGE_DESCRIPTION_TOO_LONG",
  "PAGE_OWNER_KIND_RESERVED",
  "PAGE_TRUST_NOT_ALLOWED",
  "PAGE_SIGNATORIES_FULL",
  "PAGE_LAST_ADMIN",
  "PAGE_SIGNATORY_IDENTITY_REQUIRED",
  "PAGE_COUNTRY_REQUIRED",
  "PAGE_NOT_CLAIMABLE",
  "PAGE_ALREADY_VERIFIED",
  "PAGE_ALREADY_CLAIMED",
  "PAGE_CLAIM_PENDING",
  "PAGE_CLAIM_EVIDENCE_COUNT",
  "PAGE_CLAIM_NOTE_TOO_LONG",
  // Albums
  "ALBUM_TITLE_REQUIRED",
  "ALBUM_TITLE_TOO_LONG",
  "ALBUM_DESCRIPTION_TOO_LONG",
  "ALBUM_CAPTION_TOO_LONG",
  "ALBUM_ALT_TOO_LONG",
  "ALBUM_ITEMS_EMPTY",
  "ALBUM_BATCH_TOO_LARGE",
  "ALBUM_MEDIA_MIME_INVALID",
  "ALBUM_MEDIA_TOO_LARGE",
  "ALBUM_FULL",
  "ALBUM_EMPTY",
  "ALBUM_NOT_PUBLISHED",
  "ALBUM_REORDER_MISMATCH",
  // Groupes thématiques
  "GROUP_NAME_LENGTH",
  "GROUP_DESCRIPTION_TOO_LONG",
  "GROUP_OWNER_CANNOT_LEAVE",
  // Évènements
  "EVENT_TITLE_LENGTH",
  "EVENT_DESCRIPTION_TOO_LONG",
  "EVENT_LOCATION_TOO_LONG",
  "EVENT_WINDOW_INVALID",
  "EVENT_TOO_LONG",
  "EVENT_TIMEZONE_INVALID",
  "EVENT_CANCELLED",
  // Stories
  "STORY_MEDIA_MIME_INVALID",
  "STORY_MEDIA_TOO_LARGE",
  "STORY_VIDEO_TOO_LONG",
  "STORY_CAPTION_TOO_LONG",
  "STORY_ACTIVE_LIMIT",
  // Dépôt de fichiers (politique par usage)
  "UPLOAD_TYPE_NOT_ALLOWED",
  "UPLOAD_SIZE_OUT_OF_RANGE",
  "UPLOAD_MISMATCH",
  // Décisions (console, modération) : le motif
  "DECISION_REASON_LENGTH",
  // Messagerie : pièces jointes
  "ATTACHMENTS_TOO_MANY",
  "ATTACHMENT_TYPE_NOT_ALLOWED",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_DURATION_NOT_AUDIO",
  "VOICE_DURATION_INVALID",
  "VOICE_TOO_LONG",
  // Messagerie : messages et fils
  "MESSAGE_EMPTY",
  "MESSAGE_TOO_LONG",
  "MESSAGE_EDIT_WINDOW_EXPIRED",
  "MESSAGE_ALREADY_DELETED",
  "MESSAGE_PIN_NOT_TEXT",
  "MESSAGE_PIN_DELETED",
  "MESSAGE_FORWARD_NOT_TEXT",
  "MESSAGE_FORWARD_UNAVAILABLE",
  "MESSAGE_FORWARD_CROSS_NETWORK",
  "THREAD_RELATION_REQUIRED",
  "THREAD_ARCHIVED",
  "THREAD_SELF",
  "MESSAGE_NOT_EDITABLE",
  // Conversations de groupe
  "GROUP_TOO_FEW_MEMBERS",
  "GROUP_FULL",
  "GROUP_SELF_MEMBER",
  "GROUP_CLOSED",
  // Appels (tête-à-tête, groupe, réglages, messagerie vocale)
  "CALL_SELF",
  "CALL_ENDED",
  "CALL_NOT_LIVE",
  "CALL_GROUP_NO_HOLD",
  "CALL_DECLINE_NOTE_TOO_LONG",
  "CALL_DND_PAST",
  "CALL_DND_TOO_LONG",
  "GROUP_CALL_TOO_FEW",
  "GROUP_CALL_SELECTION_TOO_LARGE",
  "GROUP_CALL_THREAD_TOO_LARGE",
  "GROUP_CALL_FULL",
  "GROUP_CALL_INVITES_EXHAUSTED",
  "GROUP_CALL_ALREADY_IN",
  "VOICEMAIL_DISABLED",
  "VOICEMAIL_DURATION",
  "VOICEMAIL_DIRECT_ONLY",
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
