import { readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { flattenMessages } from "./lib/detectors"
import { listFiles, readRepoFile, REPO_ROOT } from "./lib/source-files"

/** Langues du moteur : le français fait foi, l'anglais porte exactement les mêmes clés. */
const LOCALES = ["fr", "en"] as const

type Catalog = Map<string, string>

function loadNamespaceSets(): Map<string, Map<string, Catalog>> {
  // racine des locales → langue → espace de noms → (clé → texte)
  const roots = new Map<string, Map<string, Catalog>>()
  for (const file of listFiles(["apps", "packages"], [".json"]).filter((path) => /\/i18n\/locales\/[a-z]{2}\/[^/]+\.json$/.test(path))) {
    const match = /^(.*\/i18n\/locales)\/([a-z]{2})\/([^/]+)\.json$/.exec(file)
    if (!match) continue
    const [, root = "", locale = "", namespace = ""] = match
    const key = `${root}::${namespace}`
    if (!roots.has(key)) roots.set(key, new Map())
    roots.get(key)?.set(locale, new Map(flattenMessages(JSON.parse(readRepoFile(file)) as unknown).map(({ key: k, text }) => [k, text])))
  }
  return roots
}

const interpolations = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort()

describe("i18n-locales — fr et en portent les mêmes clés, les mêmes variables", () => {
  const sets = loadNamespaceSets()

  it("chaque espace de noms existe dans les deux langues", () => {
    const missing: string[] = []
    for (const [key, byLocale] of sets) {
      for (const locale of LOCALES) if (!byLocale.has(locale)) missing.push(`${key} : langue ${locale} absente`)
    }
    expect(missing).toEqual([])
  })

  it("mêmes clés, aucun texte vide, mêmes variables d'interpolation", () => {
    const problems: string[] = []
    for (const [key, byLocale] of sets) {
      const fr = byLocale.get("fr") ?? new Map()
      const en = byLocale.get("en") ?? new Map()
      for (const k of fr.keys()) if (!en.has(k)) problems.push(`${key} : « ${k} » absente en anglais`)
      for (const k of en.keys()) if (!fr.has(k)) problems.push(`${key} : « ${k} » absente en français`)
      for (const [k, text] of [...fr, ...en]) if (text.trim() === "") problems.push(`${key} : « ${k} » vide`)
      for (const [k, text] of fr) {
        const other = en.get(k)
        if (other !== undefined && interpolations(text).join() !== interpolations(other).join()) problems.push(`${key} : « ${k} » variables différentes`)
      }
    }
    expect(problems).toEqual([])
  })

  it("les dossiers de locales ne contiennent que des langues prises en charge", () => {
    const unexpected: string[] = []
    for (const file of listFiles(["apps", "packages"], [".json"]).filter((path) => path.includes("/i18n/locales/"))) {
      const locale = /\/i18n\/locales\/([^/]+)\//.exec(file)?.[1]
      if (!locale || !(LOCALES as readonly string[]).includes(locale)) unexpected.push(file)
    }
    expect(unexpected).toEqual([])
    expect(readdirSync(join(REPO_ROOT, "packages/social-features/src/i18n/locales")).sort()).toEqual(["en", "fr"])
  })
})
