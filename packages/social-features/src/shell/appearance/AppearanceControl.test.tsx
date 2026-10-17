// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n, type Locale } from "../../i18n"
import { createMemoryStorage } from "../../tests/memory-storage"
import { AppearanceControl } from "./AppearanceControl"
import { AppearanceProvider } from "./provider"

function appearance(locale: Locale = "fr") {
  const i18n = createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "shell" })
  return (
    <I18nextProvider i18n={i18n}>
      <AppearanceProvider storagePrefix="antsia:test:"><AppearanceControl /></AppearanceProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  const media = new EventTarget() as MediaQueryList
  Object.defineProperty(media, "matches", { value: false })
  vi.stubGlobal("matchMedia", vi.fn(() => media))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("AppearanceControl", () => {
  it("ne propose aucun contrôle quand l'application ne monte pas le provider", () => {
    const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "shell" })
    const view = render(<I18nextProvider i18n={i18n}><AppearanceControl /></I18nextProvider>)
    expect(view.container).toBeEmptyDOMElement()
  })

  it("nomme le sélecteur natif et permet de revenir au mode système", () => {
    render(appearance())
    const select = screen.getByRole("combobox", { name: "Apparence" })
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Système", "Clair", "Sombre"])
    expect(select).toHaveValue("system")
    fireEvent.change(select, { target: { value: "dark" } })
    expect(select).toHaveValue("dark")
    expect(document.documentElement).toHaveClass("dark")
    fireEvent.change(select, { target: { value: "system" } })
    expect(select).toHaveValue("system")
    expect(document.documentElement).not.toHaveClass("dark")
  })

  it("traduit le nom et tous les choix en anglais", () => {
    render(appearance("en"))
    const select = screen.getByRole("combobox", { name: "Appearance" })
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["System", "Light", "Dark"])
  })
})
