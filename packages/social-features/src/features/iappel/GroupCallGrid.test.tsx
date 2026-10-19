// Dupliqué de socle/packages/agent-features/src/features/iappel/GroupCallGrid.test.tsx @ ad2e7fdc2 — adaptations : montage dans l'enveloppe du moteur (`renderWithEngine` : i18n fr) ; textes attendus inchangés (locales françaises) ; le cas du compte EXEMPTÉ (absent du moteur) garde sa règle — T3 suit les places restantes, pas l'effectif.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { renderWithEngine as render } from "../../tests/engine-wrapper"
import type { CallParticipantView } from "./call-types"
import type { ConferenceHintCopy, ConferenceHintKind } from "./conference-hint"

/**
 * IC-10 — la grille de groupe, MONTÉE.
 *
 * Deux défauts se gardent ici, et aucun ne se voit au typage :
 *
 *  · ma vidéo était rendue DEUX fois — dans ma vignette (`isMe`) et dans
 *    l'incrustation `LocalPip` posée par-dessus la grille ;
 *  · le mode « compact » ne rendait aucune scène : il resserrait la
 *    gouttière, et les vingt vignettes restaient en grille.
 *
 * ADR-0149 (2026-09-14) — de 2 à 11 au téléphone iCom : grille à pistes,
 * « Ajouter » toujours en barre, ligne T3 au dernier siège, épingle au toucher,
 * puce « Appelant ».
 */

vi.mock("@livekit/components-react", () => ({
	VideoTrack: ({ trackRef }: { trackRef: { id: string } }) => (
		<div data-testid="video-track" data-identity={trackRef.id} />
	),
}))
vi.mock("../reseau-personnel/Avatar", () => ({
	Avatar: ({ displayName }: { displayName: string }) => (
		<span data-testid="avatar">{displayName}</span>
	),
}))
// La carte « Conférence » a ses propres tests : ici, on vérifie seulement que
// la scène la POSE à la place de la barre, avec les bons mots et le bon geste.
vi.mock("./ConferenceHintCard", () => ({
	ConferenceHintCard: ({
		kind,
		copy,
		onPrimary,
	}: {
		kind: ConferenceHintKind
		copy: ConferenceHintCopy
		onPrimary?: (() => void) | null
	}) => (
		<div role="status" data-testid="conference-hint" data-kind={kind}>
			<span>{copy.title}</span>
			{onPrimary ? (
				<button type="button" onClick={onPrimary}>
					{copy.primary}
				</button>
			) : null}
		</div>
	),
}))

const { GroupCallGrid } = await import("./GroupCallGrid")

/** Le conteneur mesuré : jsdom rend 0 px, `ResizeObserver` n'existe pas. */
function mockStage(width: number, height: number) {
	class FakeResizeObserver {
		constructor(private readonly cb: ResizeObserverCallback) {}
		observe(target: Element) {
			this.cb(
				[
					{
						target,
						contentRect: { width, height } as DOMRectReadOnly,
					} as ResizeObserverEntry,
				],
				this as unknown as ResizeObserver,
			)
		}
		unobserve() {}
		disconnect() {}
	}
	vi.stubGlobal("ResizeObserver", FakeResizeObserver)
}

function participant(
	id: string,
	state: CallParticipantView["state"],
	extra: Partial<CallParticipantView> = {},
): CallParticipantView {
	return {
		userId: id as CallParticipantView["userId"],
		name: id,
		avatarUrl: null,
		state,
		reason: null,
		isMe: false,
		...extra,
	} as CallParticipantView
}

const SEPT: CallParticipantView[] = [
	participant("moi", "host", { isMe: true }),
	participant("ada", "connected"),
	participant("bilie", "connected"),
	participant("chris", "ringing"),
	participant("dede", "ringing"),
	participant("eyi", "declined"),
	participant("fabi", "missed"),
]

