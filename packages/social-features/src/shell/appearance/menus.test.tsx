// @vitest-environment jsdom
// PA6 : apparence dans les menus existants, sans destination ni barre nouvelle.
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper } from "../../tests/engine-wrapper"
import { createMemoryStorage } from "../../tests/memory-storage"
import { AppearanceProvider } from "./provider"

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      people: { persons: { getMyPerson: "getMyPerson" } },
      pages: { pages: { paginateMyPageFollows: "paginateMyPageFollows" } },
      thematicGroups: { thematicGroups: { myGroups: "myGroups" } },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string) => ({
    data: reference === "getMyPerson" ? { published: false, avatar: null } : { items: [], truncated: false },
    isLoading: false,
    isError: false,
  }),
  useAuthenticatedPaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

import { ReseauMenuRail } from "../ReseauMenuRail"
import { ReseauMobileMenuSheet } from "../mobile/ReseauMobileMenuSheet"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  const media = new EventTarget() as MediaQueryList
  Object.defineProperty(media, "matches", { value: false })
  vi.stubGlobal("matchMedia", vi.fn(() => media))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Apparence dans les menus de la coque", () => {
  it("offre l'apparence dans le rail de bureau sans dépendre d'une route de paramètres", () => {
    render(
      <EngineTestWrapper>
        <AppearanceProvider storagePrefix="antsia:test:">
          <ReseauMenuRail activeTab="fil" onSelectTab={vi.fn()} />
        </AppearanceProvider>
      </EngineTestWrapper>,
    )
    const select = screen.getByRole("combobox", { name: "Apparence" })
    fireEvent.change(select, { target: { value: "dark" } })
    expect(document.documentElement).toHaveClass("dark")
    expect(screen.getByRole("button", { name: "Fil" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Paramètres" })).toBeNull()
  })

  it("offre l'apparence dans la feuille mobile en conservant celle-ci ouverte", () => {
    const onOpenChange = vi.fn()
    render(
      <EngineTestWrapper>
        <AppearanceProvider storagePrefix="antsia:test:">
          <ReseauMobileMenuSheet open onOpenChange={onOpenChange} />
        </AppearanceProvider>
      </EngineTestWrapper>,
    )
    const select = screen.getByRole("combobox", { name: "Apparence" })
    fireEvent.change(select, { target: { value: "dark" } })
    expect(document.documentElement).toHaveClass("dark")
    expect(screen.getByRole("dialog", { name: "Menu principal" })).toBeVisible()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
