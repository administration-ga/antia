// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Une entrée de zone doit remplacer le document ; un Link Next serait une régression.
vi.mock("next/link", () => ({ default: () => { throw new Error("La démo exige une navigation document.") } }))

import { appResources } from "@/i18n/resources"
import { DEMO_BANNER_HEIGHT_PROPERTY } from "@/lib/demo-embed"
import { routes } from "@/lib/routes"
import { DemoEmbedScreen, DemoEntryLink, DemoModeBanner } from "./demo-embed"

let root: Root | undefined
let container: HTMLDivElement

function enableDemoBuild() {
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
}

function bannerLayout(initialHeight = 121) {
  let height = initialHeight
  let resize: ResizeObserverCallback | undefined
  const observe = vi.fn(), disconnect = vi.fn()
  class Observer {
    observe = observe
    disconnect = disconnect
    unobserve = vi.fn()
    constructor(callback: ResizeObserverCallback) { resize = callback }
  }
  vi.stubGlobal("ResizeObserver", Observer)
  const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 0, y: 0, width: 390, height, top: 0, right: 390, bottom: height, left: 0, toJSON: () => ({}),
  }))
  return {
    observe, disconnect, rect,
    resizeTo(nextHeight: number) { height = nextHeight; resize?.([], {} as ResizeObserver) },
  }
}

async function mount(content: ReactNode, locale: "fr" | "en" = "fr") {
  const i18n = createAppI18n({ locale, appResources, defaultNS: "antsia" })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<I18nextProvider i18n={i18n}>{content}</I18nextProvider>))
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubEnv("NEXT_PUBLIC_DEMO_ENTRY_ENABLED", "true")
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "")
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://diligent-avocet-585.convex.cloud")
})
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container?.remove()
  document.documentElement.style.removeProperty(DEMO_BANNER_HEIGHT_PROPERTY)
  document.documentElement.style.removeProperty("--fixture-unrelated-layout")
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("entrée de démonstration par document", () => {
  it("présente un lien interne /demo sur le site principal", async () => {
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/demo")
    expect(container.querySelector("a")?.textContent).toBe("Comptes démo")
    expect(container.querySelector("iframe")).toBeNull()
  })

  it.each(["", "false", "TRUE", "1", " true "])("n'affiche aucun lien si le flag n'est pas exact : %j", async (flag) => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_ENTRY_ENABLED", flag)
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")).toBeNull()
  })

  it("ne propose pas une entrée récursive dans le build démo", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")).toBeNull()
  })

  it("le site local conserve un lien document lorsqu'il est explicitement activé", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3210")
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")?.getAttribute("href")).toBe(routes.demo())
  })
})

