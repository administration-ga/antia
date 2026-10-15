// Dupliqué de socle/packages/agent-features/src/features/iappel/ConferenceHintCard.test.tsx @ ad2e7fdc2 — adaptations : montage dans l'enveloppe du moteur (`renderWithEngine` : i18n fr) ; textes composés par `conferenceHintCopy` avec le `t` du moteur ; ton « poste » retiré (les trois cas qui le passaient prennent « espace », leur comportement est inchangé) ; pile Échap lue dans la coque.
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { escapeStack } from "../../shell/floating-surface/escape-stack"
import { renderWithEngine as render } from "../../tests/engine-wrapper"
import { conferenceHintCopy } from "./conference-hint"

/**
 * La carte « Conférence », MONTÉE (ADR-0149, fiche §6.2, prompt P3).
 *
 * Ce que le module pur `conference-hint.ts` ne peut pas garder, parce que ça
 * n'existe qu'au rendu : le RÔLE de chaque forme (un dialogue bloquant n'est
 * pas un statut), la frappe Échap qui ne doit fermer qu'UNE fois — y compris
 * sous une carte iCom qui écoute Échap pour se ranger —, et l'absence de
 * portail : tout reste dans le téléphone (ADR-0148).
 */

// Le VRAI hook d'a11y (focus initial, restitution) ; le reste d'ui-v2 écarté,
// pour ne pas charger trente composants dans un test de carte.
vi.mock("@antia/ui", async () => {
	const real = await import("@antia/ui")
	return { useModalA11y: real.useModalA11y }
})

const { ConferenceHintCard } = await import("./ConferenceHintCard")

// Les mots de la carte sont ceux du module pur, traduits par le `t` du moteur (français).
const { t } = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" })
const T1 = conferenceHintCopy("T1", { capacity: 11, members: 25 }, t)
const T2 = conferenceHintCopy("T2", { capacity: 11 }, t)
const T3 = conferenceHintCopy("T3", { capacity: 11 }, t)

afterEach(() => {
	cleanup()
	// Une carte démontée ne laisse aucune couche dans la pile Échap : sinon
	// elle mangerait la frappe de la surface d'appel restée à l'écran.
	expect(escapeStack.size()).toBe(0)
})

/** Aucun portail : `render` pose UN conteneur sous `body`, et rien d'autre. */
function expectNothingPortaled(container: HTMLElement) {
	expect(document.body.childElementCount).toBe(1)
	for (const node of document.querySelectorAll(
		".iappel-hint, .iappel-hint-screen, .iappel-hint-line",
	)) {
		expect(container.contains(node)).toBe(true)
	}
}

