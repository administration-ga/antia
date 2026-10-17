import type { Locale } from "@antsia/social-features/i18n"
import { getAppT } from "@/i18n/server"

export function getPublicT(locale: Locale = "fr") {
  const { t } = getAppT(locale)
  return (key: string, options: Record<string, unknown> = {}) => t(`publicNetwork:${key}`, options)
}

export function publicDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(timestamp)
}
