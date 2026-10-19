// Dupliqué de socle/packages/agent-features/src/features/iappel/group-stage.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans les locales françaises du moteur (`t` réel, pluriels i18next) — attendus inchangés ; personnes du moteur (`Id<"persons">`) ; cas retirés : raisons de poste (« Hors horaires », « Injoignable en direct ») ; cas ajouté : le titre composé d'un appel de groupe sans fil (`composeGroupCallTitle`) ; les scénarios à 390 px restent des surfaces étroites valables (le téléphone du moteur fait 440 px, même règle).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { CallParticipantView } from "./call-types"
import {
	avatarSizeFor,
	compareParticipants,
	composeGroupCallTitle,
	groupCallSubtitle,
	isLiveParticipant,
	participantStatusLabel,
	pickStageIdentity,
	planGroupGrid,
	reservesGridSeat,
	shortGroupLabel,
} from "./group-stage"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

function p(
	name: string,
	state: CallParticipantView["state"],
	reason: CallParticipantView["reason"] = null,
): CallParticipantView {
	return {
		userId: `u_${name}` as CallParticipantView["userId"],
		name,
		state,
		reason,
		isMe: false,
	}
}

describe("participantStatusLabel — « a refusé » n'est pas « indisponible »", () => {
	it("ne dit rien de ceux qui sont là : leur présence se voit", () => {
		expect(participantStatusLabel({ state: "host", reason: null }, t)).toBeNull()
		expect(
			participantStatusLabel({ state: "connected", reason: null }, t),
		).toBeNull()
	})

	it("distingue un refus HUMAIN d'un refus AUTOMATIQUE", () => {
		// Les confondre accuse de rejet quelqu'un dont le téléphone était en
		// silence — et prive l'appelant de la seule information utile : peut-il
		// rappeler, et quand.
		expect(participantStatusLabel({ state: "declined", reason: null }, t)).toBe(
			"A refusé",
		)
		expect(participantStatusLabel({ state: "unavailable", reason: "dnd" }, t)).toBe(
			"Indisponible",
		)
	})

	it("nomme chaque raison automatique", () => {
		expect(
			participantStatusLabel({ state: "unavailable", reason: "busy" }, t),
		).toBe("Déjà en ligne")
		expect(
			participantStatusLabel({ state: "unavailable", reason: "in_meeting" }, t),
		).toBe("En réunion")
	})

	it("« hors de ses relations » reste « Indisponible » — la grille ne dénonce personne", () => {
		// Volontairement le même mot que « ne pas déranger » : dire aux dix
		// autres conviés que l'absent n'est pas une relation de l'appelé
		// révélerait un lien privé à toute une salle.
		expect(
			participantStatusLabel({
				state: "unavailable",
				reason: "outside_relations",
			}, t),
		).toBe("Indisponible")
	})

	it("« sans réponse » n'est pas « a quitté »", () => {
		expect(participantStatusLabel({ state: "missed", reason: null }, t)).toBe(
			"Sans réponse",
		)
		expect(participantStatusLabel({ state: "left", reason: null }, t)).toBe(
			"A quitté",
		)
	})
})

describe("compareParticipants — celui qui parle passe devant", () => {
	it("range les vivants avant les sortis, sans jamais retirer personne", () => {
		// Retirer un participant sorti ferait croire qu'il n'a jamais été
		// convié : l'appelant perdrait la trace de « j'ai essayé de le joindre ».
		const ordre = [
			p("Zoe", "left"),
			p("Bob", "ringing"),
			p("Marie", "host"),
			p("Carla", "connected"),
			p("Paul", "declined"),
		]
			.sort(compareParticipants)
			.map((x) => x.name)
		expect(ordre).toEqual(["Marie", "Carla", "Bob", "Paul", "Zoe"])
	})

	it("à état égal, l'ordre est stable — sinon la grille tressaute", () => {
		const ordre = [p("Zoe", "connected"), p("Anna", "connected")]
			.sort(compareParticipants)
			.map((x) => x.name)
		expect(ordre).toEqual(["Anna", "Zoe"])
	})
})

