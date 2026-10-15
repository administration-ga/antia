// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileTabBar.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (i18n française, réseau courant, table de routes et routeur en mémoire — le chemin courant change en changeant de routeur) au lieu des mocks du routage ; la rangée des volets de l'espace (`EspaceMobileVoletsRow`, retirée) cède la place au menu principal du RÉSEAU en feuille — le premier cas vérifie désormais que « Menu » reste fixe, OUVRE cette feuille sans retirer les volets, et qu'une navigation la referme (feuille simulée : son contenu se vérifie à part) ; nom accessible du bouton et des groupes lus dans l'i18n ; cas ajoutés : la feuille se referme à sa propre demande, aucun volet non servi (« Conférences »), adresses composées sur la base injectée.
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, memoryRouter, TEST_ROUTES } from "../../tests/engine-wrapper"
import { reseauAgentHref } from "../reseau-agent-nav"

vi.mock("@antia/ui", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}))

/* La feuille du menu a sa propre logique (destinations, profil publié) : ici,
   seul compte ce que la BARRE en fait — l'ouvrir, la refermer. Ses textes sont
   des constantes du test : ils ne sont pas des chaînes d'interface. */
const SHEET = vi.hoisted(() => ({ label: "Menu principal simulé", close: "Fermer la feuille" }))

vi.mock("./ReseauMobileMenuSheet", () => ({
  ReseauMobileMenuSheet: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div role="dialog" aria-label={SHEET.label}>
        <button type="button" onClick={() => onOpenChange(false)}>
          {SHEET.close}
        </button>
      </div>
    ) : null,
}))

import { ReseauMobileTabBar } from "./ReseauMobileTabBar"

const HOME = TEST_ROUTES.home()

/** La barre, sur la page dont le chemin est donné. */
function at(pathname: string, ui: ReactElement): ReactElement {
  return <EngineTestWrapper router={memoryRouter({ pathname }).implementation}>{ui}</EngineTestWrapper>
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe("ReseauMobileTabBar", () => {
  it("garde Menu fixe, ouvre le menu principal du réseau sans retirer les volets, et le referme à la navigation", () => {
    const { rerender } = render(at(HOME, <ReseauMobileTabBar active="fil" badges={{ unreadNotifications: 2 }} />))

    const menu = screen.getByRole("button", { name: "Ouvrir le menu principal" })
    expect(menu.getAttribute("aria-expanded")).toBe("false")
    expect(menu.getAttribute("aria-haspopup")).toBe("dialog")
    expect(menu.textContent).toContain("Menu")
    expect(screen.getByRole("group", { name: "Sous-menus du réseau" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Fil/i }).getAttribute("aria-current")).toBe("page")
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(menu)

    expect(document.body.contains(menu)).toBe(true)
    expect(menu.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("dialog", { name: SHEET.label })).toBeTruthy()
    // Les volets restent dans la barre : le menu porte ce qu'elle NE porte pas.
    expect(screen.getByRole("link", { name: /Fil/i })).toBeTruthy()

    // Une navigation referme la feuille : elle masquerait la page demandée.
    rerender(at(`${HOME}/ailleurs`, <ReseauMobileTabBar active="relations" badges={{ unreadNotifications: 2 }} />))

    expect(menu.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("group", { name: "Sous-menus du réseau" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Relations/i }).getAttribute("aria-current")).toBe("page")
  })

  it("referme la feuille quand elle le demande", () => {
    render(at(HOME, <ReseauMobileTabBar active="fil" badges={{}} />))
    const menu = screen.getByRole("button", { name: "Ouvrir le menu principal" })
    fireEvent.click(menu)
    fireEvent.click(screen.getByRole("button", { name: SHEET.close }))
    expect(menu.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("ramène le sous-menu ACTIF dans le champ quand il change (R-15)", () => {
    // Les sous-menus défilent à droite de « Menu » : arriver par un lien
    // profond sur le dernier laissait l'onglet actif hors de l'écran, sans
    // rien qui le signale. Le repositionnement est instantané — donc muet
    // pour `prefers-reduced-motion`.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    const { rerender } = render(at(HOME, <ReseauMobileTabBar active="fil" badges={{}} />))
    expect(scrollIntoView).toHaveBeenCalled()
    const appelsAvant = scrollIntoView.mock.calls.length

    rerender(at(HOME, <ReseauMobileTabBar active="enregistrements" badges={{}} />))

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(appelsAvant)
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: "nearest",
      inline: "nearest",
    })
    // C'est bien l'onglet ACTIF qui est ramené, pas le premier venu.
    expect(screen.getByRole("link", { name: /Signets/i }).getAttribute("aria-current")).toBe("page")
  })

  it("n'offre aucun volet que la page ne sert pas", () => {
    // « Conférences » attend le module `live` : un onglet vers un volet vide
    // serait un cul-de-sac.
    render(at(HOME, <ReseauMobileTabBar active="fil" badges={{}} />))
    expect(screen.queryByRole("link", { name: /Conférences/i })).toBeNull()
    const volets = screen.getByRole("group", { name: "Sous-menus du réseau" }).querySelectorAll("a")
    expect(volets).toHaveLength(6)
  })

  it("adresse chaque volet sur la base injectée par l'application", () => {
    render(at(HOME, <ReseauMobileTabBar active="fil" badges={{}} />))
    expect(screen.getByRole("link", { name: /Fil/i }).getAttribute("href")).toBe(HOME)
    expect(screen.getByRole("link", { name: /Relations/i }).getAttribute("href")).toBe(reseauAgentHref("relations", HOME))
  })
})
