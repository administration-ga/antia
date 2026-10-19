/** PA5 — les origines, fournisseurs et secrets restent dans l'environnement du propriétaire. */
import { devToolsAllowed } from "../../lib/devTools"

export type NotificationApplication = { applicationId: string; networkSlug: string; origin: string; entryPath: string }
export function notificationApplications(): NotificationApplication[] {
  const raw = process.env.NOTIFICATION_APPLICATIONS_JSON
  if (!raw) return []
  try {
    const rows: unknown = JSON.parse(raw)
    if (!Array.isArray(rows) || rows.length > 32) return []
    const result: NotificationApplication[] = []
    for (const row of rows) {
      if (!row || typeof row !== "object" || !("applicationId" in row) || !("networkSlug" in row) || !("origin" in row) || !("entryPath" in row)) return []
      const { applicationId, networkSlug, origin, entryPath } = row
      if (typeof applicationId !== "string" || !/^[a-z][a-z0-9_-]{1,63}$/u.test(applicationId) || typeof networkSlug !== "string" || typeof origin !== "string" || typeof entryPath !== "string") return []
      const url = new URL(origin)
      if (url.username || url.password || url.origin !== origin || (url.protocol !== "https:" && !(devToolsAllowed() && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) return []
      const target = new URL(entryPath, origin)
      if (!entryPath.startsWith("/") || entryPath.startsWith("//") || target.origin !== origin || target.hash || entryPath.length > 200) return []
      if (result.some((item) => item.applicationId === applicationId)) return []
      result.push({ applicationId, networkSlug, origin, entryPath })
    }
    return result
  } catch { return [] }
}

export function notificationApplication(applicationId: string, networkSlug: string): NotificationApplication | null {
  return notificationApplications().find((row) => row.applicationId === applicationId && row.networkSlug === networkSlug) ?? null
}

export function applicationNotificationUrl(application: NotificationApplication): string {
  return new URL(application.entryPath, application.origin).toString()
}

/** Même avec une clef correcte, aucun relais HTTP ni redirection de fournisseur. */
export function providerHttpsUrl(value: string | undefined): string | null {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url.toString() : null } catch { return null }
}