/** `n` personnes, moi compris (en dernier), les autres en ligne. */
function personnes(n: number): CallParticipantView[] {
	const autres = Array.from({ length: n - 1 }, (_, index) =>
		participant(`p${String(index + 1).padStart(2, "0")}`, "connected"),
	)
	return [...autres, participant("moi", "host", { isMe: true })]
}

const NEUF: CallParticipantView[] = [
	...SEPT,
	participant("gino", "connected"),
	participant("hugo", "connected"),
]

const track = (id: string) => ({ id }) as never

beforeAll(() => {
	mockStage(400, 420)
})

afterEach(() => {
	// Un test qui change la surface la rend : les suivants lisent 400 × 420.
	mockStage(400, 420)
})

describe("ma vidéo n'est rendue QU'UNE fois", () => {
	it("la piste locale se pose dans MA vignette, et nulle part ailleurs", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT}
				// Le contrat : la carte des pistes n'a PAS l'identité locale.
				tracksByIdentity={new Map([["ada", track("ada")]])}
				localTrack={track("moi")}
				localIdentity="moi"
				viewport="desktop"
			/>,
		)
		const rendues = screen
			.getAllByTestId("video-track")
			.map((node) => node.getAttribute("data-identity"))
		expect(rendues.filter((identity) => identity === "moi")).toHaveLength(1)
		vue.unmount()
	})

	it("sans caméra locale, ma vignette montre mon avatar — pas un cadre noir", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT}
				tracksByIdentity={new Map()}
				localTrack={null}
				localIdentity="moi"
				viewport="desktop"
			/>,
		)
		expect(screen.queryAllByTestId("video-track")).toHaveLength(0)
		expect(screen.getAllByTestId("avatar").length).toBeGreaterThan(0)
		vue.unmount()
	})
})

describe("la scène remplace la grille quand la grille ne tient plus", () => {
	it("sept personnes dans 400 px restent une GRILLE (ADR-0149)", () => {
		// Réécrit le 2026-09-14 : sept basculaient en scène dans cette fenêtre
		// (plafond étroit à six). Un appel ordinaire monte à onze.
		const vue = render(
			<GroupCallGrid participants={SEPT} tracksByIdentity={new Map()} viewport="desktop" />,
		)
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-layout")).toBe("grid")
		expect(document.querySelector(".iappel-strip")).toBeNull()
		vue.unmount()
	})

	it("neuf personnes sur la carte de rail (312 px) : scène + bandeau", () => {
		mockStage(312, 580)
		const vue = render(
			<GroupCallGrid participants={NEUF} tracksByIdentity={new Map()} viewport="desktop" />,
		)
		const grille = document.querySelector(".iappel-grid")
		expect(grille?.getAttribute("data-layout")).toBe("stage")
		expect(document.querySelector(".iappel-stage-main")).not.toBeNull()
		// Le bandeau porte tout le monde SAUF celui qui est à la scène.
		expect(document.querySelectorAll(".iappel-strip-tile")).toHaveLength(8)
		// … et MA vignette le ferme, pour s'y ancrer à droite.
		const bande = [...document.querySelectorAll(".iappel-strip-tile")]
		expect(bande.at(-1)?.getAttribute("data-me")).toBe("true")
		vue.unmount()
	})

	it("ÉPINGLER met la personne à la scène, et l'y garde", () => {
		mockStage(312, 580)
		const vue = render(
			<GroupCallGrid
				participants={NEUF}
				tracksByIdentity={new Map()}
				speakingIdentities={new Set(["ada"])}
				viewport="desktop"
			/>,
		)
		// Sans épingle, celui qui parle occupe la scène.
		expect(
			document.querySelector(".iappel-stage-main .iappel-tile-name")?.textContent,
		).toContain("ada")

		fireEvent.click(screen.getByLabelText("Mettre bilie à la scène"))
		expect(
			document.querySelector(".iappel-stage-main .iappel-tile-name")?.textContent,
		).toContain("bilie")

		// Second clic : on détache.
		fireEvent.click(screen.getByLabelText("Détacher bilie de la scène"))
		expect(
			document.querySelector(".iappel-stage-main .iappel-tile-name")?.textContent,
		).toContain("ada")
		vue.unmount()
	})

	it("à trois, la grille reste une grille", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		expect(
			document.querySelector(".iappel-grid")?.getAttribute("data-layout"),
		).toBe("grid")
		expect(document.querySelector(".iappel-strip")).toBeNull()
		vue.unmount()
	})
})

