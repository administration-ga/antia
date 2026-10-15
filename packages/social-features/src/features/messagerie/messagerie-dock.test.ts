// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-dock.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
	activeKey,
	backToList,
	chatKey,
	draftKey,
	draftTextFor,
	groupeKey,
	initialDockState,
	openCompose,
	openComposeGroupe,
	openConversation,
	parseDock,
	parseKey,
	promoteDraft,
	readReceiptKey,
	reconcile,
	SERIAL_VERSION,
	serializeDock,
	setDraftText,
	setFloating,
	setOpen,
	toggleOpen,
	draftMediaFor,
	updateDraftMedia,
} from "./messagerie-dock"
import {
	addMediaItems,
	markMediaUploaded,
	newMediaItem,
	removeMediaItem,
	uploadedStorageId,
} from "./messagerie-media-draft"

/** Une pièce jointe en attente, sans octets — le module n'en manipule pas. */
function piece(name: string) {
	return newMediaItem({
		file: { name, size: 1024, type: "image/png" } as unknown as File,
	})
}

/** Le raccourci des tests : tout vivant se déclare par ses deux listes. */
function vivants(
	chatIds: readonly string[] = [],
	groupeIds: readonly string[] = [],
) {
	return { chatIds, groupeIds }
}

/**
 * La messagerie tient dans UN bloc : une vue à la fois, dans la carte de
 * l'en-tête d'iRéseau. Ce fichier vérifie ce que ce modèle DÉCIDE —
 * `agent-features` n'ayant pas de test de composant, c'est la seule barrière
 * avant l'œil.
 */

describe("clés de conversation", () => {
	it("distingue un fil existant d'un brouillon", () => {
		expect(parseKey(chatKey("abc"))).toEqual({ kind: "chat", chatId: "abc" })
		// ⚠️ Le brouillon porte le HANDLE : c'est ce que sait adresser
		// `startThreadWithHandle`, la seule mutation qui ouvre un fil.
		expect(parseKey(draftKey("l.mengue"))).toEqual({
			kind: "draft",
			handle: "l.mengue",
		})
	})

	it("reconnaît la clé OPAQUE d'un groupe — la troisième forme, sans toucher aux deux autres", () => {
		expect(parseKey(groupeKey("g1"))).toEqual({
			kind: "groupe",
			threadId: "g1",
		})
		// Le 1:1 ne bouge pas : les mêmes clés se relisent à l'identique.
		expect(parseKey(chatKey("abc"))).toEqual({ kind: "chat", chatId: "abc" })
	})

	it("refuse ce qui n'est pas une clé", () => {
		for (const bad of ["", ":", "chat:", "groupe:", ":abc", "autre:abc", "abc"]) {
			expect(parseKey(bad)).toBeNull()
		}
	})
})

describe("acquittement de lecture", () => {
	it("crée une seule intention par dernier message visible et non lu", () => {
		const visible = {
			chatId: "chat-1",
			latestMessageId: "message-9",
			open: true,
			unreadCount: 3,
		}
		expect(readReceiptKey(visible)).toBe("chat-1:message-9")
		// Un rerender ou un compteur qui se précise ne change pas l'identité.
		expect(readReceiptKey({ ...visible, unreadCount: 2 })).toBe(
			"chat-1:message-9",
		)
	})

	it("ne mute ni une carte repliée, ni un fil déjà lu ou pas encore chargé", () => {
		const base = {
			chatId: "chat-1",
			latestMessageId: "message-9",
			open: true,
			unreadCount: 1,
		}
		expect(readReceiptKey({ ...base, open: false })).toBeNull()
		expect(readReceiptKey({ ...base, unreadCount: 0 })).toBeNull()
		expect(readReceiptKey({ ...base, latestMessageId: null })).toBeNull()
		expect(readReceiptKey({ ...base, chatId: null })).toBeNull()
	})

	it("crée une nouvelle intention seulement quand le dernier message change", () => {
		expect(
			readReceiptKey({
				chatId: "chat-1",
				latestMessageId: "message-10",
				open: true,
				unreadCount: 1,
			}),
		).toBe("chat-1:message-10")
	})
})

