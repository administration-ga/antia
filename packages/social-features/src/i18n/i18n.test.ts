import { describe, expect, it } from "vitest"

import { createAppI18n, DEFAULT_LOCALE, isSupportedLocale } from "./index"

const appResources = {
  fr: { demo: { hello: "Bonjour {{name}}" } },
  en: { demo: { hello: "Hello {{name}}" } },
}

describe("createAppI18n", () => {
  it("traduit de façon synchrone avec les ressources en mémoire", () => {
    const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "demo" })
    expect(i18n.t("hello", { name: "Ada" })).toBe("Bonjour Ada")
  })

  it("expose les espaces de noms du moteur à côté de ceux de l'application", () => {
    const i18n = createAppI18n({ locale: "en", appResources, defaultNS: "demo" })
    expect(i18n.t("badges.official", { ns: "social" })).toBe("Official")
    expect(i18n.t("notFound", { ns: "errors" })).toMatch(/cannot be found/)
  })

  it("retombe sur le français pour une clé absente d'une autre langue", () => {
    const i18n = createAppI18n({
      locale: "en",
      appResources: { fr: { demo: { only: "Seulement en français" } }, en: { demo: {} } },
      defaultNS: "demo",
    })
    expect(i18n.t("only")).toBe("Seulement en français")
  })

  it("ne reconnaît que les langues prises en charge", () => {
    expect(isSupportedLocale("fr")).toBe(true)
    expect(isSupportedLocale("de")).toBe(false)
    expect(DEFAULT_LOCALE).toBe("fr")
  })
})
