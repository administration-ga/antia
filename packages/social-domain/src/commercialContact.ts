/** P10 : règles pures du canal commercial, sans relation personnelle implicite. */
export const COMMERCIAL_TEXT_MAX = 2000
export const COMMERCIAL_ATTACHMENTS_MAX = 2
export const COMMERCIAL_TEAM_MAX = 20
export const COMMERCIAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export type CommercialState = "requested" | "accepted" | "declined" | "blocked" | "closed"

export function commercialText(value: string, allowEmpty = false): string | null {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) return null
  const text = value.normalize("NFC").trim()
  return text.length <= COMMERCIAL_TEXT_MAX && (allowEmpty || text.length > 0) ? text : null
}

export function commercialIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/u.test(value)
}

export function commercialCanSend(state: CommercialState, blocked: boolean, canReply: boolean): boolean {
  return state === "accepted" && !blocked && canReply
}

export function commercialTerminal(state: CommercialState): boolean {
  return state === "closed" || state === "declined" || state === "blocked"
}

export function commercialMandateValid(rights: { canRead: boolean; canReply: boolean; canDecide: boolean; canCall: boolean }): boolean {
  return rights.canRead || (!rights.canReply && !rights.canDecide && !rights.canCall)
}