describe("T1 — le choix bloquant, avant l'appel", () => {
	it("est un dialogue nommé par son titre et décrit par son corps", () => {
		const { container } = render(
			<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} />,
		)
		const dialog = screen.getByRole("dialog", { name: "Ce groupe compte 25 membres." })
		expect(dialog.getAttribute("aria-modal")).toBe("true")
		expect(dialog.dataset.kind).toBe("T1")
		expect(dialog.dataset.tone).toBe("espace")
		const description = document.getElementById(dialog.getAttribute("aria-describedby") ?? "")
		expect(description?.textContent).toBe(T1.body)
		// L'écran assombri est le parent direct du dialogue, EN FLUX.
		expect(dialog.parentElement?.classList.contains("iappel-hint-screen")).toBe(true)
		expect(screen.queryByRole("status")).toBeNull()
		expectNothingPortaled(container)
	})

	it("les trois gestes appellent chacun le leur", () => {
		const onPrimary = vi.fn()
		const onSecondary = vi.fn()
		const onDismiss = vi.fn()
		render(
			<ConferenceHintCard
				kind="T1"
				copy={T1}
				tone="espace"
				onPrimary={onPrimary}
				onSecondary={onSecondary}
				onDismiss={onDismiss}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "Choisir 10 personnes" }))
		expect(onPrimary).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByRole("button", { name: "Lancer une conférence" }))
		expect(onSecondary).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("le focus entre sur l'action principale, et revient au déclencheur", () => {
		const Scene = ({ open }: { open: boolean }) => (
			<div>
				<button type="button">Appeler le groupe</button>
				{open ? (
					<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} />
				) : null}
			</div>
		)
		const vue = render(<Scene open={false} />)
		const declencheur = screen.getByRole("button", { name: "Appeler le groupe" })
		declencheur.focus()

		vue.rerender(<Scene open={true} />)
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "Choisir 10 personnes" }),
		)

		vue.rerender(<Scene open={false} />)
		expect(document.activeElement).toBe(declencheur)
	})

	it("Tab boucle dans le dialogue — le régime modal", () => {
		render(
			<ConferenceHintCard
				kind="T1"
				copy={T1}
				tone="immersive"
				onPrimary={() => {}}
				onSecondary={() => {}}
				onDismiss={() => {}}
			/>,
		)
		const fermer = screen.getByRole("button", { name: "Fermer" })
		const secondaire = screen.getByRole("button", { name: "Lancer une conférence" })
		secondaire.focus()
		fireEvent.keyDown(secondaire, { key: "Tab" })
		expect(document.activeElement).toBe(fermer)
		fireEvent.keyDown(fermer, { key: "Tab", shiftKey: true })
		expect(document.activeElement).toBe(secondaire)
	})

	it("Échap ferme UNE fois, par la pile, quand le focus est hors du dialogue", () => {
		const onDismiss = vi.fn()
		render(
			<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} onDismiss={onDismiss} />,
		)
		;(document.activeElement as HTMLElement | null)?.blur()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("Échap dans le dialogue ferme UNE fois, et la carte iCom autour ne se range pas", () => {
		// Les deux cartes iCom écoutent Échap sur leur racine et ignorent une
		// frappe déjà prévenue ; la pile Échap aussi. Sans la prévention, la
		// même frappe fermerait le dialogue ET rangerait le téléphone.
		const onDismiss = vi.fn()
		const rangerLaCarte = vi.fn()
		render(
			<aside
				onKeyDown={(event) => {
					if (event.key === "Escape" && !event.defaultPrevented) rangerLaCarte()
				}}
			>
				<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} onDismiss={onDismiss} />
			</aside>,
		)
		const principal = screen.getByRole("button", { name: "Choisir 10 personnes" })
		fireEvent.keyDown(principal, { key: "Escape" })
		expect(onDismiss).toHaveBeenCalledTimes(1)
		expect(rangerLaCarte).not.toHaveBeenCalled()
	})

	it("Échap tapé dans une AUTRE surface lui revient : T1 cède la frappe", () => {
		// La pile est globale : sans garde, T1 (palier OVERLAY) fermait le
		// dialogue quand l'usager voulait réduire la scène d'un appel.
		const onDismiss = vi.fn()
		const reduireAppel = vi.fn()
		const retirer = escapeStack.push({
			id: "call-surface-test",
			priority: 10,
			onEscape: () => {
				reduireAppel()
			},
		})
		render(
			<div>
				<button type="button">Scène de l'appel</button>
				<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} onDismiss={onDismiss} />
			</div>,
		)
		screen.getByRole("button", { name: "Scène de l'appel" }).focus()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onDismiss).not.toHaveBeenCalled()
		expect(reduireAppel).toHaveBeenCalledTimes(1)
		retirer()
	})

	it("carte iCom couverte par un appel : T1, masqué, ne mange pas la frappe", () => {
		const onDismiss = vi.fn()
		const reduireAppel = vi.fn()
		const retirer = escapeStack.push({
			id: "call-surface-cover-test",
			priority: 10,
			onEscape: () => {
				reduireAppel()
			},
		})
		render(
			<div data-call="cover">
				<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} onDismiss={onDismiss} />
			</div>,
		)
		;(document.activeElement as HTMLElement | null)?.blur()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onDismiss).not.toHaveBeenCalled()
		expect(reduireAppel).toHaveBeenCalledTimes(1)
		retirer()
	})

	it("sans onDismiss : ni croix, ni couche Échap", () => {
		render(<ConferenceHintCard kind="T1" copy={T1} tone="espace" onPrimary={() => {}} />)
		expect(screen.queryByRole("button", { name: "Fermer" })).toBeNull()
		expect(escapeStack.size()).toBe(0)
	})
})

