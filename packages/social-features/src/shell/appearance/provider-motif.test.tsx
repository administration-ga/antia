// @vitest-environment jsdom
// Motif de fond au choix du membre (ADR-0027) : aucun par défaut, posé sur html, mémoire par réseau, synchronisation entre onglets.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMemoryStorage } from "../../tests/memory-storage"
import { AppearanceProvider, useOptionalAppearance } from "./provider"

const PREFIX = "antsia:test:"
const MOTIF_KEY = `${PREFIX}motif`
const MOTIFS = ["points", "quadrillage"] as const

function Probe() {
  const appearance = useOptionalAppearance()
  if (appearance === null) return null
  return (
    <>
      <output data-testid="motif">{appearance.motif ?? "uni"}</output>
      <output data-testid="count">{appearance.motifs.length}</output>
      <button onClick={() => appearance.setMotif("points")}>Points</button>
      <button onClick={() => appearance.setMotif("quadrillage")}>Quadrillage</button>
      <button onClick={() => appearance.setMotif(null)}>Uni</button>
      <button onClick={() => appearance.setMotif("étoiles")}>Inconnu</button>
    </>
  )
}

function assertMotif(motif: string | null) {
  expect(screen.getByTestId("motif")).toHaveTextContent(motif ?? "uni")
  expect(document.documentElement.dataset.motif).toBe(motif ?? undefined)
}

/** Le stockage en mémoire n'est pas un `Storage` de jsdom : l'évènement est composé à la main, comme dans provider-theme.test.tsx. */
function storageEvent(key: string | null, newValue: string | null, storageArea: Storage = window.localStorage) {
  const event = new Event("storage")
  Object.defineProperties(event, { key: { value: key }, newValue: { value: newValue }, storageArea: { value: storageArea } })
  act(() => {
    window.dispatchEvent(event)
  })
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: false, media: "(prefers-color-scheme: dark)" })))
  delete document.documentElement.dataset.motif
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.motif
})

describe("AppearanceProvider — motif de fond au choix du membre", () => {
  it("sans motifs proposés : aucun choix, et `data-motif` posé par la page n'est jamais touché", () => {
    document.documentElement.dataset.motif = "points"
    render(<AppearanceProvider storagePrefix={PREFIX}><Probe /></AppearanceProvider>)
    expect(screen.getByTestId("count")).toHaveTextContent("0")
    fireEvent.click(screen.getByRole("button", { name: "Quadrillage" }))
    expect(document.documentElement.dataset.motif).toBe("points")
    expect(window.localStorage.getItem(MOTIF_KEY)).toBeNull()
  })

  it("fond uni par défaut, sans rien écrire dans le stockage", () => {
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    assertMotif(null)
    expect(window.localStorage.getItem(MOTIF_KEY)).toBeNull()
  })

  it("choisir un motif le pose sur html et le mémorise ; revenir au fond uni efface les deux", () => {
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Points" }))
    assertMotif("points")
    expect(window.localStorage.getItem(MOTIF_KEY)).toBe("points")
    fireEvent.click(screen.getByRole("button", { name: "Uni" }))
    assertMotif(null)
    expect(window.localStorage.getItem(MOTIF_KEY)).toBeNull()
  })

  it("un motif inconnu est refusé ; un motif mémorisé qui n'est plus proposé retombe sur le fond uni", () => {
    window.localStorage.setItem(MOTIF_KEY, "étoiles")
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    assertMotif(null)
    fireEvent.click(screen.getByRole("button", { name: "Inconnu" }))
    assertMotif(null)
    expect(window.localStorage.getItem(MOTIF_KEY)).toBe("étoiles")
  })

  it("retrouve le motif au remontage, sans toucher celui d'un autre réseau", () => {
    window.localStorage.setItem("antsia:autre:motif", "points")
    const view = render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Quadrillage" }))
    view.unmount()
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    assertMotif("quadrillage")
    expect(window.localStorage.getItem("antsia:autre:motif")).toBe("points")
  })

  it("suit le choix fait dans un autre onglet, sans accepter une clé étrangère ni un motif inconnu", () => {
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    storageEvent(MOTIF_KEY, "points")
    assertMotif("points")
    storageEvent("antsia:autre:motif", "quadrillage")
    assertMotif("points")
    storageEvent(MOTIF_KEY, "quadrillage", createMemoryStorage())
    assertMotif("points")
    storageEvent(MOTIF_KEY, "étoiles")
    assertMotif(null)
    storageEvent(MOTIF_KEY, "quadrillage")
    storageEvent(null, null)
    assertMotif(null)
  })

  it("le choix reste actif quand le stockage refuse toute écriture", () => {
    vi.stubGlobal("localStorage", Object.assign(createMemoryStorage(), {
      setItem: () => { throw new Error("refusé") },
      removeItem: () => { throw new Error("refusé") },
    }))
    render(<AppearanceProvider storagePrefix={PREFIX} motifs={MOTIFS}><Probe /></AppearanceProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Points" }))
    assertMotif("points")
    fireEvent.click(screen.getByRole("button", { name: "Uni" }))
    assertMotif(null)
  })
})