describe("toucher une vignette de GRILLE l'épingle (ADR-0149)", () => {
	it("tap ⇒ scène + bande sur cette personne ; retap ⇒ la grille revient", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		const grille = () => document.querySelector(".iappel-grid")
		expect(grille()?.getAttribute("data-layout")).toBe("grid")

		fireEvent.click(screen.getByLabelText("Mettre ada à la scène"))
		expect(grille()?.getAttribute("data-layout")).toBe("stage")
		expect(
			document.querySelector(".iappel-stage-main .iappel-tile-name")?.textContent,
		).toBe("ada")
		expect(document.querySelectorAll(".iappel-strip-tile")).toHaveLength(2)

		fireEvent.click(screen.getByLabelText("Détacher ada de la scène"))
		expect(grille()?.getAttribute("data-layout")).toBe("grid")
		expect(document.querySelector(".iappel-strip")).toBeNull()
		vue.unmount()
	})

	it("en grille, chaque vignette est un bouton", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		for (const tile of document.querySelectorAll(".iappel-grid > .iappel-tile")) {
			expect(tile.tagName).toBe("BUTTON")
			expect(tile.getAttribute("aria-pressed")).toBe("false")
		}
		vue.unmount()
	})
})

describe("la puce « Appelant »", () => {
	it("se lit chez un INVITÉ, sur la vignette de l'auteur de l'appel", () => {
		const vue = render(
			<GroupCallGrid
				participants={[
					participant("ada", "host", { isCaller: true }),
					participant("bilie", "connected"),
					participant("moi", "connected", { isMe: true }),
				]}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		const puces = document.querySelectorAll(".iappel-tile-caller")
		expect(puces).toHaveLength(1)
		expect(puces[0]?.textContent).toBe("Appelant")
		const tile = puces[0]?.closest(".iappel-tile")
		expect(tile?.querySelector(".iappel-tile-name")?.textContent).toBe("ada")
		expect(tile?.getAttribute("data-caller")).toBe("true")
		// L'`aria-label` remplace le contenu : la puce doit y être redite.
		expect(tile?.getAttribute("aria-label")).toBe("Mettre ada (appelant) à la scène")
		vue.unmount()
	})

	it("absente sur « Vous » — l'appelant sait qu'il a appelé", () => {
		const vue = render(
			<GroupCallGrid
				participants={[
					participant("moi", "host", { isMe: true, isCaller: true }),
					participant("ada", "connected"),
					participant("bilie", "ringing"),
				]}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		expect(document.querySelector(".iappel-tile-caller")).toBeNull()
		vue.unmount()
	})

	it("absente de la bande : 96 px n'y portent que le nom", () => {
		mockStage(312, 580)
		const vue = render(
			<GroupCallGrid
				participants={[
					...NEUF.map((p) => (p.name === "hugo" ? { ...p, isCaller: true } : p)),
				]}
				tracksByIdentity={new Map()}
				speakingIdentities={new Set(["ada"])}
				viewport="desktop"
			/>,
		)
		expect(document.querySelector(".iappel-strip .iappel-tile-caller")).toBeNull()
		vue.unmount()
	})
})

describe("la commande « Ajouter »", () => {
	it("absente quand l'hôte ne la donne pas", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
				onAdd={null}
			/>,
		)
		expect(
			screen.queryByLabelText("Ajouter une personne à l'appel"),
		).toBeNull()
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-add")).toBeNull()
		vue.unmount()
	})

	it("toujours une BARRE, jamais une cellule — même à trois (ADR-0149)", () => {
		// Réécrit le 2026-09-14 : à trois, « Ajouter » était une CELLULE de la
		// grille. À onze, elle volait une place ; elle est devenue une barre.
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
				onAdd={() => {}}
			/>,
		)
		expect(document.querySelector(".iappel-add-bar")).not.toBeNull()
		expect(document.querySelectorAll(".iappel-grid > .iappel-tile")).toHaveLength(3)
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-add")).toBe("bar")
		vue.unmount()
	})

	it("elle appelle bien l'hôte", () => {
		const onAdd = vi.fn()
		const vue = render(
			<GroupCallGrid
				participants={SEPT}
				tracksByIdentity={new Map()}
				viewport="desktop"
				onAdd={onAdd}
			/>,
		)
		fireEvent.click(screen.getByLabelText("Ajouter une personne à l'appel"))
		expect(onAdd).toHaveBeenCalledTimes(1)
		vue.unmount()
	})
})

