// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { type ChartedNode, contrastRatio, parseColor, TokenCascade } from "../tests/css-token-cascade"
import { ANTSIA_THEME_IDS, antsiaCharteFor } from "./antsia-themes"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const base = ["theme", "charte", "communication"].map((name) => ({ name, css: read(`../styles/${name}.css`) }))
const fonts = { 24: "9.5px", 32: "11.5px", 40: "13px", 48: "15px", 64: "20px", 104: "32px" } as const
const avatarTokens = [
  ...Array.from({ length: 6 }, (_, index) => index + 1).flatMap((tone) => [`--esp-avatar-${tone}-bg`, `--esp-avatar-${tone}-fg`]),
  "--esp-avatar-neutral-bg", "--esp-avatar-neutral-fg",
  ...Object.keys(fonts).map((size) => `--esp-avatar-font-${size}`),
  "--esp-story-ring-seen-fill", "--esp-messages-heading-size",
]

describe("public avatar variants from the seven ANTSIA chartes", () => {
  it.each(ANTSIA_THEME_IDS)("%s keeps readable initials in both modes and portals", (id) => {
    const charte = antsiaCharteFor(id)
    const cascade = new TokenCascade([...base, { name: charte, css: read(`./${charte}.css`) }])
    for (const dark of [false, true]) for (const nested of [false, true]) {
      const node: ChartedNode = { charte, dark, nested }
      for (const tone of [1, 2, 3, 4, 5, 6, "neutral"]) {
        const background = parseColor(cascade.resolve(node, `--esp-avatar-${tone}-bg`) ?? "")
        const foreground = parseColor(cascade.resolve(node, `--esp-avatar-${tone}-fg`) ?? "")
        expect(background, `${id} avatar ${tone} background`).toBeDefined()
        expect(foreground, `${id} avatar ${tone} foreground`).toBeDefined()
        expect(contrastRatio(foreground!, background!), `${id} avatar ${tone}`).toBeGreaterThanOrEqual(4.5)
      }
      for (const [size, expected] of Object.entries(fonts)) expect(cascade.resolve(node, `--esp-avatar-font-${size}`)).toBe(expected)
      expect(cascade.resolve(node, "--esp-story-ring-fill")).toContain("from 200deg")
      expect(cascade.resolve(node, "--esp-story-ring-seen-fill")).toBe(cascade.resolve(node, "--border"))
      expect(cascade.resolve(node, "--esp-messages-heading-size")).toBe("22px")
      // The seen ring is decorative; the interactive focus remains distinct.
      const focus = parseColor(cascade.resolve(node, "--ring") ?? "")
      const page = parseColor(cascade.resolve(node, "--background") ?? "")
      expect(contrastRatio(focus!, page!), `${id} focus`).toBeGreaterThanOrEqual(3)
    }
  })

  it("preserves the historical avatar colors and font fallback outside ANTSIA", () => {
    const cascade = new TokenCascade(base)
    for (const charte of ["admin-antsia", "diasporale"]) for (const dark of [false, true]) {
      const node: ChartedNode = { charte, dark, nested: false }
      for (const token of avatarTokens) expect(cascade.resolve(node, token), token).toBeUndefined()
      expect(cascade.resolveValue(node, "var(--esp-avatar-1-bg, var(--primary-50))")).toBe(cascade.resolve(node, "--primary-50"))
      expect(cascade.resolveValue(node, "var(--esp-avatar-1-fg, var(--primary-600))")).toBe(cascade.resolve(node, "--primary-600"))
      expect(cascade.resolveValue(node, "var(--esp-avatar-font-104, 40px)")).toBe("40px")
    }
  })
})
