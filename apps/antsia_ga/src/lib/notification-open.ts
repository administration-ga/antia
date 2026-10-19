/** Un avis poussé ne transporte qu'une référence opaque, jamais une destination libre. */
export const NOTIFICATION_REFERENCE_PARAM = "notification"

export function parseNotificationReference(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && !/[^a-zA-Z0-9_-]/.test(value) ? value : undefined
}