describe("l'appel PLEIN : la ligne T3 remplace « Ajouter » (ADR-0149)", () => {
	const plein = (overrides: { remaining?: number | null; onLaunch?: (() => void) | null } = {}) => ({
		capacity: 11,
		remaining: 0,
		context: "thread" as const,
		onLaunch: null,
		...overrides,
	})

	it("plus de bouton « Ajouter », une ligne T3 à sa place, et la réserve gardée", () => {
		const vue = render(
			<GroupCallGrid
				participants={personnes(11)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={() => {}}
				conference={plein()}
			/>,
		)
		expect(screen.queryByLabelText("Ajouter une personne à l'appel")).toBeNull()
		expect(document.querySelector(".iappel-add-bar")).toBeNull()
		const ligne = screen.getByTestId("conference-hint")
		expect(ligne.getAttribute("data-kind")).toBe("T3")
		expect(ligne.getAttribute("role")).toBe("status")
		expect(ligne.textContent).toContain("Appel complet · 11 personnes.")
		// La grille garde la place de la barre : rien ne se rebat au 11ᵉ siège.
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-add")).toBe("bar")
		vue.unmount()
	})

	it("« Lancer une conférence » appelle l'hôte", () => {
		const onLaunch = vi.fn()
		const vue = render(
			<GroupCallGrid
				participants={personnes(11)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				conference={plein({ onLaunch })}
			/>,
		)
		fireEvent.click(screen.getByText("Lancer une conférence"))
		expect(onLaunch).toHaveBeenCalledTimes(1)
		vue.unmount()
	})

	it("vaut dès que les places sont prises, quel que soit l'effectif affiché — la borne de structure", () => {
		// Le socle prouvait ici qu'un compte EXEMPTÉ voyait aussi T3 ; le moteur
		// n'a pas de compte sans plafond : reste la règle — T3 suit les places
		// restantes du serveur, pas le nombre de vignettes.
		const vue = render(
			<GroupCallGrid
				participants={personnes(5)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={() => {}}
				conference={plein()}
			/>,
		)
		expect(screen.getByTestId("conference-hint").getAttribute("data-kind")).toBe("T3")
		expect(screen.queryByLabelText("Ajouter une personne à l'appel")).toBeNull()
		vue.unmount()
	})

	it("un siège qui se libère fait revenir « Ajouter »", () => {
		const onAdd = () => {}
		const vue = render(
			<GroupCallGrid
				participants={personnes(11)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={onAdd}
				conference={plein()}
			/>,
		)
		expect(screen.queryByTestId("conference-hint")).not.toBeNull()
		vue.rerender(
			<GroupCallGrid
				participants={personnes(10)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={onAdd}
				conference={plein({ remaining: 1 })}
			/>,
		)
		expect(screen.queryByTestId("conference-hint")).toBeNull()
		expect(screen.getByLabelText("Ajouter une personne à l'appel")).toBeTruthy()
		vue.unmount()
	})

	it("places inconnues : ni ligne T3, ni conclusion hâtive", () => {
		const vue = render(
			<GroupCallGrid
				participants={personnes(5)}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={() => {}}
				conference={plein({ remaining: null })}
			/>,
		)
		expect(screen.queryByTestId("conference-hint")).toBeNull()
		expect(screen.getByLabelText("Ajouter une personne à l'appel")).toBeTruthy()
		vue.unmount()
	})
})

describe("la vidéo se pose dans la BONNE vignette — clé userId, pas identité LiveKit (2026-09-13)", () => {
	it("ma vignette porte ma caméra même quand ma clé n'est pas mon userId (jeton muet)", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				localTrack={track("moi")}
				// Un serveur ancien : le jeton ne porte pas le userId, la clé
				// retombe sur l'identité brute `{subject}::{nonce}`.
				localIdentity="subject-moi::1a2b3c4d"
				viewport="desktop"
			/>,
		)
		const video = screen.getByTestId("video-track")
		expect(video.getAttribute("data-identity")).toBe("moi")
		const tile = video.closest(".iappel-tile")
		expect(tile?.querySelector(".iappel-tile-name")?.textContent).toContain("(vous)")
		expect(tile?.getAttribute("data-me")).toBe("true")
		vue.unmount()
	})

	it("la caméra d'un autre se pose dans SA vignette, par userId", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map([["bilie", track("bilie")]])}
				localTrack={null}
				localIdentity="moi"
				viewport="desktop"
			/>,
		)
		const video = screen.getByTestId("video-track")
		const tile = video.closest(".iappel-tile")
		expect(tile?.querySelector(".iappel-tile-name")?.textContent).toBe("bilie")
		expect(tile?.getAttribute("data-me")).toBeNull()
		vue.unmount()
	})
})

