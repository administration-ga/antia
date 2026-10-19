// Dupliqué de socle/packages/agent-features/src/features/messagerie/GroupCallInviteePicker.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n français) ; cas « compte EXEMPTÉ » retiré avec l'exemption (aucun compte « illimité » dans le moteur, plafond constant) ; « organisation qui abaisse le plafond » devient un plafond plus bas passé au sélecteur (même calcul) ; membres désignés par leur personne.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ConferenceHintCardProps } from "../iappel/ConferenceHintCard"
import { renderWithEngine } from "../../tests/engine-wrapper"
import type { MembreDuGroupe } from "./groupe-gestion"

/**
 * IC-08 puis ADR-0149 — l'écran qui remplace « Appeler le groupe » sur un
 * grand fil.
 *
 * Ce que ce test tient, et qui se ratait en silence : le plafond annoncé
 * AVANT la soumission (case inerte, pas un refus au clic), le compteur
 * « x/10 correspondants » partagé avec la couche d'appel, la carte Conférence T2 à la
 * dernière case — une seule fois par ouverture —, le bouton inerte sous deux
 * personnes, et surtout « une personne non cochée NE SONNE PAS ».
 *
 * La carte est REMPLACÉE par un double : ce test garde la DÉCISION du
 * sélecteur (quand T2 paraît, ce que ses deux actions font), pas le dessin de
 * la carte, qui a ses propres tests dans `iappel/`.
 */

vi.mock("../iappel/ConferenceHintCard", () => ({
	ConferenceHintCard: ({
		kind,
		copy,
		onPrimary,
		onSecondary,
	}: ConferenceHintCardProps) => (
		<div data-testid={`carte-${kind}`} role="status">
			<p>{copy.title}</p>
			<p>{copy.body}</p>
			{onPrimary ? (
				<button type="button" onClick={onPrimary}>
					{copy.primary}
				</button>
			) : null}
			{copy.secondary !== null && onSecondary ? (
				<button type="button" onClick={onSecondary}>
					{copy.secondary}
				</button>
			) : null}
		</div>
	),
}))
vi.mock("../reseau-personnel/Avatar", () => ({
	Avatar: ({ displayName }: { displayName: string }) => (
		<span data-testid="avatar">{displayName}</span>
	),
}))

const { GroupCallInviteePicker } = await import("./GroupCallInviteePicker")

function membre(
	userId: string,
	displayName: string,
	extra: Partial<MembreDuGroupe> = {},
): MembreDuGroupe {
	return {
		userId,
		displayName,
		handle: displayName.toLowerCase(),
		avatarUrl: null,
		role: "member",
		isMe: false,
		joinedAt: 0,
		...extra,
	}
}

/** Moi + douze autres : un fil de treize, plus grand qu'un appel de onze. */
const NOMS = [
	"Bilie",
	"Carla",
	"Dieudonne",
	"Estelle",
	"Fabrice",
	"Gaston",
	"Hortense",
	"Ines",
	"Jules",
	"Kevine",
	"Leon",
	"Maryse",
] as const

const MEMBRES: MembreDuGroupe[] = [
	membre("persons_moi", "Alice", { isMe: true, role: "owner" }),
	...NOMS.map((nom, index) => membre(`u${index + 1}`, nom)),
]

type PickerProps = Parameters<typeof GroupCallInviteePicker>[0]

function poser(props: Partial<PickerProps> = {}) {
	const onStart = vi.fn()
	const onCancel = vi.fn()
	const vue = renderWithEngine(
		<GroupCallInviteePicker
			title="Comité budget"
			members={MEMBRES}
			capacity={11}
			onStart={onStart}
			onCancel={onCancel}
			{...props}
		/>,
	)
	return { vue, onStart, onCancel }
}

function cocher(noms: readonly string[]) {
	for (const nom of noms) {
		fireEvent.click(screen.getByLabelText(`Appeler ${nom}`))
	}
}