describe("isLiveParticipant", () => {
	it("ne compte que ceux avec qui l'on parle", () => {
		expect(isLiveParticipant({ state: "host" })).toBe(true)
		expect(isLiveParticipant({ state: "connected" })).toBe(true)
		expect(isLiveParticipant({ state: "ringing" })).toBe(false)
		expect(isLiveParticipant({ state: "left" })).toBe(false)
	})
})

describe("planGroupGrid — une vignette doit rester reconnaissable", () => {
	it("à deux, le téléphone empile au lieu de fendre l'écran", () => {
		// Côte à côte sur 360 px, deux vignettes font 180 px de large : deux
		// fentes où l'on ne reconnaît personne.
		expect(planGroupGrid({ count: 2, viewport: "mobile" }).columns).toBe(1)
		expect(planGroupGrid({ count: 2, viewport: "desktop" }).columns).toBe(2)
	})

	it("de trois à six, une vraie grille", () => {
		expect(planGroupGrid({ count: 4, viewport: "mobile" }).columns).toBe(2)
		expect(planGroupGrid({ count: 6, viewport: "desktop" }).columns).toBe(3)
		expect(planGroupGrid({ count: 4, viewport: "desktop" }).compact).toBe(false)
	})

	it("au-delà de six, la grille cède la place à une scène + bandeau", () => {
		// Sinon les vignettes tombent à des bandes de 40 px de haut.
		expect(planGroupGrid({ count: 7, viewport: "desktop" }).compact).toBe(true)
		expect(planGroupGrid({ count: 20, viewport: "mobile" }).compact).toBe(true)
	})

	it("ne rend jamais zéro colonne, même sur une liste vide", () => {
		expect(planGroupGrid({ count: 0, viewport: "mobile" }).columns).toBe(1)
	})

	it.each([
		[7, 2],
		[8, 2],
		[9, 3],
		[10, 3],
		[11, 3],
	])(
		"repli SANS mesure au téléphone : %i personnes ⇒ %i colonnes, pas de scène",
		(count, columns) => {
			// Le premier rendu est PEINT avant la mesure : il doit rendre la même
			// grille qu'elle, sinon une image de scène + bande clignote.
			expect(planGroupGrid({ count, viewport: "mobile" })).toMatchObject({
				columns,
				compact: false,
			})
		},
	)

	it("repli SANS mesure au téléphone : douze personnes passent en scène", () => {
		expect(planGroupGrid({ count: 12, viewport: "mobile" }).compact).toBe(true)
	})
})