describe("les trois vues", () => {
	it("s'ouvre sur la LISTE, dépliée", () => {
		const state = initialDockState()
		expect(state.view).toEqual({ kind: "list" })
		// Dépliée d'emblée : la carte occupe une cellule réservée, elle ne
		// recouvre rien. Le repli était le défaut du temps où elle flottait.
		expect(state.open).toBe(true)
	})

	it("ouvre une conversation, et déplie la carte au passage", () => {
		const replie = setOpen(initialDockState(), false)
		const ouvert = openConversation(replie, chatKey("c1"))
		expect(activeKey(ouvert)).toBe(chatKey("c1"))
		expect(ouvert.open).toBe(true)
	})

	it("ouvre le choix d'un destinataire, et déplie aussi", () => {
		const replie = setOpen(initialDockState(), false)
		const compose = openCompose(replie)
		expect(compose.view).toEqual({ kind: "compose" })
		expect(compose.open).toBe(true)
	})

	it("ouvre la composition d'un GROUPE — une quatrième branche, pas un mode", () => {
		const replie = setOpen(initialDockState(), false)
		const compose = openComposeGroupe(replie)
		expect(compose.view).toEqual({ kind: "composeGroupe" })
		expect(compose.open).toBe(true)
		// Même référence quand rien ne change — le contrat de tout le module.
		expect(openComposeGroupe(compose)).toBe(compose)
		// Et le retour est la même sortie que partout ailleurs.
		expect(backToList(compose).view).toEqual({ kind: "list" })
	})

	it("ouvre une conversation de GROUPE comme n'importe quelle conversation", () => {
		const ouvert = openConversation(initialDockState(), groupeKey("g1"))
		expect(activeKey(ouvert)).toBe(groupeKey("g1"))
	})

	it("n'affiche JAMAIS deux vues : chacune remplace la précédente", () => {
		let state = openConversation(initialDockState(), chatKey("c1"))
		state = openCompose(state)
		expect(activeKey(state)).toBeNull()
		state = openConversation(state, chatKey("c2"))
		expect(state.view).toEqual({ kind: "conversation", key: chatKey("c2") })
	})

	it("revient à la liste sans rien fermer", () => {
		const ouvert = openConversation(initialDockState(), chatKey("c1"))
		expect(backToList(ouvert).view).toEqual({ kind: "list" })
		expect(backToList(openCompose(ouvert)).view).toEqual({ kind: "list" })
	})

	it("refuse une clé qui n'en est pas une", () => {
		const state = initialDockState()
		expect(openConversation(state, "n'importe quoi")).toBe(state)
	})

	it("rend la MÊME référence quand rien ne change", () => {
		const ouvert = openConversation(initialDockState(), chatKey("c1"))
		expect(openConversation(ouvert, chatKey("c1"))).toBe(ouvert)
		const liste = backToList(ouvert)
		expect(backToList(liste)).toBe(liste)
		expect(setOpen(ouvert, true)).toBe(ouvert)
		const compose = openCompose(ouvert)
		expect(openCompose(compose)).toBe(compose)
	})

	it("replie et déplie", () => {
		const state = initialDockState()
		expect(toggleOpen(state).open).toBe(false)
		expect(toggleOpen(toggleOpen(state)).open).toBe(true)
	})

	it("revient toujours à la racine iChat lorsqu'il se replie", () => {
		let state = openConversation(initialDockState(), chatKey("c1"))
		state = setDraftText(state, chatKey("c1"), "message conservé")

		const replie = toggleOpen(state)
		expect(replie.open).toBe(false)
		expect(replie.view).toEqual({ kind: "list" })
		expect(draftTextFor(replie, chatKey("c1"))).toBe("message conservé")
	})
})

