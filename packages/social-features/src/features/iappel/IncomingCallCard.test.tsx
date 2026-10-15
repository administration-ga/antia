// Dupliqué de socle/packages/agent-features/src/features/iappel/IncomingCallCard.test.tsx @ ad2e7fdc2 — adaptations : montage dans l'enveloppe du moteur (`renderWithEngine` : i18n fr) ; appel personnel sans priorité ; cas retirés avec leurs branches — transmission au secrétariat d'un poste (2) et appel prioritaire (3) ; « un appel ordinaire reste Appel entrant, sans marque » gardé parmi les tête-à-tête.
// @vitest-environment jsdom

import { cleanup, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine as render } from "../../tests/engine-wrapper"
import type { CallGroupInviteePreview, RingingCall } from "./call-types"

/**
 * L'appel entrant de GROUPE, monté — point de vue B de la fiche « appels de
 * groupe de 2 à 11 » (ADR-0149).
 *
 * Ce que le module pur `incoming-group.ts` ne prouve pas : que la carte rend
 * bien la ligne et la pile, qu'un tête-à-tête n'en hérite pas, et que les
 * deux ronds de décision restent là quand la carte s'allonge.
 */

vi.mock("../reseau-personnel/Avatar", () => ({
	Avatar: ({ displayName }: { displayName: string }) => (
		<span data-testid="avatar">{displayName}</span>
	),
}))

const { IncomingCallCard } = await import("./IncomingCallCard")

afterEach(() => {
	cleanup()
})

const NOMS = ["Marie Ndong", "Paul Obame", "Aline Mba", "Joël Nze"]

function invitees(n: number): CallGroupInviteePreview[] {
	return NOMS.slice(0, n).map((name, index) => ({
		userId: `u${index}`,
		name,
		avatarUrl: null,
	}))
}

function ringing(extra: Partial<RingingCall> = {}): RingingCall {
	return {
		meetingId: "m1" as RingingCall["meetingId"],
		kind: "direct",
		scope: "personnel",
		caller: { name: "Anselme Moussavou" },
		mediaType: "audio",
		ringingSince: 0,
		...extra,
	}
}

function groupCall(memberCount: number, served: number, title = ""): RingingCall {
	return ringing({
		kind: "group",
		group: { title, memberCount, invitees: invitees(served) },
	})
}

function renderCard(call: RingingCall) {
	return render(
		<IncomingCallCard call={call} onAnswer={() => {}} onDecline={() => {}} />,
	)
}

describe("IncomingCallCard — appel de groupe", () => {
	it("groupe de 7 : la ligne, quatre visages et le reste", () => {
		renderCard(groupCall(7, 4))

		expect(screen.getByText("Appel de groupe · 7 personnes")).toBeTruthy()
		const pile = screen.getByRole("img", {
			name: "Avec Marie Ndong, Paul Obame, Aline Mba, Joël Nze et 2 autres, vous compris",
		})
		expect(within(pile).getAllByTestId("incoming-pile-avatar")).toHaveLength(4)
		// « +2 vous compris », comme la planche : le reste compte l'invité qui
		// regarde, dont le visage n'est pas servi dans sa propre sonnerie.
		expect(within(pile).getByText("+2")).toBeTruthy()
		expect(within(pile).getByText("vous compris")).toBeTruthy()
		// L'appelant reste nommé, au-dessus de la pile.
		expect(screen.getByRole("heading", { name: "Anselme Moussavou" })).toBeTruthy()
	})

	it("groupe de 8 : « +3 »", () => {
		renderCard(groupCall(8, 4))
		const pile = screen.getByRole("img", { name: /^Avec Marie Ndong/ })
		expect(within(pile).getByText("+3")).toBeTruthy()
	})

	it("groupe de 11 : quatre visages et « +6 »", () => {
		renderCard(groupCall(11, 4))

		expect(screen.getByText("Appel de groupe · 11 personnes")).toBeTruthy()
		const pile = screen.getByRole("img", { name: /et 6 autres, vous compris$/ })
		expect(within(pile).getAllByTestId("incoming-pile-avatar")).toHaveLength(4)
		expect(within(pile).getByText("+6")).toBeTruthy()
	})

	it("groupe de 3 : un visage et « +1 vous compris »", () => {
		renderCard(groupCall(3, 1))

		expect(screen.getByText("Appel de groupe · 3 personnes")).toBeTruthy()
		const pile = screen.getByRole("img", { name: "Avec Marie Ndong et 1 autre, vous compris" })
		expect(within(pile).getAllByTestId("incoming-pile-avatar")).toHaveLength(1)
		expect(within(pile).getByText("+1")).toBeTruthy()
	})

	it("le titre du groupe reste en puce ; plus de « X et k autres »", () => {
		renderCard(groupCall(7, 4, "Cellule budget"))

		expect(screen.getByText("Cellule budget")).toBeTruthy()
		expect(screen.queryByText(/^Anselme Moussavou et \d+ autres$/)).toBeNull()
	})

	it("sans titre : aucune puce redondante", () => {
		renderCard(groupCall(7, 4))
		expect(screen.queryByText(/Anselme Moussavou et/)).toBeNull()
		expect(screen.queryByText("Plusieurs correspondants")).toBeNull()
	})

	it("conviés absents : la ligne seule, pas de pile", () => {
		renderCard(ringing({ kind: "group", group: { title: "", memberCount: 7 } }))

		expect(screen.getByText("Appel de groupe · 7 personnes")).toBeTruthy()
		expect(screen.queryByRole("img")).toBeNull()
	})

	it("densité compact : même ligne, même pile", () => {
		render(
			<IncomingCallCard
				call={groupCall(11, 4)}
				onAnswer={() => {}}
				onDecline={() => {}}
				density="compact"
			/>,
		)
		expect(screen.getByText("Appel de groupe · 11 personnes")).toBeTruthy()
		expect(screen.getAllByTestId("incoming-pile-avatar")).toHaveLength(4)
	})

	it("Refuser et Répondre restent présents", () => {
		renderCard(groupCall(11, 4))
		expect(screen.getByRole("button", { name: "Refuser" })).toBeTruthy()
		expect(screen.getByRole("button", { name: "Répondre" })).toBeTruthy()
	})
})

describe("IncomingCallCard — tête-à-tête", () => {
	it("ni ligne de groupe ni pile", () => {
		renderCard(ringing())

		expect(screen.queryByText(/^Appel de groupe/)).toBeNull()
		expect(screen.queryByRole("img")).toBeNull()
		expect(screen.queryAllByTestId("incoming-pile-avatar")).toHaveLength(0)
		expect(screen.getByRole("button", { name: "Refuser" })).toBeTruthy()
		expect(screen.getByRole("button", { name: "Répondre" })).toBeTruthy()
	})

	it("un groupe à deux se dit « Appel », sans pile", () => {
		renderCard(groupCall(2, 0))

		expect(screen.getByText("Appel")).toBeTruthy()
		expect(screen.queryByRole("img")).toBeNull()
	})

	it("un appel ordinaire reste « Appel entrant », sans marque", () => {
		const { container } = renderCard(ringing())
		expect(screen.getByText("Appel entrant")).toBeTruthy()
		expect(container.querySelector("[data-priority]")).toBeNull()
	})
})
