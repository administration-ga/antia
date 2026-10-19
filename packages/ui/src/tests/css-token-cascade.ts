/**
 * Cascade des jetons de charte, rejouée hors navigateur (outil de test, P01).
 *
 * Les feuilles du moteur sont lues telles que les applications les importent
 * (`styles.css` : theme.css, charte.css, communication.css ; puis le thème de
 * l'application). Le modèle couvre ce qui décide de la valeur d'un jeton sur le
 * nœud de charte :
 *   - `<html data-charte="X" class="dark?">`, qui porte la charte et le thème ;
 *   - un nœud portalisé qui REDÉCLARE `data-charte="X"` (dock iCom, appel,
 *     stories, carte flottante) : `.dark [data-charte…]` le vise, pas
 *     `.dark[data-charte…]`. Un portail sans `data-charte` hérite de `<html>`.
 * Sélecteurs reconnus : `:root`, `[data-charte]`, `[data-charte="X"]`, et leurs
 * formes `.dark…` composée ou descendante. Spécificité, ordre des feuilles,
 * `!important`, héritage et substitution `var()` (repli, cycle) suivent CSS,
 * ainsi que `initial` (valeur garantie invalide, qui fait jouer le repli — P03).
 * Les règles sous `@media`, `@supports`, `@layer` ou `@container` sont lues mais
 * non appliquées : le modèle est celui du bureau sans préférence de mouvement,
 * et une règle en couche perd toujours contre ces règles hors couche.
 */

/** Une feuille, nommée pour les messages d'échec. */
export interface StyleSheetSource {
  name: string
  css: string
}

/** Le nœud dont on résout les jetons. */
export interface ChartedNode {
  charte: string
  dark: boolean
  /** `true` : nœud portalisé qui redéclare `data-charte` sous `<html>`. */
  nested: boolean
}

export interface TokenDeclaration {
  token: string
  value: string
  important: boolean
}

export interface CssRule {
  sheet: string
  /** Sélecteurs normalisés (espaces réduits). */
  selectors: string[]
  declarations: TokenDeclaration[]
  /** Règle conditionnelle ou couche englobante ; `null` au premier niveau. */
  condition: string | null
  order: number
}