describe("planGroupGrid — MESURÉ sur le conteneur, pas sur le navigateur (IC-10)", () => {
	/**
	 * Le défaut : la disposition se décidait sur une media query d'ÉCRAN
	 * (≤ 959 px) alors que la surface réelle est une fenêtre de 400 px. Sur un
	 * grand écran, « desktop » donnait quatre colonnes dans 400 px — 86 px par
	 * personne. L'écran était large, la fenêtre ne l'était pas.
	 *
	 * La fenêtre flottante fait 400 × 680 ; la scène en occupe ~420 une fois
	 * l'en-tête et les commandes déduits. C'est cette hauteur-là qu'on mesure.
	 */
	const FENETRE = { width: 400, height: 420 }

	it("à deux dans la fenêtre flottante, on EMPILE", () => {
		// Côte à côte, deux vignettes de 186 px ; empilées, 261 px.
		expect(planGroupGrid({ count: 2, ...FENETRE }).columns).toBe(1)
	})

	it("trois et cinq tiennent en deux colonnes", () => {
		expect(planGroupGrid({ count: 3, ...FENETRE }).columns).toBe(2)
		expect(planGroupGrid({ count: 5, ...FENETRE }).columns).toBe(2)
		expect(planGroupGrid({ count: 5, ...FENETRE }).compact).toBe(false)
	})

	it("sept dans 400 px restent une GRILLE — 1 + 2 + 2 + 2 (ADR-0149)", () => {
		// Réécrit le 2026-09-14 : à sept, cette fenêtre basculait en scène
		// (plafond étroit à six). Un appel de groupe ordinaire monte désormais à
		// onze, et sept cases de 186 × 94 px restent reconnaissables.
		const plan = planGroupGrid({ count: 7, ...FENETRE })
		expect(plan.compact).toBe(false)
		expect(plan.columns).toBe(2)
		expect(plan.rows).toBe(4)
		expect(plan.firstRowTiles).toBe(1)
	})

	it("la même fenêtre AGRANDIE rend une vraie grille", () => {
		const large = planGroupGrid({ count: 5, width: 760, height: 380 })
		expect(large.columns).toBe(3)
		expect(large.compact).toBe(false)
	})

	it("en plein écran, sept personnes tiennent en quatre colonnes", () => {
		const plein = planGroupGrid({ count: 7, width: 1280, height: 800 })
		expect(plein.columns).toBe(4)
		expect(plein.compact).toBe(false)
	})

	it("cent participants ne se rendent JAMAIS en grille", () => {
		// Le plafond d'un appel est passé à cent le 2026-08-28 : au-delà d'une
		// douzaine de vignettes, une grille n'est plus une grille.
		expect(planGroupGrid({ count: 100, width: 1280, height: 800 }).compact).toBe(
			true,
		)
		expect(planGroupGrid({ count: 13, width: 1280, height: 800 }).compact).toBe(
			true,
		)
	})

	it("INVARIANT — hors compact, une vignette fait au moins 108 × 64 px", () => {
		// 108 et non plus 120 depuis ADR-0149 : trois colonnes au téléphone
		// iCom (390 px) donnent ~118 px, et une grille de onze doit y tenir.
		for (const width of [312, 320, 390, 400, 700, 960, 1280, 1920]) {
			for (const height of [260, 420, 580, 620, 800]) {
				for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 21, 100]) {
					for (const hasAddTile of [false, true]) {
						const layout = planGroupGrid({ count, width, height, hasAddTile })
						if (layout.compact) continue
						const cas = `${count} vignettes dans ${width}×${height}`
						expect(layout.tileWidth, cas).toBeGreaterThanOrEqual(108)
						expect(layout.tileHeight, cas).toBeGreaterThanOrEqual(64)
						expect(layout.columns).toBeGreaterThanOrEqual(1)
						expect(layout.columns).toBeLessThanOrEqual(width <= 640 ? 3 : 4)
					}
				}
			}
		}
	})

	it("une fenêtre minuscule bascule en scène plutôt qu'en confettis", () => {
		expect(planGroupGrid({ count: 4, width: 240, height: 200 }).compact).toBe(
			true,
		)
	})
})

describe("planGroupGrid — la commande « Ajouter » (IC-10, ADR-0149)", () => {
	it("n'est plus JAMAIS une cellule : toujours une barre", () => {
		// Réécrit le 2026-09-14 (ADR-0149) : « Ajouter » occupait une cellule
		// sous cinq vignettes. À onze au téléphone, elle volait la place d'un
		// visage, et sa disparition au dernier siège rebattait la grille.
		for (const count of [1, 2, 3, 4, 5, 11]) {
			expect(planGroupGrid({ count, width: 400, height: 420 }).addTile).toBe("bar")
			expect(planGroupGrid({ count, viewport: "mobile" }).addTile).toBe("bar")
		}
	})

	it("ne COMPTE pas comme vignette, mais RÉSERVE la hauteur de la barre", () => {
		const sans = planGroupGrid({ count: 3, width: 400, height: 420 })
		const avec = planGroupGrid({ count: 3, width: 400, height: 420, hasAddTile: true })
		// Mêmes colonnes, mêmes lignes : la barre n'est pas une case.
		expect(avec.columns).toBe(sans.columns)
		expect(avec.rows).toBe(2)
		// Mais chaque ligne perd sa part des 54 px que la barre retire.
		expect(sans.tileHeight - avec.tileHeight).toBeCloseTo(54 / 2, 1)
	})

	it("l'ancienne signature reste servie à l'identique", () => {
		// Le barrel public l'exporte, et le premier rendu n'a pas encore mesuré.
		expect(planGroupGrid({ count: 7, viewport: "desktop" })).toMatchObject({
			columns: 4,
			compact: true,
		})
		expect(planGroupGrid({ count: 2, viewport: "mobile" }).columns).toBe(1)
	})
})

