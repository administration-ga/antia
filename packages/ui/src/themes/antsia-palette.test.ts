// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  type ChartedNode,
  colorsIn,
  contrastRatio,
  gradientStops,
  parseColor,
  parseRules,
  relativeLuminance,
  type Rgba,
  TokenCascade,
  toHex,
} from "../tests/css-token-cascade"

/**
 * Charte ANTSIA « encre, ivoire et prune » (lot P01) telle que antsia.ga la
 * sert : `styles.css` (theme.css, charte.css, communication.css) puis
 * `themes/antsia.css`, cascade rejouée avec ses spécificités réelles, sur
 * <html> et sur un portail qui redéclare `data-charte`.
 *
 * Ce sont des contrastes CALCULÉS sur les jetons résolus (luminance relative
 * sRGB, WCAG 2.2) : ils ne remplacent pas la mesure du rendu dans le
 * navigateur (opacités, superpositions sur média, anticrénelage).
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const THEME = read("./antsia.css")
const BASE = read("../styles/charte.css")
const SHEETS = [
  { name: "theme.css", css: read("../styles/theme.css") },
  { name: "charte.css", css: BASE },
  { name: "communication.css", css: read("../styles/communication.css") },
  { name: "antsia.css", css: THEME },
] as const
const cascade = new TokenCascade(SHEETS)

type Mode = "clair" | "sombre"
const MODES: readonly Mode[] = ["clair", "sombre"]
const node = (mode: Mode, nested = false): ChartedNode => ({ charte: "antsia", dark: mode === "sombre", nested })

function value(mode: Mode, token: string, nested = false): string {
  const resolved = cascade.resolve(node(mode, nested), token)
  if (resolved === undefined) throw new Error(`${token} ne se résout pas en ${mode}`)
  return resolved
}

function color(mode: Mode, token: string, nested = false): Rgba {
  const parsed = parseColor(value(mode, token, nested))
  if (!parsed) throw new Error(`${token} n'est pas une couleur en ${mode} : ${value(mode, token, nested)}`)
  return parsed
}

const ratio = (mode: Mode, foreground: string, background: string) =>
  contrastRatio(color(mode, foreground), color(mode, background), color(mode, "--background"))
const luminance = (mode: Mode, token: string) => relativeLuminance(color(mode, token))

/** 03 §2 : chaque rôle de la palette et les jetons de chaque famille qui le portent. */
const PALETTE: readonly { role: string; clair: string; sombre: string; tokens: readonly string[] }[] = [
  { role: "fond page", clair: "#ffffff", sombre: "#141419", tokens: ["--background", "--background-dashboard", "--ink-100"] },
  { role: "surface carte", clair: "#f7f6f2", sombre: "#202026", tokens: ["--card", "--esp-surface-card", "--secondary", "--ink-0", "--sidebar"] },
  { role: "surface élevée", clair: "#ffffff", sombre: "#2a2a33", tokens: ["--popover", "--ink-50", "--esp-surface-raised"] },
  { role: "texte principal", clair: "#1f2024", sombre: "#f7f6f2", tokens: ["--foreground", "--card-foreground", "--popover-foreground", "--sidebar-foreground", "--ink-900", "--ink-800", "--ink-700"] },
  { role: "texte secondaire", clair: "#62636b", sombre: "#b9b7c0", tokens: ["--muted-foreground", "--secondary-foreground", "--sidebar-muted", "--ink-600", "--ink-500", "--ink-400"] },
  { role: "action et lien", clair: "#8b2f73", sombre: "#edadd8", tokens: ["--primary", "--primary-fill", "--primary-500", "--accent", "--sidebar-primary", "--info-500", "--status-active"] },
  { role: "texte sur action", clair: "#ffffff", sombre: "#24101f", tokens: ["--primary-foreground", "--on-fill", "--accent-foreground", "--sidebar-primary-foreground"] },
  { role: "séparateur", clair: "#dedce2", sombre: "#3c3a44", tokens: ["--border", "--ink-200", "--sidebar-border", "--esp-mobilebar-border"] },
  { role: "contour de contrôle", clair: "#7b7780", sombre: "#8f8998", tokens: ["--input", "--ink-300"] },
  { role: "focus", clair: "#8b2f73", sombre: "#edadd8", tokens: ["--ring", "--sidebar-ring", "--outline-ring"] },
  { role: "succès", clair: "#14704a", sombre: "#83d5ab", tokens: ["--success", "--success-fill", "--success-500", "--esp-green-strong", "--status-archived"] },
  { role: "danger", clair: "#b4233f", sombre: "#ffacb9", tokens: ["--destructive", "--danger-fill", "--danger-500", "--status-error"] },
]