describe("le modèle WhatsApp : la grille remplit la scène", () => {
	it("je suis la DERNIÈRE case, même en tant qu'hôte", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		const noms = [...document.querySelectorAll(".iappel-tile-name")].map(
			(node) => node.textContent,
		)
		expect(noms).toEqual(["ada", "bilie", "moi (vous)"])
		vue.unmount()
	})

	it("à trois, sur deux colonnes, la première case prend toute la largeur", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		const grille = document.querySelector<HTMLElement>(".iappel-grid")
		expect(grille?.getAttribute("data-layout")).toBe("grid")
		expect(grille?.style.getPropertyValue("--iappel-grid-cols")).toBe("2")
		expect(grille?.style.getPropertyValue("--iappel-grid-rows")).toBe("2")
		expect(grille?.style.getPropertyValue("--iappel-grid-tracks")).toBe("2")
		const tiles = document.querySelectorAll<HTMLElement>(".iappel-grid > .iappel-tile")
		expect(tiles).toHaveLength(3)
		expect(tiles[0]?.getAttribute("data-span")).toBe("row")
		expect(tiles[1]?.getAttribute("data-span")).toBeNull()
		expect(tiles[2]?.getAttribute("data-span")).toBeNull()
		expect(tiles[0]?.style.getPropertyValue("--iappel-tile-span")).toBe("2")
		expect(tiles[1]?.style.getPropertyValue("--iappel-tile-span")).toBe("1")
		// Aucune proportion figée : la case se déduit des pistes et des lignes.
		expect(tiles[0]?.style.aspectRatio ?? "").toBe("")
		vue.unmount()
	})

	it("à trois AVEC « Ajouter », la première case s'étale quand même (ADR-0149)", () => {
		// Réécrit le 2026-09-14 : la cellule « Ajouter » rendait le compte pair
		// et aucune case ne s'étalait. C'est une barre désormais.
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
				onAdd={() => {}}
			/>,
		)
		const tiles = document.querySelectorAll(".iappel-grid > .iappel-tile")
		expect(tiles).toHaveLength(3)
		expect(tiles[0]?.getAttribute("data-span")).toBe("row")
		vue.unmount()
	})

	it("le micro coupé se lit à côté du nom, en bas à gauche", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				mutedIdentities={new Set(["ada"])}
				viewport="desktop"
			/>,
		)
		const muet = screen.getByLabelText("Micro coupé")
		expect(muet.closest(".iappel-tile-foot")).not.toBeNull()
		expect(
			muet.closest(".iappel-tile")?.querySelector(".iappel-tile-name")?.textContent,
		).toBe("ada")
		vue.unmount()
	})
})

