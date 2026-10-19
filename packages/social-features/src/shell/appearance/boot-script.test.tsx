// @vitest-environment jsdom
// ADR-0026 : l'amorçage pose sur <html> exactement ce que le fournisseur posera, et le fournisseur ne le défait jamais en hydratant.
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMemoryStorage } from "../../tests/memory-storage"
import { appearanceBootScript } from "./boot-script"
import { type AppearanceTheme, AppearanceProvider } from "./provider"

const PREFIX = "antsia:test:"
const THEMES: readonly AppearanceTheme[] = [
  { id: "origine", charte: "antsia" },
  { id: "foret", charte: "antsia-foret" },
  { id: "lagon", charte: "antsia-lagon" },
]
const SERVER_CHARTE = "antsia"

type Stored = string | null
type StorageCase = "ok" | "getItem refusé" | "absent"
type SystemCase = "clair" | "sombre" | "sans API" | "API en erreur"

interface Scenario { theme: Stored; appearance: Stored; storage: StorageCase; system: SystemCase }

const THEME_VALUES: readonly Stored[] = [null, "foret", "origine", "inconnu", "__proto__"]
const APPEARANCE_VALUES: readonly Stored[] = [null, "light", "dark", "system", "inattendu"]
const STORAGES: readonly StorageCase[] = ["ok", "getItem refusé", "absent"]
const SYSTEMS: readonly SystemCase[] = ["clair", "sombre", "sans API", "API en erreur"]

const SCENARIOS: Scenario[] = THEME_VALUES.flatMap((theme) =>
  APPEARANCE_VALUES.flatMap((appearance) => STORAGES.flatMap((storage) => SYSTEMS.map((system) => ({ theme, appearance, storage, system })))),
)

/** <html> tel que le serveur le rend : la charte d'origine, ni `.dark` ni `color-scheme`. */
function serverHtml(charte = SERVER_CHARTE) {
  const html = document.documentElement
  html.setAttribute("data-charte", charte)
  html.classList.remove("dark")
  html.style.removeProperty("color-scheme")
}

function prepare({ theme, appearance, storage, system }: Scenario) {
  const memory = createMemoryStorage()
  if (theme !== null) memory.setItem(`${PREFIX}theme`, theme)
  if (appearance !== null) memory.setItem(`${PREFIX}appearance`, appearance)
  if (storage === "getItem refusé") vi.spyOn(memory, "getItem").mockImplementation(() => { throw new Error("SecurityError") })
  vi.stubGlobal("localStorage", storage === "absent" ? undefined : memory)
  if (system === "sans API") vi.stubGlobal("matchMedia", undefined)
  else if (system === "API en erreur") vi.stubGlobal("matchMedia", vi.fn(() => { throw new Error("indisponible") }))
  else vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: system === "sombre", media: "(prefers-color-scheme: dark)" })))
}

function htmlState() {
  const html = document.documentElement
  return { charte: html.getAttribute("data-charte"), dark: html.classList.contains("dark"), scheme: html.style.colorScheme }
}

function runBoot(themes: readonly AppearanceTheme[] = THEMES, prefix = PREFIX) {
  new Function(appearanceBootScript({ storagePrefix: prefix, themes }))()
}

function mountProvider(themes: readonly AppearanceTheme[] | undefined = THEMES) {
  render(<AppearanceProvider storagePrefix={PREFIX} themes={themes}><span /></AppearanceProvider>)
}

/** Toutes les valeurs prises par les attributs de <html> pendant `run`, la dernière comprise. */
function valuesTakenDuring(run: () => void) {
  const html = document.documentElement
  const observer = new MutationObserver(() => undefined)
  observer.observe(html, { attributes: true, attributeOldValue: true, attributeFilter: ["data-charte", "class", "style"] })
  run()
  const records = observer.takeRecords()
  observer.disconnect()
  const taken: Record<string, Set<string | null>> = {}
  for (const record of records) {
    const name = record.attributeName ?? ""
    taken[name] ??= new Set()
    taken[name].add(record.oldValue)
    taken[name].add(html.getAttribute(name))
  }
  return taken
}

beforeEach(() => serverHtml())

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("amorçage de l'apparence — parité avec le fournisseur", () => {
  it.each(SCENARIOS)("thème $theme, apparence $appearance, stockage $storage, système $system", (scenario) => {
    prepare(scenario)
    runBoot()
    const booted = htmlState()

    cleanup()
    serverHtml()
    prepare(scenario)
    act(() => mountProvider())
    expect(booted).toEqual(htmlState())
  })

  it("sans thèmes proposés, la charte posée par la page reste intacte ; le mode sombre s'applique", () => {
    serverHtml("diasporale")
    prepare({ theme: "foret", appearance: "dark", storage: "ok", system: "clair" })
    runBoot([])
    expect(htmlState()).toEqual({ charte: "diasporale", dark: true, scheme: "dark" })
  })

  it("lit les clés du préfixe du réseau, jamais celles d'un autre réseau", () => {
    prepare({ theme: null, appearance: null, storage: "ok", system: "clair" })
    window.localStorage.setItem("antsia:autre:theme", "lagon")
    window.localStorage.setItem("antsia:autre:appearance", "dark")
    runBoot()
    expect(htmlState()).toEqual({ charte: "antsia", dark: false, scheme: "light" })
  })
})

describe("hydratation : le fournisseur ne défait pas l'amorçage", () => {
  it.each([
    { theme: "foret", appearance: "dark", system: "clair" },
    { theme: "lagon", appearance: null, system: "sombre" },
    { theme: null, appearance: "light", system: "sombre" },
    { theme: "origine", appearance: "system", system: "sombre" },
  ] as const)("thème $theme, apparence $appearance, système $system : aucune autre valeur prise par <html>", (scenario) => {
    prepare({ ...scenario, storage: "ok" })
    runBoot()
    const booted = htmlState()
    const taken = valuesTakenDuring(() => act(() => mountProvider()))
    expect(htmlState()).toEqual(booted)
    // Chaque attribut touché n'a jamais pris que sa valeur finale : aucun cadre dans la charte ou le mode du premier rendu.
    expect(taken["data-charte"] ?? new Set([booted.charte])).toEqual(new Set([booted.charte]))
    for (const name of ["class", "style"] as const) {
      const values = taken[name]
      if (values) expect(values.size, `${name} : ${[...values].join(" → ")}`).toBe(1)
    }
  })
})

describe("texte du script", () => {
  it("stable pour une configuration donnée (empreinte CSP possible) et sans valeur de requête", () => {
    const first = appearanceBootScript({ storagePrefix: PREFIX, themes: THEMES })
    expect(appearanceBootScript({ storagePrefix: PREFIX, themes: [...THEMES] })).toBe(first)
    expect(first).not.toMatch(/nonce|cookie|location/)
  })

  it("une configuration hostile ne referme jamais l'élément script et reste lue telle quelle", () => {
    const prefix = "antsia:</script><script>alert(1)</script><!--:"
    const script = appearanceBootScript({ storagePrefix: prefix, themes: THEMES })
    expect(script).not.toMatch(/<\/script|<!--/i)
    prepare({ theme: null, appearance: null, storage: "ok", system: "clair" })
    window.localStorage.setItem(`${prefix}theme`, "lagon")
    window.localStorage.setItem(`${prefix}appearance`, "dark")
    runBoot(THEMES, prefix)
    expect(htmlState()).toEqual({ charte: "antsia-lagon", dark: true, scheme: "dark" })
  })
})