/** Texte (≥ 4,5:1) : [premier plan, fond, où l'écran les associe]. */
const TEXT_PAIRS: readonly (readonly [string, string, string])[] = [
  ["--foreground", "--background", "texte du document"],
  ["--card-foreground", "--card", "auteur, titre et corps d'une carte"],
  ["--popover-foreground", "--popover", "menu, feuille, dialogue"],
  ["--foreground", "--muted", "encart et survol"],
  ["--muted-foreground", "--background", "date, aide sur le fond"],
  ["--muted-foreground", "--card", "date, aide dans une carte"],
  ["--muted-foreground", "--popover", "aide dans un menu"],
  ["--muted-foreground", "--muted", "aide dans un encart"],
  ["--secondary-foreground", "--secondary", "carte du kit (FlatCard)"],
  ["--primary", "--background", "lien sur le fond"],
  ["--primary", "--card", "lien dans une carte"],
  ["--primary", "--popover", "lien dans un menu"],
  ["--primary", "--muted", "lien dans un encart"],
  ["--primary-foreground", "--primary", "bouton plein (shadcn)"],
  ["--on-fill", "--primary-fill", "bouton plein (ui-v2), bulle envoyée"],
  ["--on-fill", "--primary-fill-hover", "bouton plein survolé"],
  ["--accent-foreground", "--accent", "onglet actif, rangée choisie"],
  ["--on-fill", "--primary-600", "aplat d'accent d'iCom"],
  ["--on-fill", "--danger-fill", "bouton de danger, enregistrement"],
  ["--on-fill", "--danger-fill-hover", "bouton de danger survolé"],
  ["--on-fill", "--success-fill", "bouton de succès"],
  ["--on-fill", "--success-fill-hover", "bouton de succès survolé"],
  ["--on-fill", "--success", "décrocher un appel"],
  ["--on-fill", "--esp-green-strong", "« Créer un compte » de l'accueil"],
  ["--destructive-foreground", "--destructive", "raccrocher, pastille de non-lus"],
  ["--background", "--destructive", "pastille d'appel manqué"],
  ["--success", "--background", "confirmation sur le fond"],
  ["--success", "--card", "confirmation dans une carte"],
  ["--success", "--popover", "confirmation dans un menu"],
  ["--destructive", "--background", "erreur sur le fond"],
  ["--destructive", "--card", "erreur de formulaire dans une carte"],
  ["--destructive", "--popover", "erreur dans un menu"],
  ["--danger-500", "--ink-0", "astérisque et erreur de champ"],
  ["--danger-600", "--ink-0", "action grave d'un menu"],
  ["--danger-600", "--danger-50", "badge de danger"],
  ["--danger-700", "--danger-50", "action sensible d'iCom"],
  ["--success-600", "--success-50", "badge et alerte de succès"],
  ["--success-600", "--status-archived-bg", "badge archivé"],
  ["--primary-500", "--ink-0", "lien ui-v2 dans une carte"],
  ["--primary-600", "--ink-0", "libellé actif dans une carte"],
  ["--primary-600", "--background", "libellé actif sur le fond"],
  ["--primary-700", "--ink-0", "texte d'accent fort"],
  ["--primary-600", "--primary-50", "badge primaire, rangée sélectionnée"],
  ["--primary-700", "--primary-50", "texte sur la sélection"],
  ["--primary-700", "--primary-100", "sélection appuyée"],
  ["--primary-800", "--primary-100", "filtre choisi d'iCom"],
  ["--foreground", "--primary-50", "option choisie"],
  ["--info-600", "--info-50", "badge et alerte d'information"],
  ["--primary-600", "--status-active-bg", "badge actif"],
  ["--esp-accent-deep", "--esp-accent-soft", "élément de navigation actif"],
  ["--sidebar-accent-foreground", "--sidebar-accent", "rail actif"],
  ["--sidebar-foreground", "--sidebar", "rail"],
  ["--ink-900", "--ink-0", "texte ui-v2 dans une carte"],
  ["--ink-900", "--ink-100", "bulle reçue d'iCom"],
  ["--ink-800", "--ink-0", "libellé de champ, bouton outline"],
  ["--ink-700", "--ink-0", "texte riche"],
  ["--ink-600", "--ink-0", "méta ui-v2"],
  ["--ink-600", "--ink-100", "méta sur une puce"],
  ["--ink-600", "--ink-50", "méta en surface élevée"],
  ["--ink-500", "--ink-0", "horodatage"],
  ["--ink-400", "--ink-0", "ligne compacte de notification"],
  ["--ink-400", "--popover", "ligne compacte dans la cloche"],
  ["--ink-600", "--ink-150", "vignette d'album vide"],
  ["--ink-700", "--ink-150", "badge neutre"],
  ["--ink-700", "--status-semi-bg", "badge partiel"],
  ["--ink-600", "--status-inactive-bg", "badge inactif"],
  ["--muted-foreground", "--esp-neutral-chip", "bouton de la cloche"],
]