describe("RIEN NE SE PERD — le texte en cours de frappe", () => {
	it("survit au passage d'une conversation à l'autre", () => {
		// C'est LE risque du bloc unique : changer de vue démonte la
		// précédente. Une fenêtre réduite gardait son texte ; ici c'est l'état.
		let state = openConversation(initialDockState(), chatKey("c1"))
		state = setDraftText(state, chatKey("c1"), "bonjour, je vous")
		state = openConversation(state, chatKey("c2"))
		state = backToList(state)
		state = openConversation(state, chatKey("c1"))
		expect(draftTextFor(state, chatKey("c1"))).toBe("bonjour, je vous")
	})

	it("survit AUSSI à un détour par le nouveau message", () => {
		let state = openConversation(initialDockState(), chatKey("c1"))
		state = setDraftText(state, chatKey("c1"), "à finir")
		state = openCompose(state)
		state = openConversation(state, chatKey("c1"))
		expect(draftTextFor(state, chatKey("c1"))).toBe("à finir")
	})

	it("ne garde pas d'entrée vide", () => {
		let state = setDraftText(initialDockState(), chatKey("c1"), "texte")
		state = setDraftText(state, chatKey("c1"), "")
		expect(Object.keys(state.drafts)).toHaveLength(0)
	})

	it("rend vide pour une conversation jamais tapée", () => {
		expect(draftTextFor(initialDockState(), chatKey("c9"))).toBe("")
	})

	it("rend la MÊME référence quand le texte est inchangé", () => {
		const state = setDraftText(initialDockState(), chatKey("c1"), "a")
		expect(setDraftText(state, chatKey("c1"), "a")).toBe(state)
	})
})

describe("promotion d'un brouillon", () => {
	it("emporte la conversation ET son texte vers le vrai fil", () => {
		let state = openConversation(initialDockState(), draftKey("l.mengue"))
		state = setDraftText(state, draftKey("l.mengue"), "première ligne")
		state = promoteDraft(state, "l.mengue", "c9")
		expect(activeKey(state)).toBe(chatKey("c9"))
		expect(draftTextFor(state, chatKey("c9"))).toBe("première ligne")
		expect(draftTextFor(state, draftKey("l.mengue"))).toBe("")
	})

	it("promeut le texte même si l'on regarde ailleurs", () => {
		let state = setDraftText(initialDockState(), draftKey("l.mengue"), "en attente")
		state = openConversation(state, chatKey("c1"))
		state = promoteDraft(state, "l.mengue", "c9")
		// On n'a pas volé l'écran à ce qu'on regardait…
		expect(activeKey(state)).toBe(chatKey("c1"))
		// …mais le texte n'a pas été perdu pour autant.
		expect(draftTextFor(state, chatKey("c9"))).toBe("en attente")
	})

	it("ne fait rien quand ce brouillon n'existe pas", () => {
		const state = openConversation(initialDockState(), chatKey("c1"))
		expect(promoteDraft(state, "inconnu", "c9")).toBe(state)
	})
})

