// @vitest-environment jsdom
// P04 (18/10/2026) : le mode du fil se lit sur la capacité déclarée, la pose et la hauteur ; le choix vit sous le préfixe du réseau.
import type { Id } from "@antsia/api/engine"
import { NetworkProvider, type EngineFeedPresentation } from "@antsia/api/network"
import { RouterProvider } from "@antsia/api/routing"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { memoryRouter, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { feedModeStorageKey } from "./feed-mode"
import { __resetFeedModeMemoryForTests, useFeedMode } from "./use-feed-mode"

const state = vi.hoisted(() => ({ mobile: true as boolean | null, reduced: false }))

vi.mock("@antsia/ui/overlay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@antsia/ui/overlay")>()),
  useIsReseauMobile: () => state.mobile,
}))
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => state.reduced,
}))

function wrapperFor(options: { slug?: string; feedPresentation?: EngineFeedPresentation; personId?: Id<"persons"> } = {}) {
  const router = memoryRouter().implementation
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RouterProvider implementation={router}>
        <NetworkProvider
          networkId={TEST_NETWORK_ID}
          slug={options.slug ?? "test"}
          personId={options.personId ?? TEST_PERSON_ID}
          charte="antsia"
          routes={TEST_ROUTES}
          feedPresentation={options.feedPresentation}
        >
          {children}
        </NetworkProvider>
      </RouterProvider>
    )
  }
}

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
  window.dispatchEvent(new Event("resize"))
}

beforeEach(() => {
  __resetFeedModeMemoryForTests()
  window.localStorage.clear()
  state.mobile = true
  state.reduced = false
  setViewportHeight(800)
})

describe("useFeedMode", () => {
  it("rend null sans déclaration de l'application : la liste historique, sans bascule", () => {
    const { result } = renderHook(() => useFeedMode(), { wrapper: wrapperFor() })
    expect(result.current).toBeNull()
  })

  it("Immersion par défaut au téléphone, Liste au bureau", () => {
    const phone = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ feedPresentation: "immersive" }) })
    expect(phone.result.current?.effective).toBe("immersive")
    phone.unmount()
    state.mobile = false
    const desktop = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ feedPresentation: "immersive" }) })
    expect(desktop.result.current?.pose).toBe("desktop")
    expect(desktop.result.current?.effective).toBe("list")
  })

  it("largeur inconnue : la liste, sans monter d'arbre immersif « en attendant »", () => {
    state.mobile = null
    const { result } = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ feedPresentation: "immersive" }) })
    expect(result.current?.known).toBe(false)
    expect(result.current?.effective).toBe("list")
  })

  it("la réduction des mouvements ramène la Liste par défaut", () => {
    state.reduced = true
    const { result } = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ feedPresentation: "immersive" }) })
    expect(result.current?.effective).toBe("list")
  })

  it("mémorise le choix sous le préfixe du réseau, indépendamment des autres réseaux", () => {
    const antsia = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ slug: "antsia", feedPresentation: "immersive" }) })
    act(() => antsia.result.current?.setMode("list"))
    expect(antsia.result.current?.effective).toBe("list")
    expect(window.localStorage.getItem(feedModeStorageKey("antsia:antsia:"))).toBe('{"phone":"list"}')
    antsia.unmount()

    const other = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ slug: "voisin", feedPresentation: "immersive" }) })
    expect(other.result.current?.effective).toBe("immersive")
  })

  it("un écran trop bas affiche la Liste, puis l'Immersion revient avec la hauteur", () => {
    const { result } = renderHook(() => useFeedMode(), { wrapper: wrapperFor({ feedPresentation: "immersive" }) })
    act(() => setViewportHeight(360))
    expect(result.current?.effective).toBe("list")
    expect(result.current?.fallback).toBe("lowHeight")
    act(() => setViewportHeight(760))
    expect(result.current?.effective).toBe("immersive")
    expect(result.current?.fallback).toBeNull()
  })
})