describe("le plafond s'annonce AVANT la soumission", () => {
	it("l'en-tête dit la taille du groupe et le plafond de l'appel", () => {
		const { vue } = poser()
		expect(
			screen.getByText(
				"Ce groupe compte 13 membres. Un appel de groupe réunit 11 personnes au plus, vous compris.",
			),
		).toBeTruthy()
		vue.unmount()
	})

	it("le compteur suit chaque coche — « x/10 correspondants »", () => {
		const { vue } = poser()
		expect(screen.getByText("0/10 correspondants")).toBeTruthy()
		cocher(["Bilie", "Carla", "Dieudonne"])
		const compteur = screen.getByText("3/10 correspondants")
		expect(compteur.getAttribute("role")).toBe("status")
		vue.unmount()
	})

	it("à dix correspondants, la onzième case est inerte et la carte T2 paraît", () => {
		const { vue } = poser({ onConvokeMeeting: vi.fn() })
		expect(screen.queryByTestId("carte-T2")).toBeNull()

		cocher(NOMS.slice(0, 10))
		expect(
			(screen.getByLabelText("Appeler Leon") as HTMLInputElement).disabled,
		).toBe(true)
		expect(
			screen.getByText(
				"10/10 correspondants — appel complet (11 en tout, vous compris)",
			),
		).toBeTruthy()
		const carte = screen.getByTestId("carte-T2")
		expect(carte.textContent).toContain("10 correspondants — l'appel est complet.")

		// Décocher reste possible, et libère la case.
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		expect(
			(screen.getByLabelText("Appeler Leon") as HTMLInputElement).disabled,
		).toBe(false)
		vue.unmount()
	})

	it("un plafond plus bas abaisse le compteur", () => {
		const { vue } = poser({ capacity: 5 })
		cocher(["Bilie", "Carla", "Dieudonne", "Estelle"])
		expect(
			(screen.getByLabelText("Appeler Fabrice") as HTMLInputElement).disabled,
		).toBe(true)
		expect(
			screen.getByText("4/4 correspondants — appel complet (5 en tout, vous compris)"),
		).toBeTruthy()
		vue.unmount()
	})

	it("à l'ouverture, le focus entre dans l'écran — pas sur la page derrière", () => {
		const { vue } = poser()
		expect(document.activeElement?.id).toBe("msg-appel-groupe")
		vue.unmount()
	})

	it("je ne figure pas dans ma propre liste", () => {
		const { vue } = poser()
		expect(screen.queryByLabelText("Appeler Alice")).toBeNull()
		vue.unmount()
	})
})

describe("la carte Conférence T2 — une fois par ouverture", () => {
	it("« Continuer l'appel » la ferme, et décocher puis recocher ne la rouvre pas", () => {
		const { vue } = poser({ onConvokeMeeting: vi.fn() })
		cocher(NOMS.slice(0, 10))
		fireEvent.click(screen.getByRole("button", { name: "Continuer l'appel" }))
		expect(screen.queryByTestId("carte-T2")).toBeNull()

		fireEvent.click(screen.getByLabelText("Appeler Jules"))
		fireEvent.click(screen.getByLabelText("Appeler Jules"))
		expect(screen.getByText(/10\/10 correspondants/)).toBeTruthy()
		expect(screen.queryByTestId("carte-T2")).toBeNull()
		vue.unmount()
	})

	it("« Lancer une conférence » de la carte passe par l'alternative, sans appeler", () => {
		const onConvokeMeeting = vi.fn()
		const { vue, onStart } = poser({ onConvokeMeeting })
		cocher(NOMS.slice(0, 10))
		const carte = screen.getByTestId("carte-T2")
		fireEvent.click(
			Array.from(carte.querySelectorAll("button")).find(
				(bouton) => bouton.textContent === "Lancer une conférence",
			) as HTMLButtonElement,
		)
		expect(onConvokeMeeting).toHaveBeenCalledTimes(1)
		expect(onStart).not.toHaveBeenCalled()
		vue.unmount()
	})

	it("« Continuer l'appel » rend le focus à « Appeler », pas à la page", () => {
		const { vue } = poser({ onConvokeMeeting: vi.fn() })
		cocher(NOMS.slice(0, 10))
		const continuer = screen.getByRole("button", { name: "Continuer l'appel" })
		continuer.focus()
		fireEvent.click(continuer)
		expect(document.activeElement).toBe(screen.getByRole("button", { name: /Appeler$/ }))
		vue.unmount()
	})

	it("une nouvelle ouverture du sélecteur remontre la carte", () => {
		const premiere = poser({ onConvokeMeeting: vi.fn() })
		cocher(NOMS.slice(0, 10))
		fireEvent.click(screen.getByRole("button", { name: "Continuer l'appel" }))
		premiere.vue.unmount()

		const seconde = poser({ onConvokeMeeting: vi.fn() })
		cocher(NOMS.slice(0, 10))
		expect(screen.getByTestId("carte-T2")).toBeTruthy()
		seconde.vue.unmount()
	})
})

