// @vitest-environment jsdom
// Préférences > Motif de fond (ADR-0027) : fond uni par défaut, motif posé sur la page et propre à l'appareil.
import { createAppI18n } from "@antsia/social-features/i18n"
import { AppearanceProvider } from "@antsia/social-features/shell/appearance"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import { APPEARANCE } from "@/lib/appearance"
import { MotifPicker } from "./motif-picker"

const MOTIF_KEY = `${APPEARANCE.storagePrefix}motif`

let root: Root | undefined
let container: HTMLDivElement

/** Stockage en mémoire : le test ne touche aucun stockage réel. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() { return items.size },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key) },
    setItem: (key, value) => { items.set(key, String(value)) },
  }
}

async function mount(locale: "fr" | "en", withMotifs = true) {
  const translations = createAppI18n({ locale, appResources, defaultNS: "antsia" })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <I18nextProvider i18n={translations}>
        <AppearanceProvider storagePrefix={APPEARANCE.storagePrefix} themes={APPEARANCE.themes} motifs={withMotifs ? APPEARANCE.motifs : undefined}>
          <MotifPicker />
        </AppearanceProvider>
      </I18nextProvider>,
    )
  })
}

const radios = () => [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
const chips = () => radios().map((radio) => radio.closest("label")!)

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage())
  vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: false, media: "(prefers-color-scheme: dark)" })))
  delete document.documentElement.dataset.motif
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container?.remove()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.motif
})

describe("MotifPicker", () => {
  it("propose le fond uni, coché par défaut, puis les quatre motifs, sans rien poser sur la page", async () => {
    await mount("fr")
    expect(container.querySelector("legend")?.textContent).toBe("Motif de fond")
    expect(radios().map((radio) => radio.value)).toEqual(["none", "points", "quadrillage", "grain", "projecteur"])
    expect(chips().map((chip) => chip.textContent)).toEqual(["Aucun", "Points", "Quadrillage", "Grain", "Projecteur"])
    expect(radios()[0]?.checked).toBe(true)
    expect(document.documentElement.dataset.motif).toBeUndefined()
    expect(window.localStorage.getItem(MOTIF_KEY)).toBeNull()
    for (const radio of radios()) expect(radio.getAttribute("aria-describedby")).toBe(container.querySelector("fieldset p")?.id)
  })

  it("choisir un motif le coche, le pose sur la page et le mémorise ; « Aucun » rend le fond uni", async () => {
    await mount("fr")
    const points = radios().find((radio) => radio.value === "points")!
    await act(async () => points.click())
    expect(points.checked).toBe(true)
    expect(radios().filter((radio) => radio.checked)).toHaveLength(1)
    expect(document.documentElement.dataset.motif).toBe("points")
    expect(window.localStorage.getItem(MOTIF_KEY)).toBe("points")
    await act(async () => radios()[0]!.click())
    expect(radios()[0]?.checked).toBe(true)
    expect(document.documentElement.dataset.motif).toBeUndefined()
    expect(window.localStorage.getItem(MOTIF_KEY)).toBeNull()
  })

  it("retrouve le motif mémorisé sur l'appareil", async () => {
    window.localStorage.setItem(MOTIF_KEY, "grain")
    await mount("fr")
    expect(radios().find((radio) => radio.checked)?.value).toBe("grain")
    expect(document.documentElement.dataset.motif).toBe("grain")
  })

  it("puces sans contour : le choix se lit à l'aplat d'identité et au crochet", async () => {
    await mount("fr")
    for (const chip of chips()) expect(chip.className).not.toMatch(/(^|\s)border(-|\s|$)/)
    expect(chips()[0]?.className).toContain("bg-[var(--primary-fill)]")
    expect(chips()[0]?.querySelector("svg")).not.toBeNull()
    for (const chip of chips().slice(1)) expect(chip.querySelector("svg")).toBeNull()
  })

  it("les libellés existent aussi en anglais", async () => {
    await mount("en")
    expect(container.querySelector("legend")?.textContent).toBe("Background pattern")
    expect(chips().map((chip) => chip.textContent)).toEqual(["None", "Dots", "Grid", "Grain", "Spotlight"])
  })

  it("ne s'affiche pas quand l'application ne propose aucun motif", async () => {
    await mount("fr", false)
    expect(container.querySelector("fieldset")).toBeNull()
  })
})
