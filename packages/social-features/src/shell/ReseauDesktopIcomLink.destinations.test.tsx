// Écrit pour le moteur (lot P02 de l'étude social-commerce du 18/10/2026) : la porte iCom de la barre d'identité s'efface sous la navigation par destinations (la destination Messages du rail porte le même geste), et reste à l'identique sans elle.
// @vitest-environment jsdom

import { NetworkProvider, type EngineNavigation, type EngineRoutes } from "@antsia/api/network"
import { render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../i18n"
import { TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../tests/engine-wrapper"

vi.mock("../features/messagerie/messagerie-source", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/messagerie/messagerie-source")>()
  const zero = { total: 0, capped: false }
  return { ...original, SOURCE_AGENT: { ...original.SOURCE_AGENT, useUnreadTotals: () => ({ directs: zero, groupes: zero, total: zero, isLoading: false, isError: false, refetch: () => {} }) } }
})

import { ReseauDesktopIcomLink } from "./ReseauDesktopIcomLink"

const ROUTES: EngineRoutes = { ...TEST_ROUTES, discover: () => "/explorer", me: () => "/moi" }

function door(navigation: EngineNavigation | undefined) {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return render(
    <I18nextProvider i18n={i18n}>
      <NetworkProvider networkId={TEST_NETWORK_ID} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={ROUTES} navigation={navigation}>
        <ReseauDesktopIcomLink />
      </NetworkProvider>
    </I18nextProvider>,
  )
}

describe("ReseauDesktopIcomLink — une seule porte iCom au bureau", () => {
  it("s'efface sous la navigation par destinations", () => {
    door("destinations")
    expect(screen.queryByRole("button", { name: "Ouvrir iCom" })).toBeNull()
  })

  it("reste à l'identique sans elle", () => {
    door(undefined)
    expect(screen.getByRole("button", { name: "Ouvrir iCom" })).toBeTruthy()
  })
})