/** Non textuel (≥ 3:1, WCAG 1.4.11) : contours de contrôle, anneaux de focus, pastilles. */
const NON_TEXT_PAIRS: readonly (readonly [string, string, string])[] = [
  ["--input", "--background", "champ sur le fond"],
  ["--input", "--card", "champ dans une carte"],
  ["--input", "--popover", "champ dans une feuille"],
  ["--input", "--muted", "champ dans un encart"],
  ["--ink-300", "--ink-0", "champ et bouton outline ui-v2"],
  ["--ink-300", "--ink-100", "champ ui-v2 sur le fond"],
  ["--ink-400", "--ink-0", "case à cocher, bouton radio"],
  ["--ring", "--background", "focus sur le fond"],
  ["--ring", "--card", "focus dans une carte"],
  ["--ring", "--popover", "focus dans un menu"],
  ["--ring", "--muted", "focus dans un encart"],
  ["--outline-ring", "--background", "anneau du navigateur sur le fond"],
  ["--outline-ring", "--card", "anneau du navigateur dans une carte"],
  ["--outline-ring", "--popover", "anneau du navigateur dans un menu"],
  ["--primary-300", "--background", "anneau 3 px (réactions, commentaires)"],
  ["--primary-300", "--card", "anneau 3 px dans une carte"],
  ["--primary-300", "--popover", "anneau 3 px dans un menu"],
  ["--primary-400", "--card", "anneau du carrousel"],
  ["--primary-400", "--background", "anneau du carrousel sur le fond"],
  ["--primary-fill", "--card", "limite d'un bouton plein"],
  ["--warning", "--card", "pastille d'attente (ambre de la base)"],
]

/** Rôles du bloc sombre de la base qu'ANTSIA garde tels quels, à dessein. */
const INHERITED_IN_DARK = new Set([
  // Ambre d'avertissement, tons de compteur et séries de graphique : catégoriels, mesurés par la base.
  "--warning", "--warning-light", "--warning-50", "--warning-100", "--warning-500", "--warning-600",
  "--status-destruct", "--status-destruct-bg",
  "--accent-orange", "--accent-yellow", "--accent-blue",
  "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--esp-tone-blue", "--esp-tone-blue-bg", "--esp-tone-amber", "--esp-tone-amber-bg",
  "--esp-tone-rose", "--esp-tone-rose-bg", "--esp-tone-green", "--esp-tone-green-bg",
  // Valeurs de la base posées sur les primitives réaccordées (carte et filet charbon).
  "--esp-mobilebar-bg", "--esp-mobilebar-shadow", "--esp-shadow-card", "--border-light",
  // Sélecteur de comptes de l'espace agent : absent du réseau.
  "--esp-segment-on", "--esp-segment-on-fg",
])

