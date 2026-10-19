// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { colorsIn, contrastRatio, parseColor, parseRules, type Rgba, TokenCascade } from "../tests/css-token-cascade"

/**
 * Toasts sonner d'antsia.ga aux couleurs de la charte (lot P01b, D6).
 *
 * Sonner pose sa palette sur `[data-sonner-toaster][data-sonner-theme='light'|
 * 'dark']` (0,2,0) ; `apps/antsia_ga/src/app/globals.css` la remplace par une
 * règle (0,3,0) qui ne lit que des jetons du contrat. Le conteneur des toasts
 * est monté dans <body> : il hérite des jetons de <html data-charte="antsia">,
 * d'où leur résolution sur ce nœud. Contrastes CALCULÉS, pas mesurés au rendu.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const ROOT = "../../../../"
const GLOBALS = read(`${ROOT}apps/antsia_ga/src/app/globals.css`)
// La feuille que sonner injecte, telle que l'application la résout (lien de son espace de travail).
const SONNER = read(`${ROOT}apps/antsia_ga/node_modules/sonner/dist/styles.css`)
const CHARTE = read("../styles/charte.css")

const cascade = new TokenCascade([
  { name: "theme.css", css: read("../styles/theme.css") },
  { name: "charte.css", css: CHARTE },
  { name: "communication.css", css: read("../styles/communication.css") },
  { name: "antsia.css", css: read("./antsia.css") },
])

const SELECTOR = '[data-charte="antsia"] [data-sonner-toaster][data-sonner-theme]'
const rule = parseRules({ name: "globals.css", css: GLOBALS }).find((candidate) => candidate.selectors.join(",") === SELECTOR)
const sonnerThemes = parseRules({ name: "sonner", css: SONNER }).filter((candidate) =>
  candidate.selectors.every((selector) => /^\[data-sonner-toaster\]\[data-sonner-theme='(light|dark)'\]$/.test(selector)),
)
const contract = new Set(parseRules({ name: "charte.css", css: CHARTE }).flatMap((candidate) => candidate.declarations.map((declaration) => declaration.token)))

type Mode = "clair" | "sombre"
const MODES: readonly Mode[] = ["clair", "sombre"]

/** Couleur d'une variable de sonner telle que notre règle la pose, résolue sur <html>. */
function toast(mode: Mode, variable: string): Rgba {
  const declaration = rule?.declarations.find((candidate) => candidate.token === variable)
  const token = /^var\((--[a-z0-9-]+)\)$/.exec(declaration?.value ?? "")?.[1]
  const resolved = token ? cascade.resolve({ charte: "antsia", dark: mode === "sombre", nested: false }, token) : undefined
  const parsed = resolved ? parseColor(resolved) : undefined
  if (!parsed) throw new Error(`${variable} ne se résout pas en couleur (${mode})`)
  return parsed
}

/** Couleur littérale d'une règle de sonner (`color: …` du texte secondaire). */
function sonnerColor(selector: string): Rgba {
  const escaped = selector.replace(/[[\]]/g, "\\$&")
  const raw = new RegExp(`${escaped} \\{[^}]*?\\bcolor: ([^;]+);`).exec(SONNER)?.[1]
  const parsed = raw ? parseColor(raw) : undefined
  if (!parsed) throw new Error(`couleur de sonner introuvable : ${selector}`)
  return parsed
}

const TEXT_PAIRS: readonly (readonly [string, string, string])[] = [
  ["--normal-text", "--normal-bg", "toast ordinaire"],
  ["--normal-bg", "--normal-text", "bouton d'action d'un toast (couleurs inversées)"],
  ["--normal-text", "--normal-bg-hover", "bouton de fermeture survolé"],
  ["--success-text", "--success-bg", "toast de succès"],
  ["--info-text", "--info-bg", "toast d'information"],
  ["--warning-text", "--warning-bg", "toast d'avertissement"],
  ["--error-text", "--error-bg", "toast d'erreur"],
]

describe("toasts sonner aux couleurs de la charte ANTSIA", () => {
  it("une règle dédiée, plus spécifique que la palette de sonner (0,3,0 contre 0,2,0)", () => {
    expect(rule).toBeDefined()
    const attributes = (selector: string) => (selector.match(/\[[^\]]+\]/g) ?? []).length
    expect(attributes(SELECTOR)).toBe(3)
    expect(sonnerThemes).toHaveLength(2)
    for (const theme of sonnerThemes) expect(attributes(theme.selectors[0] ?? "")).toBe(2)
  })

  it("remplace chaque variable de couleur que sonner pose en clair et en sombre", () => {
    const sonnerVariables = new Set(sonnerThemes.flatMap((theme) => theme.declarations.map((declaration) => declaration.token)))
    expect(sonnerVariables.size).toBeGreaterThanOrEqual(15)
    const ours = new Set(rule?.declarations.map((declaration) => declaration.token))
    expect([...sonnerVariables].filter((variable) => !ours.has(variable)).sort()).toEqual([])
  })

  it("ne lit que des jetons du contrat, sans aucune couleur littérale", () => {
    for (const declaration of rule?.declarations ?? []) {
      const token = /^var\((--[a-z0-9-]+)\)$/.exec(declaration.value)?.[1]
      expect(token, declaration.token).toBeDefined()
      expect(contract.has(token ?? ""), `${declaration.token} → ${token}`).toBe(true)
    }
    expect(colorsIn(GLOBALS.replace(/\/\*[\s\S]*?\*\//g, ""))).toEqual([])
  })

  for (const mode of MODES) {
    describe(`thème ${mode}`, () => {
      it.each(TEXT_PAIRS)("%s sur %s ≥ 4,5:1 (%s)", (foreground, background) => {
        expect(contrastRatio(toast(mode, foreground), toast(mode, background))).toBeGreaterThanOrEqual(4.5)
      })

      it("texte secondaire de sonner (description) lisible sur le fond du toast", () => {
        const description =
          mode === "clair"
            ? sonnerColor("[data-sonner-toast][data-styled='true'] [data-description]")
            : sonnerColor("[data-sonner-toaster][data-sonner-theme='dark'] [data-description]")
        expect(contrastRatio(description, toast(mode, "--normal-bg"))).toBeGreaterThanOrEqual(4.5)
      })

      it("fond ordinaire = surface élevée de la charte", () => {
        const popover = parseColor(cascade.resolve({ charte: "antsia", dark: mode === "sombre", nested: false }, "--popover") ?? "")
        expect(toast(mode, "--normal-bg")).toEqual(popover)
      })
    })
  }
})