describe("de 9 à 11 au téléphone iCom : la première ligne absorbe le reste (ADR-0149)", () => {
	it("dix personnes dans 390 × 580 : une case pleine largeur en tête", () => {
		mockStage(390, 580)
		const vue = render(
			<GroupCallGrid participants={personnes(10)} tracksByIdentity={new Map()} viewport="mobile" />,
		)
		const grille = document.querySelector<HTMLElement>(".iappel-grid")
		expect(grille?.getAttribute("data-layout")).toBe("grid")
		expect(grille?.style.getPropertyValue("--iappel-grid-cols")).toBe("3")
		expect(grille?.style.getPropertyValue("--iappel-grid-rows")).toBe("4")
		expect(grille?.style.getPropertyValue("--iappel-grid-tracks")).toBe("3")
		const tiles = document.querySelectorAll<HTMLElement>(".iappel-grid > .iappel-tile")
		expect(tiles).toHaveLength(10)
		expect(tiles[0]?.getAttribute("data-span")).toBe("row")
		expect(tiles[0]?.getAttribute("data-first-row")).toBe("true")
		expect(tiles[0]?.style.getPropertyValue("--iappel-tile-span")).toBe("3")
		expect(tiles[1]?.getAttribute("data-first-row")).toBeNull()
		expect(tiles[1]?.style.getPropertyValue("--iappel-tile-span")).toBe("1")
		expect(document.querySelectorAll('.iappel-tile[data-span="row"]')).toHaveLength(1)
		vue.unmount()
	})

	it("onze personnes : deux demi-cases en tête, aucune case pleine largeur", () => {
		mockStage(390, 580)
		const vue = render(
			<GroupCallGrid participants={personnes(11)} tracksByIdentity={new Map()} viewport="mobile" />,
		)
		const grille = document.querySelector<HTMLElement>(".iappel-grid")
		expect(grille?.getAttribute("data-layout")).toBe("grid")
		expect(grille?.style.getPropertyValue("--iappel-grid-tracks")).toBe("6")
		const tete = document.querySelectorAll<HTMLElement>('.iappel-grid > .iappel-tile[data-first-row="true"]')
		expect(tete).toHaveLength(2)
		expect(document.querySelector('.iappel-tile[data-span="row"]')).toBeNull()
		for (const tile of tete) {
			expect(tile.style.getPropertyValue("--iappel-tile-span")).toBe("3")
		}
		const tiles = document.querySelectorAll<HTMLElement>(".iappel-grid > .iappel-tile")
		expect(tiles[2]?.style.getPropertyValue("--iappel-tile-span")).toBe("2")
		// Et moi en dernière case.
		expect(tiles[10]?.getAttribute("data-me")).toBe("true")
		vue.unmount()
	})
})

describe("la vignette dit l'état de sa VIDÉO, pas seulement celui de la personne", () => {
	it("caméra demandée mais rien de publié : ma vignette dit « Caméra en cours… »", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				localTrack={null}
				localCameraPending
				localIdentity="moi"
				viewport="desktop"
			/>,
		)
		const mine = [...document.querySelectorAll(".iappel-tile")].find(
			(tile) => tile.getAttribute("data-me") === "true",
		)
		expect(mine?.querySelector(".iappel-tile-state")?.textContent).toBe("Caméra en cours…")
		// Les autres ne disent rien : leur présence se voit.
		const autres = [...document.querySelectorAll(".iappel-tile")].filter(
			(tile) => tile.getAttribute("data-me") !== "true",
		)
		for (const tile of autres) expect(tile.querySelector(".iappel-tile-state")).toBeNull()
		vue.unmount()
	})

	it("caméra demandée ET publiée : plus de mention, la vidéo parle", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				localTrack={track("moi")}
				localCameraPending={false}
				localIdentity="moi"
				viewport="desktop"
			/>,
		)
		const mine = [...document.querySelectorAll(".iappel-tile")].find(
			(tile) => tile.getAttribute("data-me") === "true",
		)
		expect(mine?.querySelector("video, [data-testid='video-track']")).not.toBeNull()
		expect(mine?.querySelector(".iappel-tile-state")).toBeNull()
		vue.unmount()
	})

	it("piste distante publiée mais pas encore reçue : « Connexion vidéo… », et le cadre est monté", () => {
		const enCours = {
			id: "ada",
			participant: { identity: "ada-livekit", isLocal: false },
			publication: { track: undefined, isSubscribed: false, isMuted: false },
		} as never
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map([["ada", enCours]])}
				viewport="desktop"
			/>,
		)
		const video = screen.getByTestId("video-track")
		const tile = video.closest(".iappel-tile")
		expect(tile?.querySelector(".iappel-tile-name")?.textContent).toBe("ada")
		expect(tile?.querySelector(".iappel-tile-state")?.textContent).toBe("Connexion vidéo…")
		vue.unmount()
	})
})