/**
 * Seuls ces jetons peuvent encore porter un bleu : primitives de la base que
 * plus aucun rôle d'ANTSIA ne lit, tons et séries catégoriels, et la palette
 * des avatars (identique dans tous les thèmes : elle identifie une personne).
 */
const BLUE_ALLOWED = /^--(esp-blue.*|esp-on-blue|esp-night-accent-.*|accent-blue|chart-2|esp-tone-blue.*|esp-ava-\d)$/

/** Teinte franchement bleue (HSL) : les neutres froids de l'encre restent sous 0,3 de saturation. */
function isBlue(rgba: Rgba): boolean {
  const max = Math.max(rgba.r, rgba.g, rgba.b)
  const min = Math.min(rgba.r, rgba.g, rgba.b)
  const delta = max - min
  const lightness = (max + min) / 2
  if (rgba.a === 0 || delta === 0 || lightness <= 0.03 || lightness >= 0.98) return false
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  const sector = max === rgba.r ? ((rgba.g - rgba.b) / delta + 6) % 6 : max === rgba.g ? (rgba.b - rgba.r) / delta + 2 : (rgba.r - rgba.g) / delta + 4
  const hue = sector * 60
  return saturation >= 0.3 && hue >= 185 && hue <= 255
}

const themeRules = parseRules({ name: "antsia.css", css: THEME })
const LIGHT_ONLY = ['[data-charte="antsia"]']
const DARK_ONLY = ['.dark[data-charte="antsia"]', '.dark [data-charte="antsia"]']
const BOTH = [...LIGHT_ONLY, ...DARK_ONLY]
const keysOf = (selectors: readonly string[]) =>
  new Set(themeRules.filter((rule) => rule.selectors.join("|") === selectors.join("|")).flatMap((rule) => rule.declarations.map((declaration) => declaration.token)))

