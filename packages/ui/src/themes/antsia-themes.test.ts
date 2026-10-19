// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  type ChartedNode,
  contrastRatio,
  gradientStops,
  parseColor,
  parseRules,
  relativeLuminance,
  type Rgba,
  TokenCascade,
  toHex,
} from "../tests/css-token-cascade"
import { ANTSIA_THEME_IDS, antsiaCharteFor } from "./antsia-themes"

/**
 * Les sept thèmes qu'un membre d'antsia.ga choisit dans ses réglages, en plus de
 * la charte d'origine (`antsia.css`). Chaque thème est une charte complète
 * (`data-charte="antsia-<thème>"`), rejouée ici comme antsia.ga la sert :
 * theme.css, charte.css, communication.css puis le fichier du thème, sur <html>
 * et sur un portail qui redéclare la charte.
 *
 * Règles vérifiées pour les sept : une seule couleur d'identité (action, lien,
 * focus, sélection) ; fonds neutres (blanc, gris très clair ou beige clair en
 * clair, noir ou gris sombre en sombre) ; bouton secondaire gris ; mêmes paires
 * de contraste que la charte d'origine (`antsia-palette.test.ts`). Contrastes
 * CALCULÉS sur les jetons résolus, pas mesurés au rendu.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const BASE = read("../styles/charte.css")
const BASE_SHEETS = [
  { name: "theme.css", css: read("../styles/theme.css") },
  { name: "charte.css", css: BASE },
  { name: "communication.css", css: read("../styles/communication.css") },
] as const
const ORIGINAL = read("./antsia.css")

/** Identité attendue de chaque thème (le `--primary` résolu), clair puis sombre. */
const IDENTITY: Record<string, { clair: string; sombre: string }> = {
  atlantique: { clair: "#0a5bd6", sombre: "#6aaeff" },
  indigo: { clair: "#4a55e8", sombre: "#8f98ff" },
  hibiscus: { clair: "#d0103a", sombre: "#ff4d6e" },
  encre: { clair: "#111112", sombre: "#f3f4f5" },
  foret: { clair: "#0d6e42", sombre: "#4cc98a" },
  lagon: { clair: "#086e6a", sombre: "#4ecdc4" },
  mandarine: { clair: "#b33f0e", sombre: "#ff9246" },
}
const THEMES = ANTSIA_THEME_IDS.filter((id) => id !== "antsia")

type Mode = "clair" | "sombre"
const MODES: readonly Mode[] = ["clair", "sombre"]

/** Mêmes paires de texte (≥ 4,5:1) que la charte d'origine. */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--foreground", "--background"], ["--card-foreground", "--card"], ["--popover-foreground", "--popover"], ["--foreground", "--muted"],
  ["--muted-foreground", "--background"], ["--muted-foreground", "--card"], ["--muted-foreground", "--popover"], ["--muted-foreground", "--muted"],
  ["--secondary-foreground", "--secondary"], ["--primary", "--background"], ["--primary", "--card"], ["--primary", "--popover"], ["--primary", "--muted"],
  ["--primary-foreground", "--primary"], ["--on-fill", "--primary-fill"], ["--on-fill", "--primary-fill-hover"], ["--accent-foreground", "--accent"],
  ["--on-fill", "--primary-600"], ["--on-fill", "--danger-fill"], ["--on-fill", "--danger-fill-hover"], ["--on-fill", "--success-fill"],
  ["--on-fill", "--success-fill-hover"], ["--on-fill", "--success"], ["--on-fill", "--esp-green-strong"], ["--destructive-foreground", "--destructive"],
  ["--background", "--destructive"], ["--success", "--background"], ["--success", "--card"], ["--success", "--popover"], ["--destructive", "--background"],
  ["--destructive", "--card"], ["--destructive", "--popover"], ["--danger-500", "--ink-0"], ["--danger-600", "--ink-0"], ["--danger-600", "--danger-50"],
  ["--danger-700", "--danger-50"], ["--success-600", "--success-50"], ["--success-600", "--status-archived-bg"], ["--primary-500", "--ink-0"],
  ["--primary-600", "--ink-0"], ["--primary-600", "--background"], ["--primary-700", "--ink-0"], ["--primary-600", "--primary-50"],
  ["--primary-700", "--primary-50"], ["--primary-700", "--primary-100"], ["--primary-800", "--primary-100"], ["--foreground", "--primary-50"],
  ["--info-600", "--info-50"], ["--primary-600", "--status-active-bg"], ["--esp-accent-deep", "--esp-accent-soft"],
  ["--sidebar-accent-foreground", "--sidebar-accent"], ["--sidebar-foreground", "--sidebar"], ["--ink-900", "--ink-0"], ["--ink-900", "--ink-100"],
  ["--ink-800", "--ink-0"], ["--ink-700", "--ink-0"], ["--ink-600", "--ink-0"], ["--ink-600", "--ink-100"], ["--ink-600", "--ink-50"],
  ["--ink-500", "--ink-0"], ["--ink-400", "--ink-0"], ["--ink-400", "--popover"], ["--ink-600", "--ink-150"], ["--ink-700", "--ink-150"],
  ["--ink-700", "--status-semi-bg"], ["--ink-600", "--status-inactive-bg"], ["--muted-foreground", "--esp-neutral-chip"],
]