describe("T2 — l'appel est complet, dans le sélecteur", () => {
	it("est un statut, jamais un dialogue, et ne vole pas le focus", () => {
		const Scene = () => (
			<div>
				<input aria-label="Rechercher" />
				<ConferenceHintCard
					kind="T2"
					copy={T2}
					tone="espace"
					onPrimary={() => {}}
					onSecondary={() => {}}
				/>
			</div>
		)
		const vue = render(<Scene />)
		const champ = screen.getByLabelText("Rechercher")
		champ.focus()
		vue.rerender(<Scene />)

		const statut = screen.getByRole("status")
		expect(statut.classList.contains("iappel-hint")).toBe(true)
		expect(statut.dataset.kind).toBe("T2")
		expect(statut.textContent).toContain("10 correspondants — l'appel est complet.")
		expect(screen.queryByRole("dialog")).toBeNull()
		expect(document.activeElement).toBe(champ)
		expect(escapeStack.size()).toBe(0)
		expectNothingPortaled(vue.container)
	})

	it("« Lancer une conférence » et « Continuer l'appel » appellent chacun le leur", () => {
		const onPrimary = vi.fn()
		const onSecondary = vi.fn()
		render(
			<ConferenceHintCard
				kind="T2"
				copy={T2}
				tone="espace"
				onPrimary={onPrimary}
				onSecondary={onSecondary}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "Lancer une conférence" }))
		fireEvent.click(screen.getByRole("button", { name: "Continuer l'appel" }))
		expect(onPrimary).toHaveBeenCalledTimes(1)
		expect(onSecondary).toHaveBeenCalledTimes(1)
	})
})

describe("T3 — la ligne qui remplace « Ajouter »", () => {
	it("est une ligne de statut, sans secondaire", () => {
		const onPrimary = vi.fn()
		const { container } = render(
			<div className="iappel-stage">
				<ConferenceHintCard
					kind="T3"
					copy={T3}
					tone="immersive"
					onPrimary={onPrimary}
					onSecondary={() => {}}
				/>
			</div>,
		)
		const ligne = screen.getByRole("status")
		expect(ligne.classList.contains("iappel-hint-line")).toBe(true)
		expect(ligne.textContent).toContain("Appel complet · 11 personnes.")
		expect(screen.queryByRole("dialog")).toBeNull()
		// Un seul geste : la conférence. Rien à « continuer », l'appel continue.
		const boutons = screen.getAllByRole("button")
		expect(boutons).toHaveLength(1)
		fireEvent.click(boutons[0]!)
		expect(onPrimary).toHaveBeenCalledTimes(1)
		expectNothingPortaled(container)
	})

	it("le corps reste lu par un lecteur d'écran, mais ne s'affiche pas", () => {
		// La ligne doit tenir dans la réserve de la barre « Ajouter » : seul le
		// titre s'affiche, la phrase complète reste dans le statut.
		render(<ConferenceHintCard kind="T3" copy={T3} tone="immersive" onPrimary={() => {}} />)
		const ligne = screen.getByRole("status")
		expect(ligne.textContent).toContain(T3.body)
		const corps = [...ligne.querySelectorAll("span")].find((node) => node.textContent === T3.body)
		expect(corps?.classList.contains("sr-only")).toBe(true)
	})

	it("sans onPrimary, elle informe sans proposer de commande morte", () => {
		render(<ConferenceHintCard kind="T3" copy={T3} tone="immersive" />)
		expect(screen.getByRole("status").classList.contains("iappel-hint-line")).toBe(true)
		expect(screen.queryByRole("button")).toBeNull()
	})
})