describe("le geste ne part que quand il est composable", () => {
	it("sous deux personnes, « Appeler » est inerte et DIT pourquoi", () => {
		const { vue, onStart } = poser()
		const appeler = screen.getByRole("button", { name: /Appeler$/ })
		expect((appeler as HTMLButtonElement).disabled).toBe(true)

		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		expect(screen.getByText(/au moins 2 personnes/)).toBeTruthy()
		fireEvent.click(appeler)
		expect(onStart).not.toHaveBeenCalled()
		vue.unmount()
	})

	it("le serveur reçoit EXACTEMENT les personnes cochées", () => {
		const { vue, onStart } = poser()
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		fireEvent.click(screen.getByLabelText("Appeler Dieudonne"))
		// Cochée puis décochée : elle ne doit pas sonner.
		fireEvent.click(screen.getByLabelText("Appeler Carla"))
		fireEvent.click(screen.getByLabelText("Appeler Carla"))

		fireEvent.click(screen.getByRole("button", { name: /Appeler$/ }))
		expect(onStart).toHaveBeenCalledTimes(1)
		expect(onStart).toHaveBeenCalledWith("audio", ["u1", "u3"])
		vue.unmount()
	})

	it("à dix correspondants, l'appel part avec les dix", () => {
		const { vue, onStart } = poser()
		cocher(NOMS.slice(0, 10))
		fireEvent.click(screen.getByRole("button", { name: /Appeler$/ }))
		expect(onStart).toHaveBeenCalledWith(
			"audio",
			NOMS.slice(0, 10).map((_, index) => `u${index + 1}`),
		)
		vue.unmount()
	})

	it("la vidéo passe le même média jusqu'au serveur", () => {
		const { vue, onStart } = poser()
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		fireEvent.click(screen.getByLabelText("Appeler Carla"))
		fireEvent.click(screen.getByRole("button", { name: "Vidéo" }))
		expect(onStart).toHaveBeenCalledWith("video", ["u1", "u2"])
		vue.unmount()
	})

	it("un lancement en vol ne part pas deux fois", () => {
		const { vue, onStart } = poser({ pending: true })
		fireEvent.click(screen.getByRole("button", { name: /Appel…/ }))
		expect(onStart).not.toHaveBeenCalled()
		vue.unmount()
	})
})

describe("la conférence est une alternative EXPLICITE", () => {
	it("le lien est offert, et n'est jamais une conversion automatique", () => {
		const onConvokeMeeting = vi.fn()
		const { vue, onStart } = poser({ onConvokeMeeting })
		fireEvent.click(
			screen.getByRole("button", { name: /Lancer une conférence/ }),
		)
		expect(onConvokeMeeting).toHaveBeenCalledTimes(1)
		expect(onStart).not.toHaveBeenCalled()
		vue.unmount()
	})

	it("sans hôte pour l'accueillir, le lien ne s'affiche pas", () => {
		const { vue } = poser()
		expect(screen.queryByText(/Lancer une conférence/)).toBeNull()
		expect(screen.queryByText(/Convoquer une réunion/)).toBeNull()
		vue.unmount()
	})
})