describe("charte ANTSIA servie par le moteur — cascade base + thème", () => {
  it("le thème a trois blocs : clair, sombre et commun aux deux, sans recouvrement", () => {
    expect(themeRules.map((rule) => rule.selectors)).toEqual([LIGHT_ONLY, DARK_ONLY, BOTH])
    const [light, dark, both] = [keysOf(LIGHT_ONLY), keysOf(DARK_ONLY), keysOf(BOTH)]
    expect([...both].filter((token) => light.has(token) || dark.has(token))).toEqual([])
  })

  it("le sombre redéclare chaque rôle du bloc sombre de la base, sauf les héritages listés", () => {
    const baseDark = parseRules({ name: "charte.css", css: BASE }).find((rule) => rule.condition === null && rule.selectors.join("|") === ".dark[data-charte]|.dark [data-charte]")
    const baseDarkKeys = new Set(baseDark?.declarations.map((declaration) => declaration.token))
    expect(baseDarkKeys.size).toBeGreaterThan(100)
    const covered = new Set([...keysOf(DARK_ONLY), ...keysOf(BOTH)])
    expect([...baseDarkKeys].filter((token) => !covered.has(token)).sort()).toEqual([...INHERITED_IN_DARK].sort())
  })

  for (const mode of MODES) {
    describe(`thème ${mode}`, () => {
      it.each(PALETTE)("$role : la palette 03 §2 portée par chaque famille, sur <html> et dans un portail", (entry) => {
        for (const token of entry.tokens) {
          for (const nested of [false, true]) {
            expect(toHex(color(mode, token, nested)), `${token}${nested ? " (portail)" : ""}`).toBe(entry[mode])
          }
        }
      })

      it.each(TEXT_PAIRS)("texte %s sur %s ≥ 4,5:1 (%s)", (foreground, background) => {
        expect(ratio(mode, foreground, background)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(NON_TEXT_PAIRS)("contour %s sur %s ≥ 3:1 (%s)", (foreground, background) => {
        expect(ratio(mode, foreground, background)).toBeGreaterThanOrEqual(3)
      })

      it("titre blanc sur chaque arrêt de la couverture de repli ≥ 4,5:1", () => {
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

      it("plus aucun bleu : la dominante d'action est la prune, partout hors tons catégoriels", () => {
        // Toute couleur d'une valeur, y compris dans une ombre ou un dégradé.
        const blueTokens = (resolved: Map<string, string>) =>
          [...resolved].filter(([token, raw]) => !BLUE_ALLOWED.test(token) && colorsIn(raw).some(isBlue))
        // Test du test : sans le thème, la base est bleue (action, focus, sélection, voile, ombres).
        const base = new TokenCascade(SHEETS.slice(0, 3))
        const baseBlue = blueTokens(base.resolveAll({ charte: "antsia", dark: mode === "sombre", nested: false })).map(([token]) => token)
        expect(baseBlue).toEqual(expect.arrayContaining(["--primary", "--ring", "--primary-fill", "--accent", "--ui2-scrim", "--icom-float-drag-shadow"]))
        if (mode === "clair") expect(baseBlue).toEqual(expect.arrayContaining(["--shadow-xs", "--shadow-xl"]))
        expect(blueTokens(cascade.resolveAll(node(mode)))).toEqual([])
      })
    })
  }

  it("clair : fond blanc, cartes beige d'un cran, creux ivoire sous la carte, menus blancs", () => {
    expect(luminance("clair", "--background")).toBeGreaterThan(luminance("clair", "--card"))
    expect(ratio("clair", "--card", "--background")).toBeGreaterThanOrEqual(1.05)
    expect(ratio("clair", "--card", "--background")).toBeLessThanOrEqual(1.15)
    expect(luminance("clair", "--muted")).toBeLessThan(luminance("clair", "--card"))
    expect(ratio("clair", "--muted", "--card")).toBeGreaterThanOrEqual(1.08)
    expect(ratio("clair", "--primary-50", "--card")).toBeGreaterThanOrEqual(1.1)
  })

  it("sombre : charbon, carte relevée, surface élevée et sélection au-dessus de la carte", () => {
    expect(luminance("sombre", "--card")).toBeGreaterThan(luminance("sombre", "--background"))
    expect(luminance("sombre", "--popover")).toBeGreaterThan(luminance("sombre", "--card"))
    expect(ratio("sombre", "--card", "--background")).toBeGreaterThanOrEqual(1.1)
    expect(ratio("sombre", "--popover", "--card")).toBeGreaterThanOrEqual(1.1)
    // Survol et encart se lèvent ; la sélection se lit sans contour, même dans un menu.
    expect(luminance("sombre", "--muted")).toBeGreaterThan(luminance("sombre", "--card"))
    expect(luminance("sombre", "--primary-50")).toBeGreaterThan(luminance("sombre", "--popover"))
    expect(ratio("sombre", "--primary-50", "--card")).toBeGreaterThanOrEqual(1.2)
  })

  it("voile des surfaces superposées : l'encre du texte principal à 55 %, dans les deux thèmes", () => {
    const ink = color("clair", "--foreground")
    for (const mode of MODES) {
      const scrim = color(mode, "--ui2-scrim")
      expect(toHex({ ...scrim, a: 1 }), mode).toBe(toHex(ink))
      expect(scrim.a, mode).toBeCloseTo(0.55, 5)
    }
  })

  it("rayons : 12 px cartes et champs, 16 px feuilles, pilule intacte", () => {
    for (const token of ["--radius", "--radius-md", "--radius-lg", "--radius-xl"]) expect(value("clair", token), token).toBe("12px")
    expect(value("clair", "--radius-2xl")).toBe("16px")
    expect(value("sombre", "--radius-xl")).toBe("12px")
    expect(value("clair", "--esp-r-chrome")).toBe("999px")
  })

  it("cartes du fil (lot P03, D1) : le rayon des surfaces du réseau suit les cartes, 12 px dans les deux thèmes", () => {
    for (const mode of MODES) {
      for (const nested of [false, true]) expect(value(mode, "--rp-surface-radius", nested), mode).toBe("12px")
    }
  })

  it("surfaces élevées des publications (lot P03, D3) : menus, feuilles et dialogues peints en surface élevée", () => {
    // Les expressions EXACTES des six sites (garde de source dans `themes-isolation.test.ts`).
    const sites = [
      "var(--esp-surface-raised, var(--esp-surface-card, var(--secondary)))",
      "var(--esp-surface-raised, var(--ink-0))",
      "var(--esp-surface-raised, var(--background))",
      "var(--esp-surface-raised, var(--card))",
    ]
    const raised = PALETTE.find((entry) => entry.role === "surface élevée")!
    for (const mode of MODES) {
      for (const nested of [false, true]) {
        for (const site of sites) {
          const resolved = cascade.resolveValue(node(mode, nested), site)
          expect(resolved, `${mode} ${site}`).toBeDefined()
          expect(toHex(parseColor(resolved!)!), `${mode}${nested ? " (portail)" : ""} ${site}`).toBe(raised[mode])
        }
      }
      // Le texte des menus et feuilles reste lisible sur cette surface.
      expect(ratio(mode, "--popover-foreground", "--esp-surface-raised")).toBeGreaterThanOrEqual(4.5)
      expect(ratio(mode, "--ink-600", "--esp-surface-raised")).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("liens du texte courant (lot P03, D5) : soulignés, la couleur seule ne les distinguant pas du texte (< 3:1)", () => {
    for (const mode of MODES) {
      expect(value(mode, "--esp-inline-link-decoration"), mode).toBe("underline")
      // RichText : liens en `--primary-600`, texte courant en `--ink-700`.
      expect(ratio(mode, "--primary-600", "--ink-700"), mode).toBeLessThan(3)
      // Le lien lui-même reste lisible sur la carte.
      expect(ratio(mode, "--primary-600", "--card"), mode).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("aucune police ni infrastructure d'apparence ajoutée : Inter et le choix système/clair/sombre existant", () => {
    expect(value("clair", "--font-sans").startsWith('"Inter"')).toBe(true)
    expect(value("sombre", "--font-sans")).toBe(value("clair", "--font-sans"))
    expect(THEME.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/@import|@font-face|url\(|prefers-color-scheme/)
  })

  it("corps de texte à 16 px dans les deux thèmes (03 §3), interligne de la couche de base inchangé", () => {
    for (const mode of MODES) expect(value(mode, "--body-font-size"), mode).toBe("16px")
    expect(read("../styles/theme.css")).toMatch(/font-size: var\(--body-font-size, 15px\);\s*line-height: 1\.5;/)
  })

  it("titres : la première face de `--font-display` est celle que `styles.css` importe réellement", () => {
    const imported = /@import "(@fontsource-variable\/familjen-grotesk)";/.exec(read("../styles.css"))?.[1]
    expect(imported).toBe("@fontsource-variable/familjen-grotesk")
    const faces = new Set([...read(`../../node_modules/${imported}/index.css`).matchAll(/font-family: '([^']+)'/g)].map((match) => match[1]))
    for (const mode of MODES) {
      const first = /^"([^"]+)"/.exec(value(mode, "--font-display"))?.[1]
      expect(first, mode).toBe("Familjen Grotesk Variable")
      expect(faces.has(first), mode).toBe(true)
    }
  })

  it("ombres : l'encre en clair (mêmes géométries et opacités que la base), les ombres noires de la base en sombre", () => {
    const base = new TokenCascade(SHEETS.slice(0, 3))
    const shape = (raw: string) => raw.replace(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi, "C")
    const ink = color("clair", "--foreground")
    for (const token of ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--icom-float-drag-shadow"]) {
      const antsia = value("clair", token)
      const reference = base.resolve({ charte: "antsia", dark: false, nested: false }, token) ?? ""
      expect(shape(antsia), token).toBe(shape(reference))
      expect(colorsIn(antsia).map((part) => part.a), token).toEqual(colorsIn(reference).map((part) => part.a))
      for (const part of colorsIn(antsia)) expect(toHex({ ...part, a: 1 }), token).toBe(toHex(ink))
    }
    for (const token of ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl"]) {
      expect(value("sombre", token), token).toBe(base.resolve({ charte: "antsia", dark: true, nested: false }, token))
    }
  })
})