/** Mêmes paires non textuelles (≥ 3:1, WCAG 1.4.11) que la charte d'origine. */
const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--input", "--background"], ["--input", "--card"], ["--input", "--popover"], ["--input", "--muted"], ["--ink-300", "--ink-0"],
  ["--ink-300", "--ink-100"], ["--ink-400", "--ink-0"], ["--ring", "--background"], ["--ring", "--card"], ["--ring", "--popover"], ["--ring", "--muted"],
  ["--outline-ring", "--background"], ["--outline-ring", "--card"], ["--outline-ring", "--popover"], ["--primary-300", "--background"],
  ["--primary-300", "--card"], ["--primary-300", "--popover"], ["--primary-400", "--card"], ["--primary-400", "--background"],
  ["--primary-fill", "--card"], ["--warning", "--card"],
]

/** Rôles du bloc sombre de la base gardés tels quels, comme dans la charte d'origine. */
const INHERITED_IN_DARK = new Set([
  "--warning", "--warning-light", "--warning-50", "--warning-100", "--warning-500", "--warning-600",
  "--status-destruct", "--status-destruct-bg",
  "--accent-orange", "--accent-yellow", "--accent-blue",
  "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--esp-tone-blue", "--esp-tone-blue-bg", "--esp-tone-amber", "--esp-tone-amber-bg",
  "--esp-tone-rose", "--esp-tone-rose-bg", "--esp-tone-green", "--esp-tone-green-bg",
  "--esp-mobilebar-bg", "--esp-mobilebar-shadow", "--esp-shadow-card", "--border-light",
  "--esp-segment-on", "--esp-segment-on-fg",
])

/** Écart des composantes : sous 0,06, la couleur se lit comme un neutre (blanc, gris, beige, noir). */
const chroma = (rgba: Rgba) => Math.max(rgba.r, rgba.g, rgba.b) - Math.min(rgba.r, rgba.g, rgba.b)

const declarationsOf = (css: string, selectors: readonly string[]) =>
  parseRules({ name: "thème", css })
    .filter((rule) => rule.selectors.join("|") === selectors.join("|"))
    .flatMap((rule) => rule.declarations.map((declaration) => [declaration.token, declaration.value] as const))

const ORIGINAL_SHARED = new Map(declarationsOf(ORIGINAL, ['[data-charte="antsia"]', '.dark[data-charte="antsia"]', '.dark [data-charte="antsia"]']))

