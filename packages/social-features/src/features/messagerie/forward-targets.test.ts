// Dupliqué de socle/packages/agent-features/src/features/messagerie/forward-targets.test.ts @ ad2e7fdc2 — adaptations : TQ* — branche poste retirée (fixtures sans `poste` ; l'assertion « la fonction du poste prime sur le handle » devient « le @handle sert de sous-titre » ; la recherche par sous-titre se prouve par le titre (`headline`) d'une relation) ; fils lus par `threadId`, cibles `personal` / `group` / `handle` du moteur ; traduction française du moteur passée en dernier paramètre (libellés attendus : texte exact du socle) ; un cas ajouté : les libellés suivent la langue.
/**
 * forward-targets — la preuve des règles du sélecteur de transfert
 * (ADR-0143 §5) : la cible est EXPLICITE, la conversation courante en est
 * exclue, et une relation sans fil ne fait pas double emploi avec elle.
 */
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
	buildForwardTargets as buildForwardTargetsT,
	existingChatHandlesOf,
	filterForwardTargets,
	forwardTargetHint as forwardTargetHintT,
	relationForwardTargets,
	type ForwardTargetRow,
} from "./forward-targets"

const fr = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")
const en = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("en")

/** Les deux constructeurs tels que l'écran français les appelle. */
function buildForwardTargets(input: Parameters<typeof buildForwardTargetsT>[0]) {
	return buildForwardTargetsT(input, fr)
}
function forwardTargetHint(row: ForwardTargetRow) {
	return forwardTargetHintT(row, fr)
}

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

const GROUPES = [
	{ threadId: "grp-1", title: "Comité budget", memberCount: 3 },
	{ threadId: "grp-2", title: "Veille", memberCount: 1 },
]

describe("buildForwardTargets", () => {
	it("construit conversations puis groupes, avec l'argument prêt", () => {
		const rows = buildForwardTargets({ threads: FILS, groupThreads: GROUPES })
		expect(rows.map((row) => row.key)).toEqual([
			"chat:chat-1",
			"chat:chat-2",
			"groupe:grp-1",
			"groupe:grp-2",
		])
		expect(rows[0]).toMatchObject({
			kind: "chat",
			to: { kind: "personal", threadId: "chat-1" },
			title: "Bob Mba",
			subtitle: "@bob",
		})
		expect(rows[1]!.subtitle).toBe("@carla")
		expect(rows[2]).toMatchObject({
			kind: "groupe",
			to: { kind: "group", threadId: "grp-1" },
			subtitle: "3 membres",
		})
		expect(rows[3]!.subtitle).toBe("1 membre")
	})

	it("EXCLUT la conversation courante — un transfert n'est pas un doublon", () => {
		const rows = buildForwardTargets({
			threads: FILS,
			groupThreads: GROUPES,
			excludeKey: "chat:chat-1",
		})
		expect(rows.map((row) => row.key)).not.toContain("chat:chat-1")
		expect(rows).toHaveLength(3)

		const sansGroupe = buildForwardTargets({
			threads: FILS,
			groupThreads: GROUPES,
			excludeKey: "groupe:grp-2",
		})
		expect(sansGroupe.map((row) => row.key)).not.toContain("groupe:grp-2")
	})

	it("survit aux champs absents : nom de repli, sans sous-titre", () => {
		const rows = buildForwardTargets({
			threads: [{ threadId: "chat-9", counterpart: null }],
			groupThreads: [{ threadId: "grp-9" }],
		})
		expect(rows[0]).toMatchObject({ title: "Conversation", subtitle: null })
		expect(rows[1]).toMatchObject({ title: "Groupe", subtitle: null })
	})
})

describe("relationForwardTargets", () => {
	it("propose une relation SANS fil listé, une seule fois", () => {
		const rows = relationForwardTargets({
			relations: [
				{ handle: "dora", displayName: "Dora Ondo", headline: "Cheffe" },
				{ handle: "bob", displayName: "Bob Mba" },
				{ handle: "dora", displayName: "Dora Ondo" },
				{ handle: null, displayName: "Sans adresse" },
			],
			existingChatHandles: new Set(["bob"]),
		})
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			key: "relation:dora",
			kind: "relation",
			to: { kind: "handle", handle: "dora" },
			title: "Dora Ondo",
			subtitle: "Cheffe",
		})
	})

	it("retombe sur le @handle quand aucun titre n'est connu", () => {
		const rows = relationForwardTargets({
			relations: [{ handle: "eve", displayName: "Eve" }],
			existingChatHandles: new Set(),
		})
		expect(rows[0]!.subtitle).toBe("@eve")
	})
})

describe("existingChatHandlesOf", () => {
	it("collecte les handles des fils listés", () => {
		expect(existingChatHandlesOf(FILS)).toEqual(new Set(["bob", "carla"]))
	})
})

describe("filterForwardTargets", () => {
	const rows = [
		...buildForwardTargets({ threads: FILS, groupThreads: GROUPES }),
		...relationForwardTargets({
			relations: [{ handle: "dora", displayName: "Dora Ondo", headline: "Directrice" }],
			existingChatHandles: existingChatHandlesOf(FILS),
		}),
	]

	it("rend tout sans terme", () => {
		expect(filterForwardTargets(rows, "")).toHaveLength(5)
		expect(filterForwardTargets(rows, "   ")).toHaveLength(5)
	})

	it("filtre par nom, titre, sous-titre et @handle, sans tenir les accents", () => {
		expect(filterForwardTargets(rows, "bob")).toHaveLength(1)
		expect(filterForwardTargets(rows, "@carla")).toHaveLength(1)
		expect(filterForwardTargets(rows, "directrice")).toHaveLength(1)
		expect(filterForwardTargets(rows, "budget")).toHaveLength(1)
		// « Nze » retrouve « Nzé » : la recherche plie les diacritiques.
		expect(filterForwardTargets(rows, "nze")).toHaveLength(1)
		expect(filterForwardTargets(rows, "personne")).toHaveLength(0)
	})
})

describe("forwardTargetHint", () => {
	it("dit ce que le geste va faire, cible par cible", () => {
		const base: ForwardTargetRow = {
			key: "k",
			kind: "chat",
			to: { kind: "personal", threadId: "c" },
			title: "T",
			subtitle: null,
		}
		expect(forwardTargetHint(base)).toBe("Transférer dans cette conversation")
		expect(forwardTargetHint({ ...base, kind: "groupe" })).toBe(
			"Transférer dans ce groupe",
		)
		expect(forwardTargetHint({ ...base, kind: "relation" })).toBe(
			"Transférer — une conversation sera ouverte",
		)
	})
})

describe("la langue de l'écran", () => {
	it("traduit les replis, l'effectif et le pied", () => {
		const rows = buildForwardTargetsT(
			{
				threads: [{ threadId: "chat-9", counterpart: null }],
				groupThreads: [
					{ threadId: "grp-9" },
					{ threadId: "grp-1", title: "Budget", memberCount: 1 },
				],
			},
			en,
		)
		expect(rows[0]).toMatchObject({ title: "Conversation" })
		expect(rows[1]).toMatchObject({ title: "Group" })
		expect(rows[2]!.subtitle).toBe("1 member")
		expect(forwardTargetHintT(rows[1]!, en)).toBe("Forward to this group")
	})
})
