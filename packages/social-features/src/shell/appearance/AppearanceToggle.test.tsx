// @vitest-environment jsdom
// Le bouton rond du mode sombre (ADR-0027) : chaque appui passe du clair au sombre et retour.
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n, type Locale } from "../../i18n"
import { createMemoryStorage } from "../../tests/memory-storage"
import { AppearanceToggle } from "./AppearanceToggle"
import { AppearanceProvider } from "./provider"

const MODE_KEY = "antsia:test:appearance"

function toggle(locale: Locale = "fr", className?: string) {
  const i18n = createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "shell" })
  return (
    <I18nextProvider i18n={i18n}>
      <AppearanceProvider storagePrefix="antsia:test:"><AppearanceToggle className={className} /></AppearanceProvider>
    </I18nextProvider>
  )
}

function systemPrefers(dark: boolean) {
  const media = new EventTarget() as MediaQueryList
  Object.defineProperty(media, "matches", { value: dark })
  vi.stubGlobal("matchMedia", vi.fn(() => media))
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  systemPrefers(false)
  document.documentElement.classList.remove("dark")
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.classList.remove("dark")
})

describe("AppearanceToggle", () => {
  it("ne s'affiche pas quand l'application ne monte pas le provider", () => {
    const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "shell" })
    const view = render(<I18nextProvider i18n={i18n}><AppearanceToggle /></I18nextProvider>)
    expect(view.container).toBeEmptyDOMElement()
  })

  it("chaque appui passe du clair au sombre puis du sombre au clair, et mémorise le choix", () => {
    render(toggle())
    const button = screen.getByRole("button", { name: "Mode sombre" })
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveAttribute("title", "Passer en mode sombre")

    fireEvent.click(button)
    expect(document.documentElement).toHaveClass("dark")
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveAttribute("title", "Passer en mode clair")
    expect(window.localStorage.getItem(MODE_KEY)).toBe("dark")

    fireEvent.click(button)
    expect(document.documentElement).not.toHaveClass("dark")
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(window.localStorage.getItem(MODE_KEY)).toBe("light")
  })

  it("part du mode résolu : un système sombre est rendu clair au premier appui", () => {
    systemPrefers(true)
    render(toggle())
    const button = screen.getByRole("button", { name: "Mode sombre" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(button)
    expect(document.documentElement).not.toHaveClass("dark")
    expect(window.localStorage.getItem(MODE_KEY)).toBe("light")
  })

  it("porte la lune en clair et le soleil en sombre, sans dépendre de l'hydratation", () => {
    render(toggle())
    const icons = screen.getByRole("button", { name: "Mode sombre" }).querySelectorAll("svg")
    expect(icons).toHaveLength(2)
    expect(icons[0]?.getAttribute("class")).toContain("dark:hidden")
    expect(icons[1]?.getAttribute("class")).toContain("dark:block")
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true")
  })

  it("adopte la facture de l'hôte quand elle est fournie", () => {
    render(toggle("fr", "rm-tab"))
    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveAttribute("class", "rm-tab")
  })

  it("se dit aussi en anglais", () => {
    render(toggle("en"))
    const button = screen.getByRole("button", { name: "Dark mode" })
    expect(button).toHaveAttribute("title", "Switch to dark mode")
    fireEvent.click(button)
    expect(button).toHaveAttribute("title", "Switch to light mode")
  })
})
