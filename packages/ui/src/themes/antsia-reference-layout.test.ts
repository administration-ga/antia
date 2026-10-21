// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { type ChartedNode, TokenCascade } from "../tests/css-token-cascade"
import { ANTSIA_THEME_IDS, antsiaCharteFor } from "./antsia-themes"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const base = ["theme", "charte", "communication"].map((name) => ({ name, css: read(`../styles/${name}.css`) }))
const geometry = {
  "--esp-page-title-size": "26px", "--esp-page-title-leading": "1.1",
  "--esp-section-title-size": "20px", "--esp-section-title-leading": "1.2",
  "--esp-content-font-size": "15px", "--esp-field-font-size": "16px",
  "--esp-fab-size": "52px", "--esp-control-min-size": "44px",
  "--esp-layout-max-width": "1400px", "--esp-layout-gap": "24px",
  "--esp-grid-wide-columns": "248px minmax(0, 1fr) 312px",
  "--esp-mobile-content-padding": "4px 12px 120px",
  "--esp-tablet-content-padding": "8px 24px 140px",
  "--esp-tablet-dock-width": "540px",
} as const
const shadows: Record<string, readonly [string, string]> = {
  soleil: ["0 1px 2px rgb(28 25 23 / 0.05)", "inset 0 1px 0 rgb(255 255 255 / 0.05)"],
  corail: ["0 1px 2px rgb(0 0 0 / 0.05), 0 6px 20px rgb(0 0 0 / 0.05)", "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px rgb(0 0 0 / 0.4)"],
}

describe("mesures des 60 planches, appliquées aux sept thèmes", () => {
  it.each(ANTSIA_THEME_IDS)("%s partage les mesures et conserve sa profondeur en clair/sombre et portail", (id) => {
    const charte = antsiaCharteFor(id)
    const cascade = new TokenCascade([...base, { name: charte, css: read(`./${charte}.css`) }])
    for (const dark of [false, true]) for (const nested of [false, true]) {
      const node: ChartedNode = { charte, dark, nested }
      for (const [token, expected] of Object.entries(geometry)) expect(cascade.resolve(node, token), token).toBe(expected)
      const shadow = shadows[id]?.[dark ? 1 : 0] ?? "none"
      expect(cascade.resolve(node, "--esp-surface-shadow")).toBe(shadow)
      expect(cascade.resolve(node, "--esp-post-shadow")).toBe(id === "electrique" ? `inset 0 0 0 1px ${cascade.resolve(node, "--esp-surface-border")}` : shadow)
      expect(cascade.resolve(node, "--esp-mobilebar-bg")).toContain("0.88")
    }
  })

  it("ces nouvelles mesures restent opt-in pour la console et DIASPORALE", () => {
    const cascade = new TokenCascade(base)
    for (const charte of ["admin-antsia", "diasporale"]) for (const dark of [false, true]) {
      const node: ChartedNode = { charte, dark, nested: false }
      for (const token of Object.keys(geometry)) expect(cascade.resolve(node, token), token).toBeUndefined()
      expect(cascade.resolve(node, "--esp-post-shadow")).toBeUndefined()
    }
  })
})