describe("la liste peut avoir vieilli", () => {
	it("une personne partie n'est pas appelée, et l'écran le dit", () => {
		// Le serveur refuse l'appel ENTIER si un identifiant n'est plus membre :
		// l'écran doit retirer la ligne périmée avant de soumettre, pas échouer
		// au clic.
		const onStart = vi.fn()
		const props = {
			title: "Comité budget",
			capacity: 11,
			onStart,
			onCancel: vi.fn(),
		}
		const vue = renderWithEngine(
			<GroupCallInviteePicker {...props} members={MEMBRES} />,
		)
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		fireEvent.click(screen.getByLabelText("Appeler Carla"))
		fireEvent.click(screen.getByLabelText("Appeler Dieudonne"))

		vue.rerender(
			<GroupCallInviteePicker
				{...props}
				members={MEMBRES.filter((m) => m.userId !== "u2")}
			/>,
		)
		expect(
			screen.getByText(/a quitté le groupe : elle ne sera pas appelée/),
		).toBeTruthy()

		fireEvent.click(screen.getByRole("button", { name: /Appeler$/ }))
		expect(onStart).toHaveBeenCalledWith("audio", ["u1", "u3"])
		vue.unmount()
	})

	it("à 10/10 avec une personne partie, la case réactivée coche VRAIMENT", () => {
		// La case se réactive (l'écran compte 9) : un clic sans effet serait
		// une case active mais inerte.
		const onStart = vi.fn()
		const props = { title: "Comité budget", capacity: 3, onStart, onCancel: vi.fn() }
		const vue = renderWithEngine(<GroupCallInviteePicker {...props} members={MEMBRES} />)
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		fireEvent.click(screen.getByLabelText("Appeler Carla"))
		expect((screen.getByLabelText("Appeler Dieudonne") as HTMLInputElement).disabled).toBe(true)

		vue.rerender(
			<GroupCallInviteePicker {...props} members={MEMBRES.filter((m) => m.userId !== "u2")} />,
		)
		const dieudonne = screen.getByLabelText("Appeler Dieudonne") as HTMLInputElement
		expect(dieudonne.disabled).toBe(false)
		fireEvent.click(dieudonne)
		expect(dieudonne.checked).toBe(true)

		fireEvent.click(screen.getByRole("button", { name: /Appeler$/ }))
		expect(onStart).toHaveBeenCalledWith("audio", ["u1", "u3"])
		vue.unmount()
	})

	it("le refus du serveur s'affiche tel qu'il a été lu", () => {
		const { vue } = poser({
			errorMessage: "Une des personnes choisies n'est plus dans ce groupe.",
		})
		expect(
			screen.getByText("Une des personnes choisies n'est plus dans ce groupe."),
		).toBeTruthy()
		vue.unmount()
	})

	it("revenir à la conversation ne lance rien", () => {
		const { vue, onCancel, onStart } = poser()
		fireEvent.click(screen.getByLabelText("Revenir à la conversation"))
		expect(onCancel).toHaveBeenCalledTimes(1)
		expect(onStart).not.toHaveBeenCalled()
		vue.unmount()
	})
})

describe("la recherche filtre sans perdre la sélection", () => {
	it("cocher, filtrer, lancer : la personne masquée reste choisie", () => {
		const { vue, onStart } = poser()
		fireEvent.click(screen.getByLabelText("Appeler Bilie"))
		fireEvent.click(screen.getByLabelText("Appeler Carla"))
		fireEvent.change(screen.getByLabelText("Rechercher un membre"), {
			target: { value: "hort" },
		})
		expect(screen.queryByLabelText("Appeler Bilie")).toBeNull()
		fireEvent.click(screen.getByRole("button", { name: /Appeler$/ }))
		expect(onStart).toHaveBeenCalledWith("audio", ["u1", "u2"])
		vue.unmount()
	})
})
