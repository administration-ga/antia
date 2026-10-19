import en from "./i18n/locales/en/auth.json"
import fr from "./i18n/locales/fr/auth.json"

export function otpMessage(locale: string | undefined, brand: string, code: string) {
  const labels = locale === "en" ? en : fr
  const interpolate = (text: string) => text.replaceAll("{{brand}}", brand).replaceAll("{{code}}", code)
  return { subject: interpolate(labels.otpSubject), text: interpolate(labels.otpMessage) }
}
