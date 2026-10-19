// Dupliqué de socle/packages/agent-features/src/features/iappel/incoming-group.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans les locales françaises du moteur (`t` réel, pluriels i18next) — attendus inchangés ; genre `meeting` retiré du tableau des genres sans résumé (il n'existe plus) ; cas ajouté : l'énumération accessible en anglais.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { CallGroupInviteePreview } from "./call-types"
import {
	INCOMING_PILE_MAX_FACES,
	incomingGroupBannerLabel,
	incomingGroupSummary,
} from "./incoming-group"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" })
const t = i18n.getFixedT("fr")

/**
 * Point de vue B de la fiche « appels de groupe de 2 à 11 » (ADR-0149) : ce
 * que l'invité lit AVANT de décrocher. Le décompte vient du serveur, la pile
 * s'arrête à quatre visages, le reste se dit « +k ».
 */

const NOMS = ["Marie Ndong", "Paul Obame", "Aline Mba", "Joël Nze", "Ruth Ella", "Yann Oyane"]

function invitees(n: number): CallGroupInviteePreview[] {
	return NOMS.slice(0, n).map((name, index) => ({
		userId: `u${index}`,
		name,
		avatarUrl: null,
	}))
}

describe("incomingGroupSummary — table des tailles", () => {
	it.each([
		// N, conviés servis, libellé, visages, reste
		[2, 0, "Appel", 0, 0],
		[3, 1, "Appel de groupe · 3 personnes", 1, 1],
		[5, 3, "Appel de groupe · 5 personnes", 3, 1],
		[7, 4, "Appel de groupe · 7 personnes", 4, 2],
		[11, 4, "Appel de groupe · 11 personnes", 4, 6],
	] as const)("N = %i (%i conviés servis)", (count, served, label, faces, rest) => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: count, invitees: invitees(served) },
		}, t)
		expect(summary).not.toBeNull()
		expect(summary?.label).toBe(label)
		expect(summary?.count).toBe(count)
		expect(summary?.shown).toHaveLength(faces)
		expect(summary?.rest).toBe(rest)
	})

	it("la pile s'arrête à quatre visages même si le serveur en envoie davantage", () => {
		// Le serveur borne déjà à quatre ; le module ne s'en remet pas à lui.
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 7, invitees: invitees(5) },
		}, t)
		expect(summary?.shown).toHaveLength(INCOMING_PILE_MAX_FACES)
		expect(summary?.rest).toBe(2)
	})

	/**
	 * La planche HTML dessine « +2 vous compris » à sept : le reste compte
	 * l'invité qui regarde. Les visages servis par `listRinging` l'EXCLUENT
	 * (son propre avatar dans sa propre sonnerie ne dirait rien) ; le reste,
	 * lui, vaut N − appelant − visages : +2 à sept, +6 à onze.
	 */
	it("N = 8 servi à quatre : « +3 »", () => {
		const huit = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 8, invitees: invitees(4) },
		}, t)
		expect(huit?.rest).toBe(3)
	})

	it("N = 11 : quatre visages et « +6 », libellé accessible énuméré", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 11, invitees: invitees(4) },
		}, t)
		expect(summary?.rest).toBe(6)
		expect(summary?.accessibleLabel).toBe(
			"Avec Marie Ndong, Paul Obame, Aline Mba, Joël Nze et 6 autres, vous compris",
		)
	})

	it("libellé accessible : deux noms et quatre autres", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 7, invitees: invitees(2) },
		}, t)
		expect(summary?.accessibleLabel).toBe(
			"Avec Marie Ndong, Paul Obame et 4 autres, vous compris",
		)
	})

	it("un convié sans nom publié se dit « un correspondant », jamais un identifiant", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: {
				title: "Cellule",
				memberCount: 4,
				invitees: [
					{ userId: "a", name: "Marie Ndong" },
					{ userId: "b", name: "570rjg5chav8n2k1p" },
				],
			},
		}, t)
		expect(summary?.shown[1]?.name).toBeNull()
		expect(summary?.accessibleLabel).toBe(
			"Avec Marie Ndong, un correspondant et 1 autre, vous compris",
		)
	})

	it("un seul autre : « et 1 autre », au singulier", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 3, invitees: invitees(1) },
		}, t)
		expect(summary?.rest).toBe(1)
		expect(summary?.accessibleLabel).toBe("Avec Marie Ndong et 1 autre, vous compris")
	})

	it("conviés absents (ligne antérieure) : la ligne seule, aucun visage", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 7 },
		}, t)
		expect(summary?.label).toBe("Appel de groupe · 7 personnes")
		expect(summary?.shown).toHaveLength(0)
		expect(summary?.accessibleLabel).toBe("Avec 6 correspondants, vous compris")
	})

	it("jamais moins de personnes annoncées que de visages montrés", () => {
		const summary = incomingGroupSummary({
			kind: "group",
			group: { title: "Cellule", memberCount: 3, invitees: invitees(3) },
		}, t)
		expect(summary?.count).toBe(5)
		expect(summary?.rest).toBe(1)
	})

	it("appel de groupe sans identité : le genre suffit", () => {
		const summary = incomingGroupSummary({ kind: "group", group: null }, t)
		expect(summary?.label).toBe("Appel de groupe")
		expect(summary?.shown).toHaveLength(0)
		expect(summary?.rest).toBe(0)
	})

	it.each([["direct"], [undefined]] as const)(
		"kind %s : pas de résumé de groupe",
		(kind) => {
			expect(
				incomingGroupSummary({
					kind,
					group: { title: "Cellule", memberCount: 7, invitees: invitees(4) },
				}, t),
			).toBeNull()
		},
	)
})

describe("incomingGroupSummary — dans la langue de l'écran", () => {
	it("l'énumération accessible suit la langue (anglais)", () => {
		const summary = incomingGroupSummary(
			{
				kind: "group",
				group: { title: "Cellule", memberCount: 7, invitees: invitees(2) },
			},
			i18n.getFixedT("en"),
		)
		expect(summary?.label).toBe("Group call · 7 people")
		expect(summary?.accessibleLabel).toBe("With Marie Ndong, Paul Obame and 4 others, including you")
	})
})

describe("incomingGroupBannerLabel", () => {
	it("titre court + nombre de personnes au-delà de deux", () => {
		expect(incomingGroupBannerLabel({ title: "Cellule budget", memberCount: 7 }, t)).toBe(
			"Cellule budget · 7 personnes",
		)
	})

	it("sans titre : « Appel de groupe · N personnes »", () => {
		expect(incomingGroupBannerLabel({ title: "", memberCount: 11 }, t)).toBe(
			"Appel de groupe · 11 personnes",
		)
	})

	it("titre trop long : shortGroupLabel garde la main", () => {
		expect(
			incomingGroupBannerLabel({
				title: "Direction centrale des ressources humaines du ministère",
				memberCount: 5,
			}, t),
		).toBe("Appel de groupe · 5 personnes")
	})

	it("à deux : le titre seul, aucun décompte", () => {
		expect(incomingGroupBannerLabel({ title: "Cellule", memberCount: 2 }, t)).toBe("Cellule")
	})
})