describe("réconciliation avec les fils vivants", () => {
	it("referme une conversation dont le fil a disparu", () => {
		const state = openConversation(initialDockState(), chatKey("mort"))
		expect(reconcile(state, vivants(["vivant"])).view).toEqual({
			kind: "list",
		})
	})

	it("garde une conversation dont le fil vit", () => {
		const state = openConversation(initialDockState(), chatKey("vivant"))
		expect(activeKey(reconcile(state, vivants(["vivant"])))).toBe(
			chatKey("vivant"),
		)
	})

	it("garde un GROUPE vivant, referme un groupe quitté", () => {
		const dedans = openConversation(initialDockState(), groupeKey("g1"))
		expect(activeKey(reconcile(dedans, vivants([], ["g1"])))).toBe(
			groupeKey("g1"),
		)
		// Quitté (ou fermé) : la vue retombe sur la liste, comme un fil mort.
		expect(reconcile(dedans, vivants(["c1"], ["autre"])).view).toEqual({
			kind: "list",
		})
	})

	it("un identifiant de groupe ne SAUVE PAS un fil 1:1, ni l'inverse", () => {
		// Les deux familles se réconcilient chacune contre SA liste : un id
		// homonyme de l'autre famille ne doit pas faire vivre une clé morte.
		const chat = openConversation(initialDockState(), chatKey("x"))
		expect(reconcile(chat, vivants([], ["x"])).view).toEqual({ kind: "list" })
		const groupe = openConversation(initialDockState(), groupeKey("x"))
		expect(reconcile(groupe, vivants(["x"], [])).view).toEqual({
			kind: "list",
		})
	})

	it("NE TOUCHE PAS aux brouillons : ils ne sont connus que d'ici", () => {
		let state = openConversation(initialDockState(), draftKey("l.mengue"))
		state = setDraftText(state, draftKey("l.mengue"), "pas encore envoyé")
		const apres = reconcile(state, vivants())
		expect(activeKey(apres)).toBe(draftKey("l.mengue"))
		expect(draftTextFor(apres, draftKey("l.mengue"))).toBe("pas encore envoyé")
	})

	it("ne ferme pas le NOUVEAU MESSAGE — il ne dépend d'aucun fil", () => {
		const state = openCompose(initialDockState())
		expect(reconcile(state, vivants()).view).toEqual({ kind: "compose" })
		const groupe = openComposeGroupe(initialDockState())
		expect(reconcile(groupe, vivants()).view).toEqual({
			kind: "composeGroupe",
		})
	})

	it("balaie le texte des fils morts, qu'on ne peut plus atteindre", () => {
		let state = setDraftText(initialDockState(), chatKey("mort"), "orphelin")
		state = setDraftText(state, groupeKey("parti"), "orphelin aussi")
		expect(reconcile(state, vivants(["vivant"], ["g1"])).drafts).toEqual({})
	})

	it("rend la MÊME référence quand tout vit", () => {
		let state = openConversation(initialDockState(), chatKey("vivant"))
		state = setDraftText(state, groupeKey("g1"), "brouillon de groupe")
		expect(reconcile(state, vivants(["vivant"], ["g1"]))).toBe(state)
	})
})