describe("les sept thèmes d'antsia.ga", () => {
  it("la liste des thèmes et les fichiers du dossier coïncident ; la charte d'origine reste la première", () => {
    const files = readdirSync(new URL(".", import.meta.url)).filter((name) => /^antsia-[a-z]+\.css$/.test(name)).sort()
    expect(files).toEqual(THEMES.map((id) => `antsia-${id}.css`).sort())
    expect(ANTSIA_THEME_IDS[0]).toBe("antsia")
    expect(ANTSIA_THEME_IDS).toHaveLength(8)
    expect(antsiaCharteFor("antsia")).toBe("antsia")
    for (const id of THEMES) expect(antsiaCharteFor(id)).toBe(`antsia-${id}`)
    expect(Object.keys(IDENTITY).sort()).toEqual([...THEMES].sort())
  })

  it("les toasts suivent chaque thème : même règle que la charte d'origine, étendue aux sept chartes", () => {
    const globals = read("../../../../apps/antsia_ga/src/app/globals.css")
    const rules = parseRules({ name: "globals.css", css: globals })
    const original = rules.find((rule) => rule.selectors.join(",") === '[data-charte="antsia"] [data-sonner-toaster][data-sonner-theme]')
    const themed = rules.find((rule) => rule.selectors.every((selector) => /^\[data-charte="antsia-[a-z]+"\] \[data-sonner-toaster\]\[data-sonner-theme\]$/.test(selector)))
    expect(original, "règle d'origine").toBeDefined()
    expect(themed?.selectors.map((selector) => /antsia-([a-z]+)/.exec(selector)?.[1]).sort()).toEqual([...THEMES].sort())
    expect(themed?.declarations).toEqual(original?.declarations)
  })

  it("contours : aucun filet de surface dans les huit chartes ANTSIA, le filet d'origine partout ailleurs", () => {
    // La base pose `--esp-surface-border: initial` : chaque site retombe sur SON filet historique.
    const base = new TokenCascade(BASE_SHEETS)
    for (const dark of [false, true]) {
      const node: ChartedNode = { charte: "diasporale", dark, nested: false }
      expect(base.resolve(node, "--esp-surface-border")).toBeUndefined()
      expect(base.resolveValue(node, "var(--esp-surface-border, var(--border))")).toBe(base.resolve(node, "--border"))
      expect(base.resolveValue(node, "var(--esp-surface-border, var(--ink-200))")).toBe(base.resolve(node, "--ink-200"))
    }
    // Les chartes ANTSIA distinguent toujours la carte du fond (testé plus bas) : aucun contour.
    for (const id of ANTSIA_THEME_IDS) {
      const charte = antsiaCharteFor(id)
      const themed = new TokenCascade([...BASE_SHEETS, { name: `${charte}.css`, css: read(`./${charte}.css`) }])
      for (const dark of [false, true]) {
        for (const nested of [false, true]) expect(themed.resolve({ charte, dark, nested }, "--esp-surface-border"), `${charte} ${dark ? "sombre" : "clair"}`).toBe("transparent")
      }
    }
  })

  it("les sites qui dessinaient un filet de surface lisent le jeton, leur filet d'origine en repli", () => {
    const SITES: readonly (readonly [string, string, number])[] = [
      ["../../../social-features/src/shell/design-styles.ts", "1px solid var(--esp-surface-border, var(--border))", 1],
      ["../espace-kit/espace-kit-styles.tsx", "border: 1px solid var(--esp-surface-border, var(--border));", 2],
      ["../../../social-features/src/features/messagerie/messagerie-styles.tsx", "border: 1px solid var(--esp-surface-border, var(--ink-200));", 1],
      ["../../../social-features/src/features/stories/stories-styles.tsx", "border: 1px solid var(--esp-surface-border, var(--border));", 1],
      ["../../../../apps/antsia_ga/src/components/shared/controls.tsx", "border-[color:var(--esp-surface-border,var(--border))]", 1],
      ["../../../social-features/src/features/reseau-personnel/ProfileMiniCard.tsx", "1px solid var(--esp-surface-border, var(--ink-200))", 1],
    ]
    for (const [path, expression, count] of SITES) expect(read(path).split(expression).length - 1, path).toBe(count)
  })

  for (const id of THEMES) {
    const charte = antsiaCharteFor(id)
    const identity = IDENTITY[id]
    if (!identity) throw new Error(`${id} : identité attendue absente du tableau IDENTITY`)
    const css = read(`./${charte}.css`)
    const cascade = new TokenCascade([...BASE_SHEETS, { name: `${charte}.css`, css }])
    const node = (mode: Mode, nested = false): ChartedNode => ({ charte, dark: mode === "sombre", nested })
    const value = (mode: Mode, token: string, nested = false) => {
      const resolved = cascade.resolve(node(mode, nested), token)
      if (resolved === undefined) throw new Error(`${charte} : ${token} ne se résout pas en ${mode}`)
      return resolved
    }
    const color = (mode: Mode, token: string, nested = false): Rgba => {
      const parsed = parseColor(value(mode, token, nested))
      if (!parsed) throw new Error(`${charte} : ${token} n'est pas une couleur en ${mode}`)
      return parsed
    }
    const ratio = (mode: Mode, foreground: string, background: string) =>
      contrastRatio(color(mode, foreground), color(mode, background), color(mode, "--background"))
    const luminance = (mode: Mode, token: string) => relativeLuminance(color(mode, token))

    const LIGHT = [`[data-charte="${charte}"]`]
    const DARK = [`.dark[data-charte="${charte}"]`, `.dark [data-charte="${charte}"]`]
    const BOTH = [...LIGHT, ...DARK]

    describe(`thème ${id}`, () => {
      it("trois blocs comme la charte d'origine ; le bloc commun reprend exactement le sien", () => {
        expect(parseRules({ name: charte, css }).map((rule) => rule.selectors)).toEqual([LIGHT, DARK, BOTH])
        const shared = new Map(declarationsOf(css, BOTH))
        expect([...shared.keys()].sort()).toEqual([...ORIGINAL_SHARED.keys()].sort())
        for (const [token, original] of ORIGINAL_SHARED) {
          if (token === "--ui2-scrim") continue
          expect(shared.get(token), token).toBe(original)
        }
      })

      it("le sombre redéclare chaque rôle du bloc sombre de la base, sauf les héritages de la charte d'origine", () => {
        const baseDark = parseRules({ name: "charte.css", css: BASE }).find((rule) => rule.condition === null && rule.selectors.join("|") === ".dark[data-charte]|.dark [data-charte]")
        const covered = new Set([...declarationsOf(css, DARK), ...declarationsOf(css, BOTH)].map(([token]) => token))
        const missing = [...new Set(baseDark?.declarations.map((declaration) => declaration.token))].filter((token) => !covered.has(token))
        expect(missing.sort()).toEqual([...INHERITED_IN_DARK].sort())
      })

      for (const mode of MODES) {
        describe(mode, () => {
          it("une seule couleur d'identité : action, lien, focus, onglet actif et rail portent la même", () => {
            for (const token of ["--primary", "--primary-fill", "--accent", "--ring", "--sidebar-primary", "--status-active", "--info-500"]) {
              for (const nested of [false, true]) expect(toHex(color(mode, token, nested)), `${token}${nested ? " (portail)" : ""}`).toBe(identity[mode])
            }
          })

          it("fonds neutres et bouton secondaire gris", () => {
            for (const token of ["--background", "--card", "--popover", "--muted"]) {
              expect(chroma(color(mode, token)), token).toBeLessThanOrEqual(0.06)
            }
            if (mode === "clair") expect(luminance(mode, "--background")).toBeGreaterThanOrEqual(0.85)
            else expect(luminance(mode, "--background")).toBeLessThanOrEqual(0.02)
          })

          it.each(TEXT_PAIRS)("texte %s sur %s ≥ 4,5:1", (foreground, background) => {
            expect(ratio(mode, foreground, background)).toBeGreaterThanOrEqual(4.5)
          })

          it.each(NON_TEXT_PAIRS)("contour %s sur %s ≥ 3:1", (foreground, background) => {
            expect(ratio(mode, foreground, background)).toBeGreaterThanOrEqual(3)
          })

          it("titre de la couverture de repli lisible sur chaque arrêt du dégradé", () => {
            const stops = gradientStops(value(mode, "--esp-banner"))
            expect(stops).toHaveLength(2)
            for (const stop of stops) expect(contrastRatio(color(mode, "--esp-on-banner"), stop)).toBeGreaterThanOrEqual(4.5)
          })

          it("barre basse translucide : libellés lisibles sur le fond qui défile", () => {
            const bar = color(mode, "--esp-mobilebar-bg")
            for (const label of ["--foreground", "--muted-foreground", "--primary"]) {
              expect(contrastRatio(color(mode, label), bar, color(mode, "--background")), label).toBeGreaterThanOrEqual(4.5)
            }
          })

          it("un portail qui redéclare la charte résout exactement les jetons de <html>", () => {
            expect(cascade.resolveAll(node(mode, true))).toEqual(cascade.resolveAll(node(mode)))
          })
        })
      }

      it("clair : les cartes et le creux se distinguent du fond", () => {
        expect(ratio("clair", "--card", "--background")).toBeGreaterThanOrEqual(1.04)
        expect(ratio("clair", "--muted", "--card")).toBeGreaterThanOrEqual(1.08)
        expect(ratio("clair", "--primary-50", "--card")).toBeGreaterThanOrEqual(1.1)
      })

      it("sombre : carte relevée, surface élevée, creux et sélection au-dessus de la carte", () => {
        expect(luminance("sombre", "--card")).toBeGreaterThan(luminance("sombre", "--background"))
        expect(luminance("sombre", "--popover")).toBeGreaterThan(luminance("sombre", "--card"))
        expect(ratio("sombre", "--card", "--background")).toBeGreaterThanOrEqual(1.1)
        expect(ratio("sombre", "--popover", "--card")).toBeGreaterThanOrEqual(1.1)
        expect(luminance("sombre", "--muted")).toBeGreaterThan(luminance("sombre", "--card"))
        expect(luminance("sombre", "--primary-50")).toBeGreaterThan(luminance("sombre", "--popover"))
        expect(ratio("sombre", "--primary-50", "--card")).toBeGreaterThanOrEqual(1.2)
      })

      it("géométrie, polices et liens soulignés de la charte d'origine ; aucune ressource externe", () => {
        for (const mode of MODES) {
          for (const token of ["--radius-xl", "--rp-surface-radius", "--body-font-size", "--font-sans", "--font-display", "--esp-inline-link-decoration"]) {
            expect(value(mode, token), `${mode} ${token}`).toBe(new TokenCascade([...BASE_SHEETS, { name: "antsia.css", css: ORIGINAL }]).resolve({ charte: "antsia", dark: mode === "sombre", nested: false }, token))
          }
        }
        expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/@import|@font-face|url\(|prefers-color-scheme/)
      })

      it("voile des surfaces superposées : l'encre du thème à 55 %", () => {
        const ink = color("clair", "--foreground")
        for (const mode of MODES) {
          const scrim = color(mode, "--ui2-scrim")
          expect(toHex({ ...scrim, a: 1 }), mode).toBe(toHex(ink))
          expect(scrim.a, mode).toBeCloseTo(0.55, 5)
        }
      })
    })
  }
})