describe("groupCallSubtitle — jamais une phrase à trou", () => {
	it("compose ce qui est vrai, au singulier comme au pluriel", () => {
		expect(
			groupCallSubtitle({ connected: 3, ringing: 2, unreachable: 0 }, t),
		).toBe("3 en ligne · 2 sonnent")
		expect(
			groupCallSubtitle({ connected: 1, ringing: 1, unreachable: 0 }, t),
		).toBe("1 en ligne · 1 sonne")
	})

	it("tait ce qui vaut zéro", () => {
		expect(
			groupCallSubtitle({ connected: 2, ringing: 0, unreachable: 1 }, t),
		).toBe("2 en ligne")
	})

	it("rend `null` quand on ne sait rien — jamais « 0 en ligne »", () => {
		// Un décompte partiel pendant le chargement dirait le contraire de la
		// réalité, et l'en-tête vaut mieux nu que faux.
		expect(
			groupCallSubtitle({ connected: 0, ringing: 0, unreachable: 0 }, t),
		).toBeNull()
	})

	it("dit l'échec quand tout le monde a manqué l'appel", () => {
		expect(
			groupCallSubtitle({ connected: 0, ringing: 0, unreachable: 3 }, t),
		).toBe("Personne n'a répondu")
	})
})

describe("shortGroupLabel — la pilule fait 200 px", () => {
	it("garde un titre court tel quel", () => {
		expect(shortGroupLabel({ title: "Cellule veille", memberCount: 4 }, t)).toBe(
			"Cellule veille",
		)
	})

	it("remplace un titre long par le décompte", () => {
		expect(
			shortGroupLabel({
				title: "Comité interministériel de suivi du budget 2026",
				memberCount: 5,
			}, t),
		).toBe("Appel de groupe · 5")
	})

	it("ne rend jamais un libellé vide", () => {
		expect(shortGroupLabel({ title: null, memberCount: null }, t)).toBe(
			"Appel de groupe",
		)
		expect(shortGroupLabel({ title: "   ", memberCount: 0 }, t)).toBe(
			"Appel de groupe",
		)
	})
})

describe("composeGroupCallTitle — un appel de groupe dit à qui l'on parle", () => {
	it("nomme jusqu'à trois personnes, puis le nombre de celles qu'on tait", () => {
		expect(composeGroupCallTitle({ names: ["Marie Ndong", "Paul Obame"] }, t)).toBe(
			"Appel de groupe — Marie Ndong, Paul Obame",
		)
		expect(composeGroupCallTitle({ names: ["A", "B", "C", "D", "E"] }, t)).toBe(
			"Appel de groupe — A, B, C +2",
		)
	})

	it("un aperçu de noms compte quand même tout le monde dans le « +k »", () => {
		// L'écran d'appel entrant ne reçoit que quatre conviés : neuf autres
		// personnes en tout, trois nommées, six tues.
		expect(composeGroupCallTitle({ names: ["A", "B", "C", "D"], total: 9 }, t)).toBe(
			"Appel de groupe — A, B, C +6",
		)
		// Un convié sans nom publié n'est pas nommé, mais il est compté.
		expect(composeGroupCallTitle({ names: ["A"], total: 2 }, t)).toBe("Appel de groupe — A +1")
	})

	it("sans nom exploitable, le genre suffit", () => {
		expect(composeGroupCallTitle({ names: [] }, t)).toBe("Appel de groupe")
		expect(composeGroupCallTitle({ names: ["  ", ""], total: 3 }, t)).toBe("Appel de groupe")
	})
})