describe("persistance", () => {
	it("porte le numéro 6 — la clé de stockage (dock-store) DOIT le suivre", () => {
		// Les deux numéros bougent ensemble : c'est la règle écrite aux deux
		// endroits, et ce test la rend impossible à moitié appliquer.
		// v6 = l'entrée des PIÈCES du brouillon (`media`) ; v5 était le
		// FLOTTEMENT (fenêtre détachée format smartphone).
		expect(SERIAL_VERSION).toBe(6)
	})

	it("fait l'aller-retour sans rien perdre — groupes compris", () => {
		let state = openConversation(initialDockState(), chatKey("c1"))
		state = setDraftText(state, chatKey("c1"), "à finir")
		state = setDraftText(state, groupeKey("g1"), "pour le groupe")
		expect(parseDock(serializeDock(state))).toEqual(state)
		expect(parseDock(serializeDock(openCompose(state)))).toEqual(
			openCompose(state),
		)
		const groupe = openConversation(state, groupeKey("g1"))
		expect(parseDock(serializeDock(groupe))).toEqual(groupe)
		expect(parseDock(serializeDock(openComposeGroupe(state)))).toEqual(
			openComposeGroupe(state),
		)
	})

	it("rend l'état initial sur tout ce qui n'est pas relisible", () => {
		for (const bad of [null, undefined, "", "{", "[]", '"texte"', "42"]) {
			expect(parseDock(bad)).toEqual(initialDockState())
		}
	})

	it("REFUSE les états des modèles précédents", () => {
		// v1 décrivait des fenêtres multiples, v2 une conversation adressée par
		// identifiant d'utilisateur, v3 ignorait les groupes, v4 ignorait le
		// flottement : rien à convertir, et lire de travers vaudrait pire
		// qu'une carte vide.
		const v1 = JSON.stringify({
			v: 1,
			windows: [{ key: "chat:c1", minimized: false, touchedAt: 1 }],
			listOpen: true,
		})
		const v2 = JSON.stringify({
			v: 2,
			open: true,
			active: "draft:u1",
			drafts: {},
		})
		const v3 = JSON.stringify({
			v: 3,
			open: true,
			view: { kind: "conversation", key: "chat:c1" },
			drafts: {},
		})
		const v4 = JSON.stringify({
			v: 4,
			open: true,
			view: { kind: "conversation", key: "chat:c1" },
			drafts: {},
		})
		expect(parseDock(v1)).toEqual(initialDockState())
		expect(parseDock(v2)).toEqual(initialDockState())
		expect(parseDock(v3)).toEqual(initialDockState())
		expect(parseDock(v4)).toEqual(initialDockState())
	})

	it("retombe sur la LISTE quand la vue est abîmée", () => {
		const raw = JSON.stringify({
			v: SERIAL_VERSION,
			open: true,
			view: { kind: "conversation", key: "cassé" },
			drafts: {},
		})
		expect(parseDock(raw).view).toEqual({ kind: "list" })
	})

	it("relit la vue de composition de GROUPE telle quelle", () => {
		const raw = JSON.stringify({
			v: SERIAL_VERSION,
			open: true,
			view: { kind: "composeGroupe" },
			drafts: {},
		})
		expect(parseDock(raw).view).toEqual({ kind: "composeGroupe" })
	})

	it("écarte un texte dont la clé est abîmée", () => {
		const raw = JSON.stringify({
			v: SERIAL_VERSION,
			open: true,
			view: { kind: "list" },
			drafts: {
				"pas une clé": "x",
				"chat:c1": "gardé",
				"chat:c2": "",
				"groupe:g1": "gardé aussi",
			},
		})
		expect(parseDock(raw).drafts).toEqual({
			"chat:c1": "gardé",
			"groupe:g1": "gardé aussi",
		})
	})

	it("ne replie pas une carte que personne n'a repliée", () => {
		const sansOpen = JSON.stringify({
			v: SERIAL_VERSION,
			view: { kind: "list" },
			drafts: {},
		})
		expect(parseDock(sansOpen).open).toBe(true)
		const replie = JSON.stringify({
			v: SERIAL_VERSION,
			open: false,
			view: { kind: "list" },
			drafts: {},
		})
		expect(parseDock(replie).open).toBe(false)
	})

	it("ne détache pas une carte que personne n'a détachée", () => {
		const sans = JSON.stringify({
			v: SERIAL_VERSION,
			open: true,
			view: { kind: "list" },
			drafts: {},
		})
		expect(parseDock(sans).floating).toBe(false)
		const flottant = JSON.stringify({
			v: SERIAL_VERSION,
			open: true,
			floating: true,
			view: { kind: "list" },
			drafts: {},
		})
		expect(parseDock(flottant).floating).toBe(true)
	})
})

describe("flottement — la fenêtre détachée format smartphone", () => {
	it("détacher DÉPLIE — la fenêtre flottante n'est jamais une barre vide", () => {
		const replie = setOpen(initialDockState(), false)
		const flottant = setFloating(replie, true)
		expect(flottant.floating).toBe(true)
		expect(flottant.open).toBe(true)
	})

	it("ré-ancrer CONSERVE l'état de repli", () => {
		const flottant = setFloating(initialDockState(), true)
		const replieEnFlottant = setOpen(flottant, true)
		const ancre = setFloating(replieEnFlottant, false)
		expect(ancre.floating).toBe(false)
		expect(ancre.open).toBe(true)
	})

	it("même-référence quand rien ne change", () => {
		const state = initialDockState()
		expect(setFloating(state, false)).toBe(state)
		const flottant = setFloating(state, true)
		expect(setFloating(flottant, true)).toBe(flottant)
	})

	it("le flottement survit à l'aller-retour de persistance", () => {
		const flottant = setFloating(initialDockState(), true)
		expect(parseDock(serializeDock(flottant))).toEqual(flottant)
	})
})

