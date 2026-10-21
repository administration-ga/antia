// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import { DEMO_READY_MESSAGE_TYPE } from "@/lib/demo-embed"
import { routes } from "@/lib/routes"
import { DemoEmbedBridge, DemoEmbedScreen, DemoEntryLink } from "./demo-embed"

const MAIN_ORIGIN = "https://antsia.vercel.app"
const DEMO_ORIGIN = "https://antsia-demo.vercel.app"
let root: Root | undefined
let container: HTMLDivElement

async function mount(content: ReactNode, locale: "fr" | "en" = "fr") {
  const i18n = createAppI18n({ locale, appResources, defaultNS: "antsia" })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<I18nextProvider i18n={i18n}>{content}</I18nextProvider>))
}

function iframe(): HTMLIFrameElement {
  const element = container.querySelector("iframe")
  if (!element) throw new Error("Cadre de démonstration absent")
  return element
}

async function signal(origin: string, source: MessageEventSource | null, data: unknown = { type: DEMO_READY_MESSAGE_TYPE }) {
  await act(async () => { window.dispatchEvent(new MessageEvent("message", { origin, source, data })) })
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.useFakeTimers()
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", MAIN_ORIGIN)
  vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", DEMO_ORIGIN)
  vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", MAIN_ORIGIN)
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://vivid-hedgehog-655.convex.cloud")
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container?.remove()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("cadre de démonstration isolé", () => {
  it("garde le retour ANTSIA, le statut et les limites du cadre dans une coque responsive", async () => {
    await mount(<DemoEmbedScreen origin={DEMO_ORIGIN} />)
    expect(container.querySelector("h1")?.textContent).toBe("Mode démo")
    expect(container.textContent).toContain("fictifs, partagés")
    expect(container.querySelector("a")?.getAttribute("href")).toBe(routes.home())
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Chargement de la démo")
    expect(container.querySelector("main")?.classList.contains("h-dvh")).toBe(true)
    expect(container.querySelector("main")?.classList.contains("overflow-hidden")).toBe(true)
    expect(iframe().src).toBe(new URL(routes.signIn(), DEMO_ORIGIN).href)
    expect(iframe().title).toBe("ANTSIA — comptes et réseau de démonstration isolés")
    expect(iframe().getAttribute("sandbox")?.split(" ").sort()).toEqual(["allow-forms", "allow-same-origin", "allow-scripts"])
    expect(iframe().getAttribute("referrerpolicy")).toBe("no-referrer")
    expect(iframe().hasAttribute("allow")).toBe(false)
    expect(iframe().hasAttribute("allowfullscreen")).toBe(false)
  })

  it("l'absence de configuration ne crée aucun cadre ni lien externe", async () => {
    const schedule = vi.spyOn(window, "setTimeout")
    await mount(<DemoEmbedScreen origin={null} />)
    expect(container.querySelector("iframe")).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain("momentanément indisponible")
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([routes.home()])
    expect(schedule.mock.calls.some(([, delay]) => delay === 15_000)).toBe(false)
  })

  it("seul le signal strict du contenu du cadre et de son origine confirme la disponibilité", async () => {
    await mount(<DemoEmbedScreen origin={DEMO_ORIGIN} />)
    const source = iframe().contentWindow
    await act(async () => { iframe().dispatchEvent(new Event("load")) })
    await signal(MAIN_ORIGIN, source)
    await signal(DEMO_ORIGIN, window)
    await signal(DEMO_ORIGIN, null)
    for (const data of [null, "antsia:demo-ready", [], { type: "other" }, { type: DEMO_READY_MESSAGE_TYPE, account: "private" }]) await signal(DEMO_ORIGIN, source, data)
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Chargement")
    await signal(DEMO_ORIGIN, source)
    expect(container.querySelector('[role="status"]')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(15_000) })
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it("permet de réessayer sans cacher le cadre ni accepter un signal de son ancien document", async () => {
    await mount(<DemoEmbedScreen origin={DEMO_ORIGIN} />)
    const first = iframe()
    const oldSource = first.contentWindow
    await act(async () => { vi.advanceTimersByTime(15_000) })
    expect(container.querySelector('[role="status"]')?.textContent).toContain("plus de temps")
    expect(iframe()).toBe(first)
    const retry = container.querySelector("button")
    expect(retry?.textContent).toBe("Réessayer")
    await act(async () => retry!.click())
    expect(iframe()).not.toBe(first)
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Chargement")
    await signal(DEMO_ORIGIN, oldSource)
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    await signal(DEMO_ORIGIN, iframe().contentWindow)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it("libère le délai et le gestionnaire de messages au démontage", async () => {
    const add = vi.spyOn(window, "addEventListener")
    const remove = vi.spyOn(window, "removeEventListener")
    await mount(<DemoEmbedScreen origin={DEMO_ORIGIN} />)
    const listener = add.mock.calls.find(([type]) => type === "message")?.[1]
    expect(listener).toBeTypeOf("function")
    await act(async () => root!.unmount())
    root = undefined
    expect(remove).toHaveBeenCalledWith("message", listener)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("traduit la coque et le titre du cadre en anglais", async () => {
    await mount(<DemoEmbedScreen origin={DEMO_ORIGIN} />, "en")
    expect(container.querySelector("h1")?.textContent).toBe("Demo mode")
    expect(container.querySelector("a")?.textContent).toBe("Back to ANTSIA")
    expect(iframe().title).toBe("ANTSIA — isolated demo accounts and network")
  })

  it("ouvre uniquement la route interne de démonstration configurée", async () => {
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")?.getAttribute("href")).toBe(routes.demo())
    expect(container.querySelector("a")?.textContent).toBe("Comptes démo")
  })

  it("omet le lien d'entrée lorsque la configuration est fermée", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMBED_ORIGIN", "")
    await mount(<DemoEntryLink />)
    expect(container.querySelector("a")).toBeNull()
  })
})

describe("signal minimal depuis la démonstration", () => {
  it("n'envoie que le signal prêt vers l'origine exacte configurée", async () => {
    const postMessage = vi.fn()
    vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage } as unknown as Window)
    await mount(<DemoEmbedBridge />)
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: DEMO_READY_MESSAGE_TYPE }, MAIN_ORIGIN)
  })

  it("ne signale rien lorsque la démo est ouverte directement", async () => {
    vi.spyOn(window, "parent", "get").mockReturnValue(window)
    const postMessage = vi.spyOn(window, "postMessage")
    await mount(<DemoEmbedBridge />)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it.each(["http://127.0.0.1:3210", "https://diligent-avocet-585.convex.cloud"])("ne signale rien depuis le backend %s", async (backend) => {
    const postMessage = vi.fn()
    vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage } as unknown as Window)
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backend)
    await mount(<DemoEmbedBridge />)
    expect(postMessage).not.toHaveBeenCalled()
  })
})
