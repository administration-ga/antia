// Dupliqué de socle/packages/agent-features/src/features/iappel/AddToCallPanel.test.tsx @ ad2e7fdc2 — adaptations : montage dans l'enveloppe du moteur (`renderWithEngine` : i18n fr, réseau courant) ; mutation du moteur (`calls.groupCalls.addInvitee`) ; relations au DTO du moteur (`otherPersonId`, `headline`) ; annuaire de poste retiré (mock `useContactSearch`, props `scope` et `orgId`) ; cas inchangés.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ESCAPE_PRIORITY, escapeStack } from "../../shell/floating-surface/escape-stack"
import { useEscapeLayer } from "../../shell/floating-surface/use-escape-layer"
import { renderWithEngine as render } from "../../tests/engine-wrapper"

/**
 * IC-11 / IC-12 — le sélecteur « Ajouter à l'appel », monté.
 *
 * Aucun test ne lisait ce composant. Les trois défauts gardés ici ne se voient
 * ni au typage ni à l'exécution des modules purs : le focus qui n'entre pas, le
 * focus qui ne revient pas, et la frappe Échap qui servait DEUX surfaces.
 */

const mocks = vi.hoisted(() => ({
	relations: {
		items: [
			{
				otherPersonId: "p-ada",
				displayName: "Ada Ngoua",
				handle: "ada",
				headline: "Chef de service",
			},
			{
				otherPersonId: "p-bilie",
				displayName: "Bilie Mba",
				handle: "bilie",
				headline: null,
			},
		],
		isLoading: false,
		isError: false,
		retry: vi.fn(),
		hasMore: false,
		isLoadingMore: false,
		loadMore: vi.fn(),
	},
}))

vi.mock("@antsia/api/engine", () => ({
	api: { modules: { calls: { groupCalls: { addInvitee: "addInvitee" } } } },
}))
vi.mock("@antsia/api/hooks", () => ({
	useConvexMutationQuery: () => ({ mutateAsync: vi.fn(async () => ({})) }),
}))
// Le VRAI hook d'a11y : c'est lui qu'on met à l'épreuve (`trapFocus: false`).
// Seul le reste du paquet ui-v2 est écarté, pour ne pas charger trente
// composants dans un test de focus.
vi.mock("@antsia/ui", async () => {
	const real = await import("@antsia/ui")
	return { useModalA11y: real.useModalA11y }
})
vi.mock("sonner", () => ({
	toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))
vi.mock("../reseau-personnel/use-dual-connection-pagination", () => ({
	usePersonalConnections: () => mocks.relations,
}))

vi.mock("../../shell/ReseauQueryError", () => ({
	ReseauQueryError: () => null,
}))
vi.mock("../../stores/call-store", () => ({
	callStore: { reconcileSlotFromMeeting: vi.fn() },
}))

const { AddToCallPanel } = await import("./AddToCallPanel")

type PanelProps = Parameters<typeof AddToCallPanel>[0]

/** L'appel VIVANT derrière le panneau : sa commande doit rester atteignable. */
function Scene({
	onClose = () => {},
	pose,
	onMinimize,
	open = true,
}: {
	onClose?: () => void
	pose?: PanelProps["pose"]
	onMinimize?: () => void
	open?: boolean
}) {
	useEscapeLayer({
		id: "call-surface",
		priority: ESCAPE_PRIORITY.SURFACE,
		enabled: onMinimize !== undefined,
		onEscape: () => onMinimize?.(),
	})
	return (
		<div>
			<button type="button" data-testid="ouvrir">
				Ajouter
			</button>
			<button type="button" data-testid="raccrocher">
				Raccrocher
			</button>
			{open ? (
				<AddToCallPanel
					meetingId={"m1" as PanelProps["meetingId"]}
					maxParticipants={100}
					callKind="group"
					participants={undefined}
					fallbackOccupied={2}
					pose={pose}
					onClose={onClose}
				/>
			) : null}
		</div>
	)
}

afterEach(() => {
	expect(escapeStack.size()).toBe(0)
})

describe("le focus entre dans la surface, et en ressort par où il est venu", () => {
	it("à l'ouverture, le focus est dans le champ de recherche", () => {
		const vue = render(<Scene />)
		expect(document.activeElement).toBe(
			screen.getByLabelText("Rechercher une personne à ajouter"),
		)
		vue.unmount()
	})

	it("à la fermeture, le focus revient au DÉCLENCHEUR", () => {
		const vue = render(<Scene open={false} />)
		const declencheur = screen.getByTestId("ouvrir")
		declencheur.focus()
		expect(document.activeElement).toBe(declencheur)

		vue.rerender(<Scene open={true} />)
		expect(document.activeElement).not.toBe(declencheur)

		vue.rerender(<Scene open={false} />)
		expect(document.activeElement).toBe(declencheur)
		vue.unmount()
	})

	it("Tab n'est PAS piégé — « Raccrocher » reste atteignable", () => {
		// Le panneau n'est pas modal : un appel vit derrière. Piéger Tab
		// enfermerait le clavier dans une liste de contacts pendant que la
		// commande la plus urgente de l'écran devient inatteignable.
		const vue = render(<Scene />)
		const champ = screen.getByLabelText("Rechercher une personne à ajouter")
		const prevented = !fireEvent.keyDown(champ, { key: "Tab" })
		expect(prevented).toBe(false)

		// Et rien n'a ramené le focus de force au premier élément du panneau.
		screen.getByTestId("raccrocher").focus()
		expect(document.activeElement).toBe(screen.getByTestId("raccrocher"))
		vue.unmount()
	})
})

describe("la POSE vient de l'hôte, pas d'un style en ligne", () => {
	it("téléphone ⇒ feuille, bureau ⇒ ancré", () => {
		const feuille = render(<Scene pose="sheet" />)
		expect(screen.getByRole("dialog")).toHaveProperty("dataset.pose", "sheet")
		// Aucune position en dur : c'est la feuille de style qui décide.
		expect(screen.getByRole("dialog").getAttribute("style")).toBeNull()
		feuille.unmount()

		const ancre = render(<Scene pose="anchored" />)
		expect(screen.getByRole("dialog")).toHaveProperty("dataset.pose", "anchored")
		ancre.unmount()
	})

	it("le panneau est nommé par son titre", () => {
		const vue = render(<Scene />)
		const dialog = screen.getByRole("dialog")
		const titre = document.getElementById(
			dialog.getAttribute("aria-labelledby") ?? "",
		)
		expect(titre?.textContent).toContain("Ajouter à l'appel")
		vue.unmount()
	})
})

describe("Échap ne sert qu'UNE surface (IC-12)", () => {
	it("ferme le sélecteur sans réduire l'appel", () => {
		const onClose = vi.fn()
		const onMinimize = vi.fn()
		const vue = render(<Scene onClose={onClose} onMinimize={onMinimize} />)

		fireEvent.keyDown(window, { key: "Escape" })

		expect(onClose).toHaveBeenCalledTimes(1)
		expect(onMinimize).not.toHaveBeenCalled()
		vue.unmount()
	})

	it("une fois le sélecteur parti, la frappe suivante réduit l'appel", () => {
		const onMinimize = vi.fn()
		const vue = render(<Scene onMinimize={onMinimize} open={false} />)
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onMinimize).toHaveBeenCalledTimes(1)
		vue.unmount()
	})
})
