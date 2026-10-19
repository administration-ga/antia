// Écrit pour le moteur (lot P02 de l'étude social-commerce du 18/10/2026) : la face React des destinations — capacité lue sur la déclaration de l'application (et rabattue si une destination manque), décompte de Messages lu sur les deux queries du serveur dans le réseau courant, clic « ordinaire ».
// @vitest-environment jsdom

import { NetworkProvider, resolveEngineNavigation, type EngineNavigation, type EngineRoutes } from "@antsia/api/network"
import { render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { MouseEvent } from "react"
import { describe, expect, it, vi } from "vitest"

import { TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({ calls: [] as { name: string; args: unknown }[] }))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    mocks.calls.push({ name, args })
    if (name === "modules/messaging/inbox:totalUnread") return { data: { total: 4, capped: false } }
    if (name === "modules/groups/threads:totalUnread") return { data: { total: 2, capped: false } }
    return { data: undefined }
  },
}))

import { isPlainLeftClick, useMessagesUnreadTotal, useReseauDestinationRoutes } from "./reseau-menu-destinations-ui"

const ROUTES: EngineRoutes = { ...TEST_ROUTES, discover: () => "/explorer", me: () => "/moi" }

function Probe() {
  const destinations = useReseauDestinationRoutes()
  const unread = useMessagesUnreadTotal()
  return (
    <output data-testid="probe">
      {destinations === null ? "volets" : `${destinations.discover()} ${destinations.me()}`} · {unread}
    </output>
  )
}

function probe(navigation: EngineNavigation | undefined, routes: EngineRoutes = ROUTES): string {
  const { unmount } = render(
    <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={routes} navigation={navigation}>
      <Probe />
    </NetworkProvider>,
  )
  const text = screen.getByTestId("probe").textContent ?? ""
  unmount()
  return text
}

describe("useReseauDestinationRoutes — la capacité DÉCLARÉE par l'application", () => {
  it("n'existe que sur déclaration ET avec les deux destinations propres servies", () => {
    expect(probe("destinations")).toContain("/explorer /moi")
    expect(probe(undefined)).toContain("volets")
    expect(probe("volets")).toContain("volets")
    expect(probe("destinations", { ...ROUTES, me: undefined })).toContain("volets")
    expect(probe("destinations", { ...ROUTES, discover: undefined })).toContain("volets")
  })

  it("le contexte rabat la déclaration de la même façon (aucune destination sans adresse)", () => {
    expect(resolveEngineNavigation("destinations", ROUTES)).toBe("destinations")
    expect(resolveEngineNavigation("destinations", TEST_ROUTES)).toBe("volets")
    expect(resolveEngineNavigation(undefined, ROUTES)).toBe("volets")
    expect(resolveEngineNavigation("volets", ROUTES)).toBe("volets")
  })
})

describe("useMessagesUnreadTotal — le chiffre de Messages", () => {
  it("lit les DEUX décomptes du serveur dans le réseau courant et les réunit", () => {
    mocks.calls = []
    expect(probe("destinations")).toContain("· 6")
    expect(mocks.calls).toEqual(
      expect.arrayContaining([
        { name: "modules/messaging/inbox:totalUnread", args: { networkId: TEST_NETWORK_ID } },
        { name: "modules/groups/threads:totalUnread", args: { networkId: TEST_NETWORK_ID } },
      ]),
    )
  })
})

describe("isPlainLeftClick — ce qui peut être remplacé par un geste de la page", () => {
  const click = (init: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }>) =>
    ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init }) as MouseEvent<HTMLElement>

  it("seulement le bouton principal sans touche de modification — l'ouverture d'un onglet reste au navigateur", () => {
    expect(isPlainLeftClick(click({}))).toBe(true)
    for (const init of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      expect(isPlainLeftClick(click(init))).toBe(false)
    }
  })
})