interface Candidate extends TokenDeclaration {
  specificity: number
  order: number
  sheet: string
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

/** Index du caractère qui ferme la chaîne ouverte en `start`. */
function skipString(text: string, start: number): number {
  const quote = text[start]
  let index = start + 1
  while (index < text.length && text[index] !== quote) index += text[index] === "\\" ? 2 : 1
  return index
}

/** Découpe `text` sur `separator` hors parenthèses et hors chaînes. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' || char === "'") index = skipString(text, index)
    else if (char === "(") depth++
    else if (char === ")") depth--
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index))
      start = index + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

function parseDeclarations(body: string): TokenDeclaration[] {
  const declarations: TokenDeclaration[] = []
  for (const chunk of splitTopLevel(body, ";")) {
    const colon = chunk.indexOf(":")
    if (colon < 0) continue
    const token = chunk.slice(0, colon).trim()
    if (!token.startsWith("--")) continue
    let value = chunk.slice(colon + 1).trim().replace(/\s+/g, " ")
    const important = /!\s*important$/i.test(value)
    if (important) value = value.replace(/!\s*important$/i, "").trim()
    declarations.push({ token, value, important })
  }
  return declarations
}

/** Règles d'une feuille, dans l'ordre du texte, conditions comprises. */
export function parseRules(sheet: StyleSheetSource, firstOrder = 0): CssRule[] {
  const rules: CssRule[] = []
  let order = firstOrder
  const walk = (text: string, condition: string | null) => {
    let index = 0
    while (index < text.length) {
      let cursor = index
      while (cursor < text.length && !"{};".includes(text[cursor] ?? "")) {
        if (text[cursor] === '"' || text[cursor] === "'") cursor = skipString(text, cursor)
        cursor++
      }
      if (cursor >= text.length) return
      const prelude = text.slice(index, cursor).trim()
      if (text[cursor] !== "{") {
        // Instruction (`@import`, `@custom-variant`) ou accolade orpheline.
        index = cursor + 1
        continue
      }
      let depth = 1
      let end = cursor + 1
      while (end < text.length && depth > 0) {
        const char = text[end]
        if (char === '"' || char === "'") end = skipString(text, end)
        else if (char === "{") depth++
        else if (char === "}") depth--
        end++
      }
      const body = text.slice(cursor + 1, end - 1)
      if (prelude.startsWith("@")) {
        if (/^@(media|supports|layer|container)\b/.test(prelude)) walk(body, prelude.replace(/\s+/g, " "))
        // `@keyframes`, `@theme`, `@font-face` : aucun jeton de charte.
      } else {
        rules.push({
          sheet: sheet.name,
          selectors: splitTopLevel(prelude, ",").map((selector) => selector.trim().replace(/\s+/g, " ")),
          declarations: parseDeclarations(body),
          condition,
          order: order++,
        })
      }
      index = end
    }
  }
  walk(stripComments(sheet.css), null)
  return rules
}

const CHARTE_SELECTOR = /^(:root|(\.dark)?( )?\[data-charte(?:="([^"]+)")?\])$/

/** Spécificité (classes + attributs + pseudo-classes, ×10) si le sélecteur vise le nœud. */
export function selectorSpecificity(selector: string, node: ChartedNode): number | null {
  const match = CHARTE_SELECTOR.exec(selector)
  if (!match) return null
  if (match[1] === ":root") return node.nested ? null : 10
  const dark = match[2] !== undefined
  const descendant = match[3] !== undefined
  const charte = match[4]
  if (charte !== undefined && charte !== node.charte) return null
  if (!dark) return descendant ? null : 10
  if (!node.dark) return null
  // `.dark[data-charte]` vise <html> ; `.dark [data-charte]` vise un nœud sous lui.
  if (descendant !== node.nested) return null
  return 20
}

const HTML = (node: ChartedNode): ChartedNode => ({ ...node, nested: false })

/** La cascade complète d'une liste de feuilles, pour un nœud donné. */
export class TokenCascade {
  readonly rules: readonly CssRule[]
  private readonly winners = new Map<string, Map<string, Candidate>>()

  constructor(sheets: readonly StyleSheetSource[]) {
    const rules: CssRule[] = []
    for (const sheet of sheets) rules.push(...parseRules(sheet, rules.length))
    this.rules = rules
  }

  /** Déclarations gagnantes posées SUR le nœud (sans héritage). */
  declared(node: ChartedNode): Map<string, Candidate> {
    const key = `${node.charte}|${node.dark}|${node.nested}`
    const cached = this.winners.get(key)
    if (cached) return cached
    const winners = new Map<string, Candidate>()
    for (const rule of this.rules) {
      if (rule.condition !== null) continue
      let specificity: number | null = null
      for (const selector of rule.selectors) {
        const candidate = selectorSpecificity(selector, node)
        if (candidate !== null && (specificity === null || candidate > specificity)) specificity = candidate
      }
      if (specificity === null) continue
      for (const declaration of rule.declarations) {
        const current = winners.get(declaration.token)
        const next: Candidate = { ...declaration, specificity, order: rule.order, sheet: rule.sheet }
        if (!current || outranks(next, current)) winners.set(declaration.token, next)
      }
    }
    this.winners.set(key, winners)
    return winners
  }

  /**
   * Valeur calculée du jeton sur le nœud (`var()` substitués), ou `undefined`
   * si elle est invalide (référence absente sans repli, cycle) ou jamais posée.
   */
  resolve(node: ChartedNode, token: string): string | undefined {
    return this.compute(node, token, new Set())
  }

  /**
   * Valeur calculée d'une EXPRESSION arbitraire sur le nœud — telle qu'un
   * écran l'écrit (`var(--esp-surface-raised, var(--ink-0))`), replis compris
   * (lot P03) ; `undefined` si elle est invalide.
   */
  resolveValue(node: ChartedNode, value: string): string | undefined {
    return this.substitute(node, value, new Set())
  }

  /** Tous les jetons visibles sur le nœud (posés ou hérités de `<html>`). */
  resolveAll(node: ChartedNode): Map<string, string> {
    const tokens = new Set(this.declared(node).keys())
    if (node.nested) for (const token of this.declared(HTML(node)).keys()) tokens.add(token)
    const resolved = new Map<string, string>()
    for (const token of [...tokens].sort()) {
      const value = this.resolve(node, token)
      if (value !== undefined) resolved.set(token, value)
    }
    return resolved
  }

  private compute(node: ChartedNode, token: string, visiting: Set<string>): string | undefined {
    const declaration = this.declared(node).get(token)
    if (!declaration) return node.nested ? this.compute(HTML(node), token, new Set()) : undefined
    // `--x: initial` pose la valeur GARANTIE INVALIDE (CSS Variables §2.2) : le
    // jeton n'a pas de valeur et un `var(--x, repli)` prend son repli (lot P03).
    if (declaration.value.trim().toLowerCase() === "initial") return undefined
    if (visiting.has(token)) return undefined
    const next = new Set(visiting).add(token)
    return this.substitute(node, declaration.value, next)
  }

  private substitute(node: ChartedNode, value: string, visiting: Set<string>): string | undefined {
    let output = ""
    let index = 0
    while (index < value.length) {
      const start = value.indexOf("var(", index)
      if (start < 0) {
        output += value.slice(index)
        break
      }
      output += value.slice(index, start)
      let depth = 1
      let end = start + 4
      while (end < value.length && depth > 0) {
        if (value[end] === "(") depth++
        else if (value[end] === ")") depth--
        end++
      }
      const inner = value.slice(start + 4, end - 1)
      const [name = "", ...fallbackParts] = splitTopLevel(inner, ",")
      const fallback = fallbackParts.length > 0 ? fallbackParts.join(",").trim() : undefined
      const referenced = this.compute(node, name.trim(), visiting)
      const replacement = referenced ?? (fallback !== undefined ? this.substitute(node, fallback, visiting) : undefined)
      if (replacement === undefined) return undefined
      output += replacement
      index = end
    }
    return output.trim().replace(/\s+/g, " ")
  }
}

function outranks(next: Candidate, current: Candidate): boolean {
  if (next.important !== current.important) return next.important
  if (next.specificity !== current.specificity) return next.specificity > current.specificity
  return next.order > current.order
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs et contrastes (WCAG 2.2, luminance relative sRGB)
// ─────────────────────────────────────────────────────────────────────────────

/** Couleur sRGB, composantes et alpha dans [0, 1]. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const NAMED: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
}

function parseHex(hex: string): Rgba | undefined {
  const digits = hex.slice(1)
  if (![3, 4, 6, 8].includes(digits.length) || !/^[0-9a-f]+$/i.test(digits)) return undefined
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits
  const channel = (offset: number) => parseInt(full.slice(offset, offset + 2), 16) / 255
  return { r: channel(0), g: channel(2), b: channel(4), a: full.length === 8 ? channel(6) : 1 }
}

function parseRgbFunction(value: string): Rgba | undefined {
  const match = /^rgba?\((.*)\)$/i.exec(value)
  if (!match?.[1]) return undefined
  const [channels = "", alphaPart] = match[1].includes("/") ? match[1].split("/") : [match[1], undefined]
  const parts = channels.split(/[\s,]+/).filter(Boolean)
  const alphaText = alphaPart?.trim() ?? (parts.length === 4 ? parts.pop() : undefined)
  if (parts.length !== 3) return undefined
  const [r, g, b] = parts.map((part) => (part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / 255))
  const a = alphaText === undefined ? 1 : alphaText.endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText)
  if ([r, g, b, a].some((channel) => channel === undefined || Number.isNaN(channel))) return undefined
  return { r: r!, g: g!, b: b!, a }
}

/** `hsl(h, s%, l%)`, `hsl(h s% l% / a)` (sonner écrit sa palette ainsi). */
function parseHslFunction(value: string): Rgba | undefined {
  const match = /^hsla?\((.*)\)$/i.exec(value)
  if (!match?.[1]) return undefined
  const [channels = "", alphaPart] = match[1].includes("/") ? match[1].split("/") : [match[1], undefined]
  const parts = channels.split(/[\s,]+/).filter(Boolean)
  const alphaText = alphaPart?.trim() ?? (parts.length === 4 ? parts.pop() : undefined)
  if (parts.length !== 3) return undefined
  const hue = (((parseFloat(parts[0] ?? "") % 360) + 360) % 360) / 360
  const saturation = parseFloat(parts[1] ?? "") / 100
  const lightness = parseFloat(parts[2] ?? "") / 100
  const a = alphaText === undefined ? 1 : alphaText.endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText)
  if ([hue, saturation, lightness, a].some((channel) => Number.isNaN(channel))) return undefined
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  const channel = (offset: number) => {
    const t = (hue + offset + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return { r: channel(1 / 3), g: channel(0), b: channel(-1 / 3), a }
}

/** `color-mix(in srgb, A p%, B q%)`, alpha prémultiplié comme le navigateur. */
function parseColorMix(value: string): Rgba | undefined {
  const match = /^color-mix\((.*)\)$/i.exec(value)
  if (!match?.[1]) return undefined
  const [space = "", first = "", second = ""] = splitTopLevel(match[1], ",").map((part) => part.trim())
  if (space.replace(/\s+/g, " ") !== "in srgb") return undefined
  const component = (text: string) => {
    const percent = /\s(\d+(?:\.\d+)?)%$/.exec(text)
    return { color: parseColor(percent ? text.slice(0, percent.index) : text), weight: percent?.[1] ? parseFloat(percent[1]) / 100 : undefined }
  }
  const a = component(first)
  const b = component(second)
  if (!a.color || !b.color) return undefined
  let wa = a.weight ?? (b.weight !== undefined ? 1 - b.weight : 0.5)
  let wb = b.weight ?? 1 - wa
  const sum = wa + wb
  if (sum <= 0) return undefined
  const multiplier = Math.min(sum, 1)
  wa /= sum
  wb /= sum
  const alpha = a.color.a * wa + b.color.a * wb
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (key: "r" | "g" | "b") => (a.color![key] * a.color!.a * wa + b.color![key] * b.color!.a * wb) / alpha
  return { r: mix("r"), g: mix("g"), b: mix("b"), a: alpha * multiplier }
}

/** Couleur CSS résolue (hexadécimal, `rgb()`, `color-mix(in srgb…)`, mots-clés de base). */
export function parseColor(value: string): Rgba | undefined {
  const text = value.trim().toLowerCase()
  if (text in NAMED) return NAMED[text]
  if (text.startsWith("#")) return parseHex(text)
  if (text.startsWith("rgb")) return parseRgbFunction(text)
  if (text.startsWith("hsl")) return parseHslFunction(text)
  if (text.startsWith("color-mix(")) return parseColorMix(text)
  return undefined
}

/** Toutes les couleurs littérales d'une valeur composée (ombre, dégradé). */
export function colorsIn(value: string): Rgba[] {
  return [...value.matchAll(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi)]
    .map((match) => parseColor(match[0]))
    .filter((color): color is Rgba => color !== undefined)
}

/** Arrêts de couleur d'un `linear-gradient(…)` résolu. */
export function gradientStops(value: string): Rgba[] {
  const match = /^linear-gradient\((.*)\)$/i.exec(value.trim())
  if (!match?.[1]) return []
  return splitTopLevel(match[1], ",")
    .map((part) => part.trim().replace(/\s+-?\d+(?:\.\d+)?%$/, ""))
    .map((part) => parseColor(part))
    .filter((color): color is Rgba => color !== undefined)
}

/** Composition d'une couleur translucide sur un fond opaque. */
export function over(top: Rgba, below: Rgba): Rgba {
  const blend = (key: "r" | "g" | "b") => top[key] * top.a + below[key] * (1 - top.a)
  return { r: blend("r"), g: blend("g"), b: blend("b"), a: 1 }
}

export function relativeLuminance(color: Rgba): number {
  const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/** Rapport de contraste ; les couleurs translucides sont composées sur `base`. */
export function contrastRatio(foreground: Rgba, background: Rgba, base?: Rgba): number {
  const opaqueBackground = background.a < 1 && base ? over(background, base) : background
  const opaqueForeground = foreground.a < 1 ? over(foreground, opaqueBackground) : foreground
  const [light, dark] = [relativeLuminance(opaqueForeground), relativeLuminance(opaqueBackground)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

/** `#rrggbb` d'une couleur opaque (comparaison avec une palette écrite). */
export function toHex(color: Rgba): string {
  const channel = (value: number) => Math.round(value * 255).toString(16).padStart(2, "0")
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`
}
