// @vitest-environment jsdom
/**
 * P18b (A12, WCAG 3.2.2) — choisir une province ne change pas de page ; la
 * page change à la validation (« Afficher »), par les routes de l'application.
 */
import { createAppI18n } from "@antsia/social-features/i18n"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { discovery: { discovery: { rootFeed: "root-feed" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ data: undefined, error: null, refetch: vi.fn() }) }))
vi.mock("@antsia/social-features/reseau-personnel", () => ({ PostCard: () => null, useFeedImmersion: () => null }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }))

import { appResources } from "@/i18n/resources"
import { routes } from "@/lib/routes"
import { ProvinceFilterForm } from "./member-feed"

const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "memberNetwork" })
let root: Root
let container: HTMLDivElement

async function render(current?: string) {
  await act(async () => root.render(<I18nextProvider i18n={i18n}><ProvinceFilterForm current={current} /></I18nextProvider>))
}
async function choose(value: string) {
  await act(async () => {
    const select = container.querySelector("select")!
    select.value = value
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
async function apply() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  state.push.mockReset()
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("filtre de province (P18b, A12)", () => {
  it("parcourir les provinces ne navigue pas ; « Afficher » ouvre la province choisie", async () => {
    await render()
    await choose("estuaire")
    await choose("ngounie")
    expect(state.push).not.toHaveBeenCalled()

    await apply()
    expect(state.push).toHaveBeenCalledOnce()
    expect(state.push).toHaveBeenCalledWith(routes.memberProvince("ngounie"))
  })

  it("« Toutes les provinces » ramène au fil national, et le choix affiché suit l'adresse courante", async () => {
    await render("estuaire")
    expect(container.querySelector("select")!.value).toBe("estuaire")
    await choose("")
    await apply()
    expect(state.push).toHaveBeenCalledWith(routes.nationalFeed())

    await render("ngounie")
    expect(container.querySelector("select")!.value).toBe("ngounie")
  })

  it("le bouton de validation est nommé « Afficher »", async () => {
    await render()
    expect([...container.querySelectorAll("button[type='submit']")].map((button) => button.textContent)).toEqual([i18n.t("discovery.provinceApply")])
  })
})
