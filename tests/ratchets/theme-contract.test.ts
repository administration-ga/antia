import { readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { declaredCustomProperties, usedCustomProperties } from "./lib/detectors"
import { isTestFile, listFiles, readRepoFile, REPO_ROOT, workspaceDirectories } from "./lib/source-files"

const CHARTE = "packages/ui/src/styles/charte.css"
const THEME_LAYER = "packages/ui/src/styles/theme.css"
const THEMES_DIR = "packages/ui/src/themes"
/** Espaces de noms des jetons générés par Tailwind v4 (thème et utilitaires). */
const TAILWIND_NAMESPACES = /^--(tw-|color-|spacing|font-|radius-|text-|container-|breakpoint-|shadow-|ease-|animate-|leading-|tracking-|default-)/

describe("theme-contract — un thème ne redéclare que les jetons de la charte de base", () => {
  const contract = declaredCustomProperties(readRepoFile(CHARTE))

  it("la charte de base déclare les trois familles (ui-v2, shadcn, --esp-*)", () => {
    for (const token of ["--primary-500", "--ink-900", "--primary-fill", "--on-fill", "--background", "--foreground", "--card", "--muted-foreground", "--ring", "--esp-surface-card", "--esp-shadow-card", "--font-sans", "--radius-md"]) {
      expect(contract.has(token), token).toBe(true)
    }
  })

  it("chaque thème vise son propre nœud et ne déclare que des jetons du contrat", () => {
    const problems: string[] = []
    for (const entry of readdirSync(join(REPO_ROOT, THEMES_DIR)).filter((name) => name.endsWith(".css"))) {
      const name = entry.replace(/\.css$/, "")
      const css = readRepoFile(`${THEMES_DIR}/${entry}`).replace(/\/\*[\s\S]*?\*\//g, "")
      for (const selector of css.matchAll(/([^{}]+)\{/g)) {
        const text = (selector[1] ?? "").trim()
        if (text.startsWith("@")) continue
        const valid = text.split(",").every((part) => {
          const sel = part.trim()
          return sel === `[data-charte="${name}"]` || sel === `.dark[data-charte="${name}"]` || sel === `.dark [data-charte="${name}"]`
        })
        if (!valid) problems.push(`${entry} : sélecteur « ${text} » hors de [data-charte="${name}"]`)
      }
      for (const token of declaredCustomProperties(css)) {
        if (!contract.has(token)) problems.push(`${entry} : ${token} n'appartient pas au contrat de la charte de base`)
      }
    }
    expect(problems).toEqual([])
  })

  it("aucun jeton fantôme : tout var(--x) lu par les écrans est déclaré quelque part", () => {
    const declared = new Set([...contract, ...declaredCustomProperties(readRepoFile(THEME_LAYER))])
    const directories = [...workspaceDirectories("apps"), ...workspaceDirectories("packages")].map((dir) => `${dir}/src`)
    const phantoms: string[] = []
    for (const file of listFiles(directories, [".ts", ".tsx", ".css"])) {
      if (isTestFile(file)) continue
      for (const token of usedCustomProperties(readRepoFile(file))) {
        if (!declared.has(token) && !TAILWIND_NAMESPACES.test(token)) phantoms.push(`${file} : ${token}`)
      }
    }
    expect(phantoms).toEqual([])
  })
})
