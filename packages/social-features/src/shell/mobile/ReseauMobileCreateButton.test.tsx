// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileCreateButton.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (i18n française, réseau courant, table de routes et routeur en mémoire) au lieu des mocks du routage et de react-i18next ; vues immersives prises sur la table de routes du test (statuts, conversation) ; les formats attendus sont ceux du catalogue mobile du moteur (`creationEntries`, libellés traduits par leurs clés) — la liste littérale du socle comptait la conférence, dont le dialogue attend le module `live` — avec la publication EN TÊTE et l'actu offerte ; le format remonté est celui de la deuxième entrée du catalogue (la conférence au socle).
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { creationEntries } from "../../features/reseau-personnel/creation-controller"
import { createAppI18n } from "../../i18n"
import { memoryRouter, renderWithEngine, TEST_ROUTES } from "../../tests/engine-wrapper"
import { ReseauMobileCreateButton } from "./ReseauMobileCreateButton"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** Le bouton, rendu sur la page dont le chemin est donné (la page réseau par défaut). */
function renderAt(ui: Parameters<typeof renderWithEngine>[0], pathname: string = TEST_ROUTES.home()) {
  return renderWithEngine(ui, { router: memoryRouter({ pathname }).implementation })
}

beforeAll(() => {
  // `useIsReseauMobile` interroge `matchMedia`, absent de jsdom. Une carte de
  // CHOIX garde la même pose sur les deux largeurs (`floatingCardPose`) : la
  // réponse n'a donc aucune incidence sur ce qui est vérifié ici.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  })
})

function fab(): HTMLElement {
  return screen.getByRole("button", { name: /Créer/ })
}

function choix(): HTMLElement {
  return screen.getByRole("group", { name: "Formats" })
}

function libelles(): string[] {
  return Array.from(choix().querySelectorAll("button")).map((bouton) => bouton.querySelector("span > span")?.textContent ?? "")
}

describe("ReseauMobileCreateButton — la commande permanente (R-02)", () => {
  it("est présente sur la page à volets, quel que soit le volet ouvert", () => {
    // Le volet vit dans la QUERY (`?tab=relations`) — que cette commande n'a
    // même pas à lire, puisqu'elle ne dépend que du caractère non immersif de
    // la route. C'est ce que ce test fige : aucune dépendance au volet.
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />)
    expect(fab()).toBeTruthy()
  })

  it("s'efface sur une vue IMMERSIVE, comme la barre d'onglets", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />, TEST_ROUTES.stories())
    expect(screen.queryByRole("button", { name: /Créer/ })).toBeNull()
  })

  it("s'efface aussi dans une conversation plein écran", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />, `${TEST_ROUTES.messages()}/chat/1`)
    expect(screen.queryByRole("button", { name: /Créer/ })).toBeNull()
  })

  it("offre une cible tactile d'au moins 44 px et s'annonce comme surface", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />)
    const bouton = fab()
    expect(bouton.className).toContain("min-h-11")
    expect(bouton.className).toContain("min-w-11")
    expect(bouton.getAttribute("aria-haspopup")).toBe("dialog")
    expect(bouton.getAttribute("aria-expanded")).toBe("false")
  })

  it("ouvre le choix avec EXACTEMENT les formats du catalogue mobile, traduits", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />)
    fireEvent.click(fab())

    expect(fab().getAttribute("aria-expanded")).toBe("true")
    expect(libelles()).toEqual(creationEntries({ mobile: true, handle: null }).map((entry) => t(entry.labelKey)))
    // La publication est le geste principal : elle ouvre la liste.
    expect(libelles()[0]).toBe("Publication")
    expect(libelles()).toContain("Actu")
    // Sans handle publié, « Album » n'a pas d'adresse : il n'est pas offert —
    // `creationEntries` tranche, pas le bouton.
    expect(choix().textContent).not.toMatch(/Album/i)
  })

  it("offre « Album » dès qu'un handle publié est connu", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} handle="ndong.marie" />)
    fireEvent.click(fab())

    expect(libelles()).toContain("Album")
  })

  it("remonte le format choisi et referme le choix", () => {
    const onSelect = vi.fn()
    renderAt(<ReseauMobileCreateButton onSelect={onSelect} />)
    fireEvent.click(fab())

    const second = choix().querySelectorAll("button")[1]
    expect(second).toBeTruthy()
    fireEvent.click(second!)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(creationEntries({ mobile: true, handle: null })[1]!.kind)
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
    expect(fab().getAttribute("aria-expanded")).toBe("false")
  })

  it("Échap referme le CHOIX seul, et rend le focus au déclencheur", () => {
    renderAt(<ReseauMobileCreateButton onSelect={vi.fn()} />)
    const bouton = fab()
    fireEvent.click(bouton)
    expect(choix()).toBeTruthy()

    fireEvent.keyDown(document, { key: "Escape" })

    // La commande, elle, RESTE : Échap ferme la surface supérieure, pas
    // l'écran qui la porte.
    expect(screen.queryByRole("group", { name: "Formats" })).toBeNull()
    expect(document.body.contains(bouton)).toBe(true)
    expect(document.activeElement).toBe(bouton)
  })
})
