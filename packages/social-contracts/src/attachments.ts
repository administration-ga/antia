// Dupliqué de socle/convex/modules/reseauPersonnel/messagerie/attachments.ts @ ad2e7fdc2 — adaptations : module PUR partagé ; listes blanches DÉRIVÉES de la politique de dépôt du domaine (`chat_attachment`, `voice` — une seule source, la parité devient structurelle) ; refus à code de règle (`DomainViolation`) au lieu de phrases ; l'aperçu de liste rend une NATURE (texte, vocal, pièces et leur nombre) que l'écran traduit, au lieu d'un libellé français.
/**
 * Ce qu'un message de conversation a le droit de porter, et comment on
 * l'annonce dans la liste des fils.
 *
 * ⚠️ Ces bornes se jugent APRÈS le stockage : le backend relit le poids RÉEL
 * (`convex/modules/messaging/attachmentStorage.ts`) puis appelle
 * `assertAttachmentBatch`. Un plafond appliqué au nombre que l'émetteur choisit
 * ne plafonne rien. `durationMs` reste déclaré (le stockage ne décode pas
 * l'audio) : il sert au rendu, jamais à une décision.
 *
 * ⚠️ Un message vocal n'est PAS un genre de message : il se dit par le MIME de
 * sa pièce jointe.
 */
import { DomainViolation, megabytes } from "@antia/social-domain/violation"
import { normalizeMimeType, UPLOAD_USAGES } from "@antia/social-domain/uploadPolicy"

/** Cinq pièces par message : au-delà, c'est un dossier, pas une conversation. */
export const ATTACHMENTS_MAX_PER_MESSAGE = 5

/** Le plafond de la politique de dépôt d'une pièce de conversation (25 Mo). */
export const ATTACHMENT_MAX_BYTES = UPLOAD_USAGES.chat_attachment.maxBytes

/** Les conteneurs sonores d'un message vocal — ceux de l'usage de dépôt `voice`. */
export const VOICE_MIME_TYPES = UPLOAD_USAGES.voice.mimeTypes

/** Cinq minutes. Au-delà, on écrit ou on s'appelle. */
export const VOICE_MAX_DURATION_MS = 5 * 60_000

/** Ce qu'une conversation accepte comme pièce — la liste blanche de l'usage `chat_attachment`. */
export const CHAT_ATTACHMENT_MIME_TYPES = UPLOAD_USAGES.chat_attachment.mimeTypes

const CHAT_MIME_SET: ReadonlySet<string> = new Set(CHAT_ATTACHMENT_MIME_TYPES)
const VOICE_MIME_SET: ReadonlySet<string> = new Set(VOICE_MIME_TYPES)

/** L'extrait d'un message cité — assez pour reconnaître, jamais pour relire. */
export const REPLY_EXCERPT_MAX_LENGTH = 140

/** Ce qu'une pièce présente au domaine — sans identifiant de stockage. */
export interface AttachmentInput {
  filename: string
  mimeType: string
  sizeBytes: number
  durationMs?: number
}

/**
 * Le MIME nu, sans ses paramètres, en minuscules : `MediaRecorder` rend
 * `audio/webm;codecs=opus`, et un type MIME est insensible à la casse.
 */
function baseMimeType(mimeType: string): string {
  return normalizeMimeType(mimeType) ?? ""
}

/** Ce type de pièce est-il accepté dans une conversation ? */
export function isChatMimeAllowed(mimeType: string): boolean {
  return CHAT_MIME_SET.has(baseMimeType(mimeType))
}

/** Cette pièce est-elle un MESSAGE VOCAL ? */
export function isVoiceAttachment(mimeType: string): boolean {
  return VOICE_MIME_SET.has(baseMimeType(mimeType))
}

/**
 * Les pièces d'un message, ENSEMBLE. Refus, dans cet ordre : le nombre, puis
 * le type, le poids et la durée de chaque pièce. Un lot vide passe.
 */
export function assertAttachmentBatch(files: readonly AttachmentInput[]): void {
  if (files.length === 0) return
  if (files.length > ATTACHMENTS_MAX_PER_MESSAGE) throw new DomainViolation("ATTACHMENTS_TOO_MANY", { max: ATTACHMENTS_MAX_PER_MESSAGE })
  for (const file of files) {
    if (!isChatMimeAllowed(file.mimeType)) throw new DomainViolation("ATTACHMENT_TYPE_NOT_ALLOWED")
    if (file.sizeBytes <= 0 || file.sizeBytes > ATTACHMENT_MAX_BYTES) throw new DomainViolation("ATTACHMENT_TOO_LARGE", { maxMegabytes: megabytes(ATTACHMENT_MAX_BYTES) })
    if (file.durationMs === undefined) continue
    // Une durée sur autre chose qu'un son ne décrit rien : la refuser évite un champ libre non validé.
    if (!isVoiceAttachment(file.mimeType)) throw new DomainViolation("ATTACHMENT_DURATION_NOT_AUDIO")
    if (!Number.isFinite(file.durationMs) || file.durationMs <= 0) throw new DomainViolation("VOICE_DURATION_INVALID")
    if (file.durationMs > VOICE_MAX_DURATION_MS) throw new DomainViolation("VOICE_TOO_LONG", { maxMinutes: VOICE_MAX_DURATION_MS / 60_000 })
  }
}

/**
 * L'aperçu d'un message dans la liste des fils, en NATURE : le texte gagne
 * quand il existe ; sinon un vocal SEUL se dit vocal, et des pièces se disent
 * par leur nombre (l'écran accorde). `null` : ni texte ni pièce (un message
 * système se compose à l'écran).
 */
export type MessagePreview = { kind: "text"; text: string } | { kind: "voice" } | { kind: "attachments"; count: number }

export function messagePreviewFor(text: string, files: readonly AttachmentInput[]): MessagePreview | null {
  const trimmed = text.trim()
  if (trimmed.length > 0) return { kind: "text", text: trimmed }
  if (files.length === 0) return null
  if (files.length === 1 && isVoiceAttachment(files[0]!.mimeType)) return { kind: "voice" }
  return { kind: "attachments", count: files.length }
}

/** L'extrait d'un message cité — RELU à la lecture, jamais recopié à l'écriture. */
export function replyExcerpt(text: string | null | undefined): string {
  const trimmed = (text ?? "").trim()
  return trimmed.length <= REPLY_EXCERPT_MAX_LENGTH ? trimmed : trimmed.slice(0, REPLY_EXCERPT_MAX_LENGTH)
}