describe("bandeau du build démo", () => {
  it("reste absent du site principal", async () => {
    await mount(<DemoModeBanner />)
    expect(container.querySelector("aside")).toBeNull()
  })

  it("annonce les données fictives partagées et revient au document principal", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
    await mount(<DemoModeBanner />)
    expect(container.querySelector("aside")?.getAttribute("aria-label")).toBe("Mode démo")
    expect(container.textContent).toContain("Comptes et contenus fictifs, partagés")
    expect(container.textContent).toContain("Votre compte ANTSIA reste séparé")
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/")
    expect(container.querySelector("a")?.textContent).toBe("Retour à ANTSIA")
    expect(container.querySelector("iframe")).toBeNull()
  })

  it.each([
    "http://localhost:3210",
    "https://diligent-avocet-585.convex.cloud",
    "https://vivid-hedgehog-655.convex.cloud:443",
    "https://vivid-hedgehog-655.convex.cloud.evil.test",
  ])("un backend étranger ou normalisé ne devient pas un build démo : %s", async (backend) => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backend)
    await mount(<DemoModeBanner />)
    expect(container.querySelector("aside")).toBeNull()
  })

  it("traduit le bandeau et le retour en anglais", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_PATH", "/demo")
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
    await mount(<DemoModeBanner />, "en")
    expect(container.querySelector("aside")?.getAttribute("aria-label")).toBe("Demo mode")
    expect(container.textContent).toContain("Fictional accounts and content")
    expect(container.querySelector("a")?.textContent).toBe("Back to ANTSIA")
  })

  it("mesure sa hauteur et suit ses changements sans remonter le bandeau ni l'enfant", async () => {
    enableDemoBuild()
    const layout = bannerLayout()
    await mount(<><DemoModeBanner /><textarea aria-label="Brouillon de recette" defaultValue="Brouillon conservé" /></>)
    const banner = container.querySelector("aside")!, draft = container.querySelector("textarea")!
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("121px")
    expect(layout.observe).toHaveBeenCalledExactlyOnceWith(banner)
    draft.focus()
    draft.setSelectionRange(5, 12)
    await act(async () => { layout.resizeTo(74.5) })
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("74.5px")
    expect(container.querySelector("aside")).toBe(banner)
    expect(container.querySelector("textarea")).toBe(draft)
    expect(draft.value).toBe("Brouillon conservé")
    expect(document.activeElement).toBe(draft)
    expect([draft.selectionStart, draft.selectionEnd]).toEqual([5, 12])
    expect(layout.observe).toHaveBeenCalledTimes(1)
    expect(layout.disconnect).not.toHaveBeenCalled()
  })

  it("déconnecte l'observateur et ne supprime que sa variable si elle n'existait pas", async () => {
    enableDemoBuild()
    const layout = bannerLayout()
    document.documentElement.style.setProperty("--fixture-unrelated-layout", "19px", "important")
    await mount(<DemoModeBanner />)
    await act(async () => root!.unmount())
    root = undefined
    expect(layout.disconnect).toHaveBeenCalledOnce()
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("")
    expect(document.documentElement.style.getPropertyValue("--fixture-unrelated-layout")).toBe("19px")
    expect(document.documentElement.style.getPropertyPriority("--fixture-unrelated-layout")).toBe("important")
  })

  it("restaure la valeur et la priorité CSS présentes avant son montage", async () => {
    enableDemoBuild()
    const layout = bannerLayout(119)
    document.documentElement.style.setProperty(DEMO_BANNER_HEIGHT_PROPERTY, "33px", "important")
    await mount(<DemoModeBanner />)
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("119px")
    await act(async () => root!.unmount())
    root = undefined
    expect(layout.disconnect).toHaveBeenCalledOnce()
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("33px")
    expect(document.documentElement.style.getPropertyPriority(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("important")
  })

  it("ne mesure, n'observe et ne modifie aucun style du site principal", async () => {
    const layout = bannerLayout()
    document.documentElement.style.setProperty(DEMO_BANNER_HEIGHT_PROPERTY, "27px", "important")
    await mount(<DemoModeBanner />)
    expect(container.querySelector("aside")).toBeNull()
    expect(layout.rect).not.toHaveBeenCalled()
    expect(layout.observe).not.toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("27px")
    expect(document.documentElement.style.getPropertyPriority(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("important")
    await act(async () => root!.unmount())
    root = undefined
    expect(layout.disconnect).not.toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("27px")
  })

  it("mesure une première fois même sans ResizeObserver", async () => {
    enableDemoBuild()
    const layout = bannerLayout(87)
    vi.stubGlobal("ResizeObserver", undefined)
    await mount(<DemoModeBanner />)
    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_PROPERTY)).toBe("87px")
    expect(layout.observe).not.toHaveBeenCalled()
  })
})

describe("repli fermé de la page démo", () => {
  it("annonce l'indisponibilité sans cadre, redirection ou origine secondaire", async () => {
    await mount(<DemoEmbedScreen />)
    expect(container.querySelector("h1")?.textContent).toBe("Mode démo")
    expect(container.querySelector('[role="status"]')?.textContent).toContain("momentanément indisponible")
    expect(container.querySelector("iframe")).toBeNull()
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["/"])
  })

  it("traduit aussi le repli en anglais", async () => {
    await mount(<DemoEmbedScreen />, "en")
    expect(container.querySelector("h1")?.textContent).toBe("Demo mode")
    expect(container.querySelector('[role="status"]')?.textContent).toContain("temporarily unavailable")
    expect(container.querySelector("iframe")).toBeNull()
  })
})
