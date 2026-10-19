// @vitest-environment jsdom
import { canonicalTimeZone } from "@antsia/api/civil-date"
import { ViewerPreferencesProvider } from "@antsia/api/viewer-preferences"
import { createAppI18n, type Locale } from "@antsia/social-features/i18n"
import { AppearanceProvider } from "@antsia/social-features/shell/appearance"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"

type Values = { locale: "fr" | "en"; timeZone: string }
const state = vi.hoisted(() => ({
  signingOut: false,
  person: { _id: "person-fixture", locale: "fr" as "fr" | "en", timeZone: "Africa/Libreville" },
  mutation: vi.fn<(values: Values) => Promise<null>>(),
  query: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
}))

vi.mock("@convex/_generated/api", () => ({ api: { modules: { people: { persons: { getMyPerson: "get-person" }, preferences: { setMyPreferences: "set-preferences" } } } } }))
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => { state.query(reference, args); return state.person },
  useMutation: () => state.mutation,
}))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.failure } }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => state.signingOut }))

import { PreferencesControls } from "./preferences-controls"

let root: Root | undefined
let container: HTMLDivElement
let translations: ReturnType<typeof createAppI18n>
let storageDescriptor: PropertyDescriptor | undefined

/** Node 25 peut exposer un localStorage incomplet ; le test ne touche aucun stockage réel. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() { return items.size },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(String(key)) ?? null,
    setItem: (key, value) => { items.set(String(key), String(value)) },
    removeItem: (key) => { items.delete(String(key)) },
    clear: () => { items.clear() },
  }
}

function tree() {
  return <I18nextProvider i18n={translations}>
    <ViewerPreferencesProvider timeZone="UTC">
      <AppearanceProvider storagePrefix="antsia:test:"><PreferencesControls /></AppearanceProvider>
    </ViewerPreferencesProvider>
  </I18nextProvider>
}

async function mount(locale: Locale = "fr") {
  translations = createAppI18n({ locale, appResources, defaultNS: "antsia" })
  root = createRoot(container)
  await act(async () => { root?.render(tree()) })
}

async function rerender() {
  await act(async () => { root?.render(tree()) })
}

function field<T extends HTMLInputElement | HTMLSelectElement>(name: string): T {
  const element = container.querySelector<T>(`[name="${name}"]`)
  if (!element) throw new Error(`Missing field: ${name}`)
  return element
}

async function change(name: "locale" | "timeZone", value: string) {
  await act(async () => {
    const element = field(name)
    if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
    } else {
      element.value = value
      element.dispatchEvent(new Event("change", { bubbles: true }))
    }
  })
}

async function submit() {
  await act(async () => { container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.person = { _id: "person-fixture", locale: "fr", timeZone: "Africa/Libreville" }
  state.mutation.mockReset().mockResolvedValue(null)
  state.query.mockClear()
  state.success.mockClear()
  state.failure.mockClear()
  container = document.createElement("div")
  document.body.append(container)
  storageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() })
  const media = new EventTarget() as MediaQueryList
  Object.defineProperty(media, "matches", { value: false })
  vi.stubGlobal("matchMedia", vi.fn(() => media))
})

afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = undefined
  container.remove()
  document.documentElement.classList.remove("dark")
  if (storageDescriptor) Object.defineProperty(window, "localStorage", storageDescriptor)
  else Reflect.deleteProperty(window, "localStorage")
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("PreferencesControls — formulaire réel et snapshots réactifs", () => {
  it("envoie la langue choisie et le fuseau canonisé, puis conserve ces valeurs confirmées", async () => {
    await mount()
    expect(state.query).toHaveBeenCalledWith("get-person", {})
    await change("locale", "en")
    await change("timeZone", " US/Eastern ")
    await submit()
    expect(state.mutation).toHaveBeenCalledWith({ locale: "en", timeZone: "America/New_York" })
    expect(field("timeZone").value).toBe("America/New_York")
    expect(field("locale").value).toBe("en")
    expect(state.success).toHaveBeenCalledOnce()
    // Le mock conserve encore l'ancien snapshot : il ne doit pas annuler le succès.
    await rerender()
    expect(field("timeZone").value).toBe("America/New_York")
  })

  it("refuse un fuseau invalide localement, nomme l'erreur et place le focus sur le champ", async () => {
    await mount()
    await change("timeZone", "pas-un-fuseau")
    await submit()
    expect(state.mutation).not.toHaveBeenCalled()
    expect(field("timeZone").getAttribute("aria-invalid")).toBe("true")
    const described = field("timeZone").getAttribute("aria-describedby") ?? ""
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain("Saisissez un fuseau horaire valable")
    expect(described).toContain(alert?.id)
    expect(document.activeElement).toBe(field("timeZone"))
    expect(container.querySelector("fieldset")?.disabled).toBe(false)
    // Le même défaut doit reprendre le focus à chaque tentative, même si
    // le message d'erreur n'a pas changé depuis la précédente validation.
    container.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus()
    await submit()
    expect(document.activeElement).toBe(field("timeZone"))
    expect(state.mutation).not.toHaveBeenCalled()
  })

  it("un refus serveur conserve le brouillon et expose un retour d'erreur sans message brut", async () => {
    state.mutation.mockRejectedValue(new Error("private server diagnostics"))
    await mount()
    await change("locale", "en")
    await change("timeZone", "Asia/Tokyo")
    await submit()
    expect(field("locale").value).toBe("en")
    expect(field("timeZone").value).toBe("Asia/Tokyo")
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain("Une erreur est survenue")
    expect(container.textContent).not.toContain("private server diagnostics")
    expect(document.activeElement).toBe(alert)
    expect(state.failure).toHaveBeenCalledOnce()
  })

  it("un snapshot distant ne remplace aucun champ d'un brouillon en cours", async () => {
    await mount()
    await change("timeZone", "Asia/Tokyo")
    state.person = { ...state.person, locale: "en", timeZone: "Europe/Paris" }
    await rerender()
    expect(field("timeZone").value).toBe("Asia/Tokyo")
    expect(field("locale").value).toBe("fr")
    expect(state.mutation).not.toHaveBeenCalled()
  })

  it("les snapshots ne réinitialisent pas une soumission en attente, puis le succès gagne sur le snapshot ancien", async () => {
    let resolve!: (value: null) => void
    state.mutation.mockReturnValue(new Promise<null>((done) => { resolve = done }))
    await mount()
    await change("timeZone", " US/Eastern ")
    await submit()
    const form = container.querySelector("form")
    expect(form?.getAttribute("aria-busy")).toBe("true")
    expect(container.querySelector("fieldset")?.disabled).toBe(true)
    state.person = { ...state.person, locale: "en", timeZone: "Europe/Paris" }
    await rerender()
    expect(field("timeZone").value).toBe(" US/Eastern ")
    await act(async () => { resolve(null) })
    expect(field("timeZone").value).toBe("America/New_York")
    expect(field("locale").value).toBe("fr")
    expect(form?.getAttribute("aria-busy")).toBeNull()
  })

  it("un formulaire intact suit les nouvelles valeurs serveur", async () => {
    await mount()
    state.person = { ...state.person, locale: "en", timeZone: "Asia/Tokyo" }
    await rerender()
    expect(field("locale").value).toBe("en")
    expect(field("timeZone").value).toBe("Asia/Tokyo")
  })

  it("traduit le formulaire en anglais", async () => {
    await mount("en")
    expect(container.textContent).toContain("Your preferences")
    expect(container.textContent).toContain("Personal time zone")
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe("Save my preferences")
    expect(canonicalTimeZone(field("timeZone").value)).toBe("Africa/Libreville")
  })

  it("l'apparence est contrôlée par son provider et change sans sauvegarde personnelle", async () => {
    await mount()
    const label = [...container.querySelectorAll("label")].find((item) => item.textContent?.includes("Apparence"))
    const select = label?.querySelector("select")
    expect(select?.value).toBe("system")
    await act(async () => { if (select) { select.value = "dark"; select.dispatchEvent(new Event("change", { bubbles: true })) } })
    expect(select?.value).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(window.localStorage.getItem("antsia:test:appearance")).toBe("dark")
    expect(state.mutation).not.toHaveBeenCalled()
  })

  it("refuser une navigation interne conserve le brouillon et les ouvertures séparées restent libres", async () => {
    await mount()
    await change("timeZone", "Asia/Tokyo")
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Vos modifications ne sont pas enregistrées")
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const link = document.createElement("a")
    link.href = new URL("/other-preferences-page", window.location.href).href
    const destinationHandler = vi.fn((event: MouseEvent) => event.preventDefault())
    link.addEventListener("click", destinationHandler)
    container.append(link)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    await act(async () => { link.dispatchEvent(click) })
    expect(confirm).toHaveBeenCalledWith("Quitter cette page sans enregistrer vos préférences ?")
    expect(click.defaultPrevented).toBe(true)
    expect(destinationHandler).not.toHaveBeenCalled()
    expect(field("timeZone").value).toBe("Asia/Tokyo")
    expect(state.mutation).not.toHaveBeenCalled()

    // L'écouteur aval annule seulement la navigation native du harnais jsdom.
    confirm.mockClear()
    link.target = "_blank"
    await act(async () => { link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })) })
    link.target = ""
    await act(async () => { link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })) })
    link.href = `${window.location.pathname}#preferences`
    await act(async () => { link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })) })
    expect(confirm).not.toHaveBeenCalled()
    expect(destinationHandler).toHaveBeenCalledTimes(3)
  })

  it("la garde beforeunload disparaît après sauvegarde et au démontage", async () => {
    await mount()
    const clean = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    await change("timeZone", "Asia/Tokyo")
    const dirty = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
    await submit()
    const saved = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(saved)
    expect(saved.defaultPrevented).toBe(false)
    expect(container.querySelector('[role="status"]')).toBeNull()
    await change("timeZone", "Europe/Paris")
    await act(async () => { root?.unmount() })
    root = undefined
    const unmounted = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unmounted)
    expect(unmounted.defaultPrevented).toBe(false)
  })

  it("un brouillon ne bloque pas le remplacement du document après déconnexion volontaire", async () => {
    await mount()
    await change("timeZone", "Asia/Tokyo")
    state.signingOut = true
    const leaving = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(false)
    state.signingOut = false
  })
})