describe("compareParticipants — moi en dernier, comme la case « Vous » de WhatsApp", () => {
	it("ma vignette ferme la grille, même quand je suis l'hôte", () => {
		const moi = { ...p("Moi", "host"), isMe: true }
		const ordre = [moi, p("Zoe", "connected"), p("Bob", "ringing"), p("Anna", "connected")]
			.sort(compareParticipants)
			.map((x) => x.name)
		expect(ordre).toEqual(["Anna", "Zoe", "Bob", "Moi"])
	})

	it("… et ne bouge pas quand quelqu'un décroche : elle reste ancrée", () => {
		const moi = { ...p("Moi", "host"), isMe: true }
		const avant = [moi, p("Bob", "ringing"), p("Anna", "connected")]
			.sort(compareParticipants)
			.map((x) => x.name)
		const apres = [moi, p("Bob", "connected"), p("Anna", "connected")]
			.sort(compareParticipants)
			.map((x) => x.name)
		expect(avant.at(-1)).toBe("Moi")
		expect(apres.at(-1)).toBe("Moi")
	})
})

describe("pickStageIdentity — jamais moi en scène de mon propre chef", () => {
	it("ma voix ne me met pas en grand : la scène va à celui à qui je parle", () => {
		const ordered = [
			p("Anna", "connected"),
			p("Bob", "connected"),
			{ ...p("Moi", "host"), isMe: true },
		]
		expect(pickStageIdentity({ ordered, speaking: new Set(["u_Moi"]) })).toBe("u_Anna")
		expect(pickStageIdentity({ ordered, lastSpeaker: "u_Moi" })).toBe("u_Anna")
		expect(pickStageIdentity({ ordered, speaking: new Set(["u_Moi", "u_Bob"]) })).toBe(
			"u_Bob",
		)
	})

	it("l'épingle, elle, peut me mettre en scène", () => {
		const ordered = [p("Anna", "connected"), { ...p("Moi", "host"), isMe: true }]
		expect(pickStageIdentity({ ordered, pinned: "u_Moi" })).toBe("u_Moi")
	})

	it("seul dans l'appel, la scène me revient faute de mieux", () => {
		const ordered = [{ ...p("Moi", "host"), isMe: true }]
		expect(pickStageIdentity({ ordered })).toBe("u_Moi")
	})
})

describe("planGroupGrid — le modèle WhatsApp à nombre impair", () => {
	it("trois personnes sur deux colonnes : la première case s'étale, deux lignes", () => {
		const plan = planGroupGrid({ count: 3, width: 400, height: 420 })
		expect(plan.columns).toBe(2)
		expect(plan.rows).toBe(2)
		expect(plan.compact).toBe(false)
		expect(plan.spanFirst).toBe(true)
	})

	it("cinq personnes : deux colonnes, trois lignes, la première s'étale", () => {
		const plan = planGroupGrid({ count: 5, width: 400, height: 420 })
		expect(plan.columns).toBe(2)
		expect(plan.rows).toBe(3)
		expect(plan.spanFirst).toBe(true)
	})

	it("« Ajouter » ne rend plus le compte pair : la première case s'étale quand même", () => {
		// Réécrit le 2026-09-14 (ADR-0149) : la cellule « Ajouter » faisait de
		// trois personnes une grille de quatre. Elle est devenue une barre, et
		// trois personnes sont trois personnes.
		const plan = planGroupGrid({ count: 3, width: 400, height: 420, hasAddTile: true })
		expect(plan.rows).toBe(2)
		expect(plan.spanFirst).toBe(true)
	})

	it("deux personnes au téléphone : une colonne, rien à étaler", () => {
		const plan = planGroupGrid({ count: 2, width: 400, height: 420 })
		expect(plan.columns).toBe(1)
		expect(plan.spanFirst).toBe(false)
	})

	it("en scène + bandeau, la règle ne s'applique pas", () => {
		// Sept dans 400 px n'est plus compact (ADR-0149) : on prend douze, qu'un
		// compte exempté seul atteint.
		const plan = planGroupGrid({ count: 13, width: 400, height: 420 })
		expect(plan.compact).toBe(true)
		expect(plan.spanFirst).toBe(false)
		expect(plan.firstRowTiles).toBe(plan.columns)
	})

	it("le repli sans mesure suit la même règle", () => {
		expect(planGroupGrid({ count: 3, viewport: "mobile" }).spanFirst).toBe(true)
		expect(planGroupGrid({ count: 4, viewport: "mobile" }).spanFirst).toBe(false)
	})
})

