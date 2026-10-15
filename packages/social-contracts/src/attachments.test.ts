// Dupliqué de socle/convex/modules/reseauPersonnel/messagerie/attachments.test.ts @ ad2e7fdc2 — adaptations : refus par code de règle au lieu des phrases ; l'aperçu rend une nature (l'écran accorde le pluriel) ; parité des listes blanches devenue structurelle (dérivées de la politique de dépôt), le test vérifie l'effet.
import { DomainViolation } from "@antia/social-domain/violation"
import { describe, expect, it } from "vitest"

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_MAX_PER_MESSAGE,
  type AttachmentInput,
  assertAttachmentBatch,
  isChatMimeAllowed,
  isVoiceAttachment,
  messagePreviewFor,
  REPLY_EXCERPT_MAX_LENGTH,
  replyExcerpt,
  VOICE_MAX_DURATION_MS,
} from "./attachments"

function piece(over: Partial<AttachmentInput> = {}): AttachmentInput {
  return { filename: "note.pdf", mimeType: "application/pdf", sizeBytes: 1_024, ...over }
}

function vocal(over: Partial<AttachmentInput> = {}): AttachmentInput {
  return piece({ filename: "vocal.webm", mimeType: "audio/webm", sizeBytes: 4_096, durationMs: 3_000, ...over })
}

const ruleOf = (run: () => unknown): string | null => {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof DomainViolation ? error.code : "autre"
  }
}

describe("isVoiceAttachment", () => {
  it("reconnaît les conteneurs de la liste blanche, avec leurs paramètres de codec et sans égard à la casse", () => {
    for (const mime of ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/aac"]) expect(isVoiceAttachment(mime)).toBe(true)
    expect(isVoiceAttachment("audio/webm;codecs=opus")).toBe(true)
    expect(isVoiceAttachment("audio/mp4; codecs=mp4a.40.2")).toBe(true)
    expect(isVoiceAttachment("AUDIO/WEBM")).toBe(true)
  })

  it("refuse ce qui n'est pas dans la liste blanche, `audio/` compris", () => {
    for (const mime of ["audio/flac", "application/pdf", "video/mp4", ""]) expect(isVoiceAttachment(mime)).toBe(false)
  })
})

describe("assertAttachmentBatch", () => {
  it("le nombre : un lot vide passe, le plafond passe, le suivant non", () => {
    expect(ruleOf(() => assertAttachmentBatch([]))).toBeNull()
    const atCap = Array.from({ length: ATTACHMENTS_MAX_PER_MESSAGE }, () => piece())
    expect(ruleOf(() => assertAttachmentBatch(atCap))).toBeNull()
    expect(ruleOf(() => assertAttachmentBatch([...atCap, piece()]))).toBe("ATTACHMENTS_TOO_MANY")
  })

  it("le poids : exactement le plafond passe, un octet de plus non ; une pièce vide non ; chaque pièce est jugée", () => {
    expect(ruleOf(() => assertAttachmentBatch([piece({ sizeBytes: ATTACHMENT_MAX_BYTES })]))).toBeNull()
    expect(ruleOf(() => assertAttachmentBatch([piece({ sizeBytes: ATTACHMENT_MAX_BYTES + 1 })]))).toBe("ATTACHMENT_TOO_LARGE")
    expect(ruleOf(() => assertAttachmentBatch([piece({ sizeBytes: 0 })]))).toBe("ATTACHMENT_TOO_LARGE")
    expect(ruleOf(() => assertAttachmentBatch([piece(), piece({ sizeBytes: -1 })]))).toBe("ATTACHMENT_TOO_LARGE")
  })

  it("le type : un exécutable ne passe pas", () => {
    expect(ruleOf(() => assertAttachmentBatch([piece({ mimeType: "application/x-msdownload" })]))).toBe("ATTACHMENT_TYPE_NOT_ALLOWED")
  })

  it("la durée d'un vocal : cinq minutes passent, au-delà non ; sans durée passe ; nulle, négative ou non finie non ; sur une pièce non sonore non", () => {
    expect(ruleOf(() => assertAttachmentBatch([vocal({ durationMs: VOICE_MAX_DURATION_MS })]))).toBeNull()
    expect(ruleOf(() => assertAttachmentBatch([vocal({ durationMs: VOICE_MAX_DURATION_MS + 1 })]))).toBe("VOICE_TOO_LONG")
    expect(ruleOf(() => assertAttachmentBatch([vocal({ durationMs: undefined })]))).toBeNull()
    for (const durationMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(ruleOf(() => assertAttachmentBatch([vocal({ durationMs })]))).toBe("VOICE_DURATION_INVALID")
    expect(ruleOf(() => assertAttachmentBatch([piece({ durationMs: 1_000 })]))).toBe("ATTACHMENT_DURATION_NOT_AUDIO")
    expect(ruleOf(() => assertAttachmentBatch([vocal({ mimeType: "audio/webm;codecs=opus", durationMs: 1_000 })]))).toBeNull()
  })
})

describe("messagePreviewFor", () => {
  it("le texte gagne ; des espaces ne sont pas un texte ; un vocal seul se dit vocal ; des pièces se disent par leur nombre ; rien : null", () => {
    expect(messagePreviewFor("Le rapport est prêt", [piece()])).toEqual({ kind: "text", text: "Le rapport est prêt" })
    expect(messagePreviewFor("   \n ", [piece()])).toEqual({ kind: "attachments", count: 1 })
    expect(messagePreviewFor("", [vocal({ mimeType: "audio/webm;codecs=opus" })])).toEqual({ kind: "voice" })
    expect(messagePreviewFor("", [vocal(), piece()])).toEqual({ kind: "attachments", count: 2 })
    expect(messagePreviewFor("  ", [])).toBeNull()
  })
})

describe("replyExcerpt et liste blanche", () => {
  it("tronque à 140 caractères et rogne les bords ; un corps absent rend une chaîne vide", () => {
    expect(replyExcerpt("  bonjour  ")).toBe("bonjour")
    expect(replyExcerpt("a".repeat(REPLY_EXCERPT_MAX_LENGTH + 50))).toHaveLength(REPLY_EXCERPT_MAX_LENGTH)
    expect(replyExcerpt(null)).toBe("")
    expect(replyExcerpt(undefined)).toBe("")
  })

  it("la liste blanche de la conversation est celle du dépôt : un exécutable n'y est pas", () => {
    expect(isChatMimeAllowed("application/x-msdownload")).toBe(false)
    expect(isChatMimeAllowed("audio/webm;codecs=opus")).toBe(true)
    expect(isChatMimeAllowed("Application/PDF")).toBe(true)
  })
})