describe("les PIÈCES du brouillon — même invariant que le texte", () => {
	it("range les pièces par conversation et les relit", () => {
		const a = piece("a.png")
		const state = updateDraftMedia(initialDockState(), chatKey("c1"), (items) =>
			addMediaItems(items, [a]),
		)
		expect(draftMediaFor(state, chatKey("c1"))).toHaveLength(1)
		expect(draftMediaFor(state, chatKey("c2"))).toHaveLength(0)
	})

	it("rend LA MÊME référence quand la transition ne change rien", () => {
		const state = updateDraftMedia(initialDockState(), chatKey("c1"), (items) =>
			addMediaItems(items, [piece("a.png")]),
		)
		expect(updateDraftMedia(state, chatKey("c1"), (items) => items)).toBe(state)
	})

	it("les emporte quand le fil MEURT, et garde les vivants", () => {
		let state = updateDraftMedia(initialDockState(), chatKey("mort"), (items) =>
			addMediaItems(items, [piece("a.png")]),
		)
		state = updateDraftMedia(state, chatKey("vivant"), (items) =>
			addMediaItems(items, [piece("b.png")]),
		)
		const apres = reconcile(state, vivants(["vivant"]))
		expect(draftMediaFor(apres, chatKey("mort"))).toHaveLength(0)
		expect(draftMediaFor(apres, chatKey("vivant"))).toHaveLength(1)
	})

	it("les fait SUIVRE quand le brouillon devient un vrai fil", () => {
		// La promotion est l'instant où l'invariant est le plus attendu : une
		// pièce déjà MONTÉE laissée sur l'ancienne clé serait payée pour rien.
		const a = piece("a.png")
		let state = openConversation(initialDockState(), draftKey("nadia"))
		state = setDraftText(state, draftKey("nadia"), "avec une photo")
		state = updateDraftMedia(state, draftKey("nadia"), (items) =>
			addMediaItems(items, markMediaUploaded([a], a.localId, "st-1", 1)),
		)

		const apres = promoteDraft(state, "nadia", "c9")
		expect(draftMediaFor(apres, draftKey("nadia"))).toHaveLength(0)
		const suivies = draftMediaFor(apres, chatKey("c9"))
		expect(suivies).toHaveLength(1)
		expect(uploadedStorageId(suivies[0]!)).toBe("st-1")
	})

	it("promeut un brouillon qui n'a QUE des pièces, sans texte", () => {
		let state = initialDockState()
		state = updateDraftMedia(state, draftKey("nadia"), (items) =>
			addMediaItems(items, [piece("a.png")]),
		)
		const apres = promoteDraft(state, "nadia", "c9")
		expect(apres).not.toBe(state)
		expect(draftMediaFor(apres, chatKey("c9"))).toHaveLength(1)
	})

	it("survit à l'aller-retour de sérialisation, storageId compris", () => {
		const a = piece("a.png")
		let state = updateDraftMedia(initialDockState(), chatKey("c1"), (items) =>
			addMediaItems(items, [a]),
		)
		state = updateDraftMedia(state, chatKey("c1"), (items) =>
			markMediaUploaded(items, a.localId, "st-42", 7),
		)
		const relu = parseDock(serializeDock(state))
		expect(relu).toEqual(state)
		expect(uploadedStorageId(draftMediaFor(relu, chatKey("c1"))[0]!)).toBe(
			"st-42",
		)
	})

	it("RETIRE l'entrée quand la dernière pièce s'en va", () => {
		const a = piece("a.png")
		let state = updateDraftMedia(initialDockState(), chatKey("c1"), (items) =>
			addMediaItems(items, [a]),
		)
		state = updateDraftMedia(state, chatKey("c1"), (items) =>
			removeMediaItem(items, a.localId),
		)
		expect(Object.keys(state.media)).toHaveLength(0)
	})

	it("un état persisté SANS pièces se relit sans exploser", () => {
		// Le champ est arrivé en v6 : un payload de la même version écrit par
		// une build antérieure d'une seconde ne doit pas casser la carte.
		const relu = parseDock(
			JSON.stringify({ v: SERIAL_VERSION, open: true, view: { kind: "list" } }),
		)
		expect(relu.media).toEqual({})
	})
})