describe("planGroupGrid — de 2 à 11 au téléphone iCom (ADR-0149, fiche du 2026-09-14 §4)", () => {
	/**
	 * Le téléphone iCom détaché fait 390 px de large ; sa scène, une fois la
	 * barre de la carte, l'en-tête de phase et les commandes retirés, ~580 px
	 * de haut — barre « Ajouter » comprise, que la grille réserve.
	 */
	const TELEPHONE = { width: 390, height: 580, hasAddTile: true } as const

	it.each([
		// count, colonnes, lignes, cases en tête, pistes
		[2, 1, 2, 1, 1],
		[3, 2, 2, 1, 2],
		[4, 2, 2, 2, 2],
		[5, 2, 3, 1, 2],
		[6, 2, 3, 2, 2],
		[7, 2, 4, 1, 2],
		[8, 2, 4, 2, 2],
		[9, 3, 3, 3, 3],
		[10, 3, 4, 1, 3],
		[11, 3, 4, 2, 6],
	])(
		"%i personnes : %i colonne(s), %i lignes, %i case(s) en tête, %i pistes",
		(count, columns, rows, firstRowTiles, tracks) => {
			const plan = planGroupGrid({ count, ...TELEPHONE })
			expect(plan).toMatchObject({ columns, rows, firstRowTiles, tracks, compact: false })
			expect(plan.tileWidth).toBeGreaterThanOrEqual(108)
			expect(plan.tileHeight).toBeGreaterThanOrEqual(64)
			// La barre n'est plus une case, dans aucune de ces tailles.
			expect(plan.addTile).toBe("bar")
		},
	)

	it("dix : UNE case pleine largeur en tête ; onze : DEUX demi-cases", () => {
		expect(planGroupGrid({ count: 10, ...TELEPHONE }).spanFirst).toBe(true)
		const onze = planGroupGrid({ count: 11, ...TELEPHONE })
		expect(onze.spanFirst).toBe(false)
		// Six pistes : une case ordinaire en prend deux, une case de tête trois.
		expect(onze.tracks / onze.columns).toBe(2)
		expect(onze.tracks / onze.firstRowTiles).toBe(3)
	})

	it("les lignes sont d'égale hauteur et remplissent la scène", () => {
		// 580 − 2 × 10 (marges) − 54 (réserve de la barre) = 506 px utiles.
		const deux = planGroupGrid({ count: 4, ...TELEPHONE })
		expect(deux.rows * deux.tileHeight + (deux.rows - 1) * 8).toBeCloseTo(506, 0)
		const quatre = planGroupGrid({ count: 11, ...TELEPHONE })
		expect(quatre.rows * quatre.tileHeight + (quatre.rows - 1) * 8).toBeCloseTo(506, 0)
	})

	it.each([9, 10, 11])(
		"%i personnes sur la carte de rail (312 px) : scène + bande",
		(count) => {
			// Trois colonnes dans 312 px ⇒ ~92 px < 108 : la carte de rail bascule
			// d'elle-même, sans règle propre.
			expect(planGroupGrid({ count, width: 312, height: 580, hasAddTile: true }).compact).toBe(
				true,
			)
		},
	)

	it("jusqu'à huit, la carte de rail garde une grille", () => {
		expect(planGroupGrid({ count: 8, width: 312, height: 580, hasAddTile: true }).compact).toBe(
			false,
		)
	})

	it.each([12, 20, 100])(
		"%i personnes au téléphone (comptes exemptés) : scène + bande",
		(count) => {
			expect(planGroupGrid({ count, ...TELEPHONE }).compact).toBe(true)
		},
	)

	it("onze SIÈGES et un refus au téléphone : la grille reste une grille", () => {
		// Dix conviés, un refuse, un remplaçant est ajouté : douze vignettes, mais
		// onze sièges. Le refus garde sa case sans tenir de place.
		expect(planGroupGrid({ count: 12, seats: 11, ...TELEPHONE }).compact).toBe(false)
		// Douze sièges : seul un compte exempté y arrive, et il passe en scène.
		expect(planGroupGrid({ count: 12, seats: 12, ...TELEPHONE }).compact).toBe(true)
	})

	it("onze sièges et deux refus sur une surface large : pas de scène", () => {
		expect(
			planGroupGrid({ count: 13, seats: 11, width: 1280, height: 800 }).compact,
		).toBe(false)
	})

	it("reservesGridSeat suit la règle du serveur : hôte, en ligne, qui sonne", () => {
		expect(reservesGridSeat({ state: "host" })).toBe(true)
		expect(reservesGridSeat({ state: "connected" })).toBe(true)
		expect(reservesGridSeat({ state: "ringing" })).toBe(true)
		for (const state of ["declined", "unavailable", "missed", "left"] as const) {
			expect(reservesGridSeat({ state })).toBe(false)
		}
	})

	it("jamais plus de trois colonnes au téléphone", () => {
		for (let count = 1; count <= 40; count++) {
			expect(planGroupGrid({ count, ...TELEPHONE }).columns).toBeLessThanOrEqual(3)
		}
	})

	it("une carte très BASSE bascule en scène, même assez large", () => {
		// Onze personnes dans 390 × 260 : des lignes de ~48 px, où ni l'avatar
		// ni le nom ne tiennent. La largeur seule ne l'aurait pas vu.
		const bas = planGroupGrid({ count: 11, width: 390, height: 260, hasAddTile: true })
		expect(bas.tileWidth).toBeGreaterThanOrEqual(108)
		expect(bas.compact).toBe(true)
	})
})