describe("correctifs de recette ADR-0149", () => {
	it("onze sièges et un refus au téléphone : douze vignettes, toujours une GRILLE", () => {
		mockStage(390, 580)
		const vue = render(
			<GroupCallGrid
				participants={[...personnes(11), participant("zoe", "declined")]}
				tracksByIdentity={new Map()}
				viewport="mobile"
				onAdd={() => {}}
			/>,
		)
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-layout")).toBe("grid")
		expect(document.querySelectorAll(".iappel-grid > .iappel-tile")).toHaveLength(12)
		vue.unmount()
	})

	it("une épingle sur quelqu'un qui RACCROCHE rend la grille", () => {
		const trois = SEPT.slice(0, 3)
		const vue = render(
			<GroupCallGrid participants={trois} tracksByIdentity={new Map()} viewport="desktop" />,
		)
		fireEvent.click(screen.getByLabelText("Mettre ada à la scène"))
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-layout")).toBe("stage")

		vue.rerender(
			<GroupCallGrid
				participants={trois.map((p) => (p.userId === "ada" ? { ...p, state: "left" } : p))}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-layout")).toBe("grid")
		expect(document.querySelector(".iappel-strip")).toBeNull()
		vue.unmount()
	})

	it("l'étiquette d'une vignette redit l'état, le micro coupé et « (vous) »", () => {
		const vue = render(
			<GroupCallGrid
				participants={[
					participant("ada", "connected"),
					participant("bilie", "ringing"),
					participant("moi", "host", { isMe: true }),
				]}
				tracksByIdentity={new Map()}
				mutedIdentities={new Set(["ada"])}
				viewport="desktop"
			/>,
		)
		const label = (id: string) =>
			document.querySelector(`.iappel-tile[data-user-id="${id}"]`)?.getAttribute("aria-label") ?? ""
		expect(label("ada")).toContain("micro coupé")
		expect(label("bilie")).toContain("Sonne")
		expect(label("moi")).toContain("(vous)")
		vue.unmount()
	})

	it("épingler au clavier garde le focus sur la vignette de la même personne", () => {
		const vue = render(
			<GroupCallGrid
				participants={SEPT.slice(0, 3)}
				tracksByIdentity={new Map()}
				viewport="desktop"
			/>,
		)
		const tuile = document.querySelector<HTMLButtonElement>('.iappel-tile[data-user-id="ada"]')
		tuile?.focus()
		if (tuile) fireEvent.click(tuile)
		const scene = document.querySelector(".iappel-stage-main")
		expect(scene?.contains(document.activeElement)).toBe(true)
		expect((document.activeElement as HTMLElement | null)?.dataset.userId).toBe("ada")

		fireEvent.click(document.activeElement as HTMLButtonElement)
		expect(document.querySelector(".iappel-grid")?.getAttribute("data-layout")).toBe("grid")
		expect((document.activeElement as HTMLElement | null)?.dataset.userId).toBe("ada")
		vue.unmount()
	})
})
