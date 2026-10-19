// Dupliqué de socle/packages/agent-features/src/features/messagerie/ForwardMessageSheet.test.tsx @ ad2e7fdc2 — adaptations : monté dans l'enveloppe du moteur (`renderWithEngine` : i18n française — libellés attendus : texte exact du socle) ; fils lus par `threadId`, sans `poste` (TQ*) ; cible de groupe au vocabulaire du moteur (`group`) ; le refus d'exemple dit « réseau » (`MESSAGE_FORWARD_CROSS_NETWORK`) au lieu d'« espace ».
// @vitest-environment jsdom

/**
 * ForwardMessageSheet — le choix EXPLICITE de la cible (ADR-0143 §5).
 *
 * Monté avec la couche de recherche de relations simulée ; les lignes, le
 * filtre et les états viennent de `forward-targets.ts` (testé en pur). Ce qui
 * se prouve ici : la conversation courante n'est JAMAIS proposée, l'envoi
 * verrouille les lignes, et le refus du serveur se lit DANS la feuille.
 */

import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { ForwardMessageSheet } from "./ForwardMessageSheet"

// La feuille se rend par PORTAIL : sans nettoyage, deux tests liraient le
// même document et trouveraient deux fois chaque ligne.
afterEach(cleanup)

const mocks = vi.hoisted(() => ({
	search: {
		items: [] as unknown[],
		isPending: false,
		isError: false,
		refetch: vi.fn(),
		enabled: false,
		eligible: false,
		settled: false,
		term: "",
	},
}))

vi.mock("../reseau-personnel/use-relation-search", () => ({
	useRelationSearch: () => mocks.search,
	RELATION_SEARCH_MIN_CHARS: 2,
	RELATION_SEARCH_LIMIT: 25,
	isRelationSearchTerm: (term: string) => term.trim().length >= 2,
}))

const FILS = [
	{
		threadId: "chat-1",
		counterpart: { displayName: "Bob Mba", handle: "bob" },
	},
	{
		threadId: "chat-2",
		counterpart: { displayName: "Carla Nzé", handle: "carla" },
	},
]

const GROUPES = [{ threadId: "grp-1", title: "Comité budget", memberCount: 3 }]

function poser(props: Partial<Parameters<typeof ForwardMessageSheet>[0]> = {}) {
	const onSelect = vi.fn()
	const onOpenChange = vi.fn()
	const vue = renderWithEngine(
		<ForwardMessageSheet
			open
			onOpenChange={onOpenChange}
			threads={FILS}
			groupThreads={GROUPES}
			currentKey="chat:chat-1"
			showRelations
			sendingKey={null}
			errorMessage={null}
			onSelect={onSelect}
			{...props}
		/>,
	)
	return { vue, onSelect, onOpenChange }
}

describe("la liste des cibles", () => {
	it("propose conversations et groupes, JAMAIS la conversation courante", () => {
		poser()
		expect(screen.getByText("Carla Nzé")).toBeTruthy()
		expect(screen.getByText("Comité budget")).toBeTruthy()
		expect(screen.queryByText("Bob Mba")).toBeNull()
	})

	it("filtre par la recherche, accents pliés", () => {
		poser()
		fireEvent.change(
			screen.getByLabelText("Rechercher la cible du transfert"),
			{ target: { value: "nze" } },
		)
		expect(screen.getByText("Carla Nzé")).toBeTruthy()
		expect(screen.queryByText("Comité budget")).toBeNull()
	})

	it("dit quand rien ne correspond", () => {
		poser()
		fireEvent.change(
			screen.getByLabelText("Rechercher la cible du transfert"),
			{ target: { value: "personne" } },
		)
		expect(screen.getByText(/Aucune cible ne correspond/)).toBeTruthy()
	})
})

describe("le geste", () => {
	it("un clic choisit la cible — l'argument part tel quel", () => {
		const { onSelect } = poser()
		fireEvent.click(
			screen.getByLabelText("Transférer dans ce groupe : Comité budget"),
		)
		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "groupe",
				to: { kind: "group", threadId: "grp-1" },
			}),
		)
	})

	it("l'envoi en cours verrouille TOUTES les lignes", () => {
		poser({ sendingKey: "groupe:grp-1" })
		const ligne = screen.getByLabelText(
			"Transférer dans cette conversation : Carla Nzé",
		)
		expect((ligne as HTMLButtonElement).disabled).toBe(true)
	})

	it("le refus du serveur se lit DANS la feuille", () => {
		poser({ errorMessage: "Un message ne se transfère pas d'un réseau à l'autre." })
		expect(
			screen.getByText("Un message ne se transfère pas d'un réseau à l'autre."),
		).toBeTruthy()
	})

	it("une panne de la liste se dit, avec « Réessayer »", () => {
		const onRetry = vi.fn()
		poser({ threads: undefined, isError: true, onRetry })
		fireEvent.click(screen.getByText("Réessayer"))
		expect(onRetry).toHaveBeenCalledOnce()
	})

	it("l'attente de la liste n'est pas une liste vide", () => {
		poser({ threads: undefined })
		expect(screen.getByText("Chargement de vos conversations…")).toBeTruthy()
	})
})