describe("avatarSizeFor — un avatar à la taille de sa case", () => {
	it("grandit avec la case, dans des bornes", () => {
		expect(avatarSizeFor(0, "grid")).toBe(56)
		// Plancher 40 et non plus 44 (ADR-0149) : la case de onze au téléphone
		// fait ~118 × 120, et 44 px chevauchaient le pied du nom.
		expect(avatarSizeFor(100, "grid")).toBe(40)
		expect(avatarSizeFor(186, "grid")).toBe(67)
		expect(avatarSizeFor(400, "grid")).toBe(96)
	})

	it("une case basse borne l'avatar par sa HAUTEUR", () => {
		expect(avatarSizeFor(370, "grid", 120)).toBe(43)
		expect(avatarSizeFor(370, "grid", 400)).toBe(96)
		// Hauteur inconnue ⇒ la largeur seule, comme avant.
		expect(avatarSizeFor(186, "grid", 0)).toBe(67)
	})

	it("en grille, l'avatar tient dans la place que laissent le pied et la puce « Appelant »", () => {
		// Revue du 14/09 : cases de la carte du poste à onze, 121 × 85.
		// 85 − 2 − 34 = 49 ≥ 40 : le plancher tient au-dessus du nom.
		expect(avatarSizeFor(121, "grid", 85)).toBe(40)
		// La case de l'appelant réserve aussi la puce : 85 − 2 − 34 − 24 = 25,
		// l'avatar prend exactement cette place pour ne couvrir ni puce ni nom.
		expect(avatarSizeFor(121, "grid", 85, { caller: true })).toBe(25)
		// Plus bas encore, il s'arrête au plancher de 24 px.
		expect(avatarSizeFor(121, "grid", 70, { caller: true })).toBe(24)
		// Au plancher de la grille (MIN_TILE_HEIGHT = 64) : 64 − 36 = 28.
		expect(avatarSizeFor(121, "grid", 64)).toBe(28)
		// Une case confortable ne change pas.
		expect(avatarSizeFor(186, "grid", 188, { caller: true })).toBe(67)
		// La réserve ne concerne que la grille.
		expect(avatarSizeFor(121, "stage", 85, { caller: true })).toBe(96)
	})

	it("bandeau et scène ont leur taille propre", () => {
		expect(avatarSizeFor(400, "strip")).toBe(32)
		expect(avatarSizeFor(0, "stage")).toBe(96)
	})
})
