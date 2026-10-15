// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-routes.test.ts @ ad2e7fdc2 — adaptations : base INJECTÉE (celle des routes de test, `/messages`) au lieu de `/espace/messages` ; cas ajoutés pour une base imbriquée et une base à barre finale (la borne de profondeur se compte depuis la base) ; cas du hub administratif (`hubChatHref`, 3 cas) retirés avec lui.
import { describe, expect, it } from "vitest"

import { chatKey, draftKey, groupeKey } from "./messagerie-dock"
import {
	composeGroupeHref,
	composeHref,
	conversationHref,
	conversationKeyFromPath,
	hrefAvecInfos,
	infosOuvertes,
	isConversationRoute,
	parseConversationRoute,
} from "./messagerie-routes"

/** La base de la messagerie telle que l'application l'injecte (celle des routes de test). */
const BASE = "/messages"

describe("conversationHref / parseConversationRoute — l'aller-retour", () => {
	it("rend l'adresse d'un fil 1:1", () => {
		expect(conversationHref(chatKey("k97abc"), BASE)).toBe("/messages/chat/k97abc")
	})

	it("rend l'adresse d'un groupe", () => {
		expect(conversationHref(groupeKey("g42"), BASE)).toBe("/messages/groupe/g42")
	})

	it("rend l'adresse d'un brouillon sous le segment « a », pas « draft »", () => {
		expect(conversationHref(draftKey("nzoghe"), BASE)).toBe("/messages/a/nzoghe")
	})

	it("fait l'aller-retour sur les TROIS genres", () => {
		for (const key of [chatKey("k1"), groupeKey("g1"), draftKey("h1")]) {
			const href = conversationHref(key, BASE)
			expect(href).not.toBeNull()
			expect(conversationKeyFromPath(href, BASE)).toBe(key)
		}
	})

	it("rend `null` sur une clé que `parseKey` refuse", () => {
		expect(conversationHref("sans-genre", BASE)).toBeNull()
		expect(conversationHref("chat:", BASE)).toBeNull()
	})
})

describe("la base est celle de l'application — jamais écrite ici", () => {
	it("compose sous une base IMBRIQUÉE et en relit la clé", () => {
		const imbriquee = "/r/antia/messages"
		const href = conversationHref(groupeKey("g9"), imbriquee)
		expect(href).toBe("/r/antia/messages/groupe/g9")
		expect(isConversationRoute(href, imbriquee)).toBe(true)
		expect(conversationKeyFromPath(href, imbriquee)).toBe(groupeKey("g9"))
		// Sous une AUTRE base, la même adresse n'est pas une conversation.
		expect(isConversationRoute(href, BASE)).toBe(false)
	})

	it("tolère une base à barre finale, sans double barre", () => {
		expect(conversationHref(chatKey("k1"), "/messages/")).toBe("/messages/chat/k1")
		expect(composeHref("/messages/")).toBe("/messages/nouveau")
		expect(isConversationRoute("/messages/chat/k1", "/messages/")).toBe(true)
	})

	it("une base racine ne fabrique pas `//`", () => {
		expect(conversationHref(chatKey("k1"), "/")).toBe("/chat/k1")
		expect(isConversationRoute("/chat/k1", "/")).toBe(true)
	})
})

describe("handles accentués — l'encodage et son retour", () => {
	it("encode un handle accentué dans l'adresse", () => {
		expect(conversationHref(draftKey("mengue.mé"), BASE)).toBe("/messages/a/mengue.m%C3%A9")
	})

	it("retrouve le handle accentué depuis le chemin encodé", () => {
		expect(conversationKeyFromPath("/messages/a/mengue.m%C3%A9", BASE)).toBe(draftKey("mengue.mé"))
	})

	it("encode aussi une barre oblique, qui découperait sinon le chemin", () => {
		const href = conversationHref(draftKey("a/b"), BASE)
		expect(href).toBe("/messages/a/a%2Fb")
		expect(conversationKeyFromPath(href, BASE)).toBe(draftKey("a/b"))
	})

	it("refuse un chemin dont le pourcent est isolé, au lieu de lever", () => {
		expect(conversationKeyFromPath("/messages/a/%zz", BASE)).toBeNull()
	})

	it("ne re-décode PAS l'identifiant reçu d'une coquille de route", () => {
		// Un handle contenant réellement « %C3 » reste tel quel : le décodage
		// appartient à la coquille, pas à ce module.
		expect(parseConversationRoute("a", "brut%C3")).toBe(draftKey("brut%C3"))
	})
})

describe("parseConversationRoute — ce qui n'est pas une conversation", () => {
	it("refuse un genre inconnu", () => {
		expect(parseConversationRoute("draft", "x")).toBeNull()
		expect(parseConversationRoute("nouveau", "x")).toBeNull()
		expect(parseConversationRoute("", "x")).toBeNull()
	})

	it("refuse un identifiant vide ou absent", () => {
		expect(parseConversationRoute("chat", "")).toBeNull()
		expect(parseConversationRoute("chat", null)).toBeNull()
		expect(parseConversationRoute(null, "x")).toBeNull()
	})
})

describe("isConversationRoute — la base, puis deux segments", () => {
	it("reconnaît les trois genres de conversation", () => {
		expect(isConversationRoute("/messages/chat/k1", BASE)).toBe(true)
		expect(isConversationRoute("/messages/groupe/g1", BASE)).toBe(true)
		expect(isConversationRoute("/messages/a/h1", BASE)).toBe(true)
	})

	it("refuse la LISTE elle-même", () => {
		expect(isConversationRoute(BASE, BASE)).toBe(false)
	})

	it("refuse les DEUX composeurs — un segment sous la base, pas deux", () => {
		expect(isConversationRoute(composeHref(BASE), BASE)).toBe(false)
		expect(isConversationRoute(composeGroupeHref(BASE), BASE)).toBe(false)
	})

	it("ignore la query et l'ancre", () => {
		expect(isConversationRoute("/messages/chat/k1?x=1#z", BASE)).toBe(true)
	})

	it("tolère la barre finale", () => {
		expect(isConversationRoute("/messages/chat/k1/", BASE)).toBe(true)
	})

	it("refuse une adresse hors de la messagerie", () => {
		expect(isConversationRoute("/reseau/chat/k1", BASE)).toBe(false)
		expect(isConversationRoute("/messagerie/chat/k1", BASE)).toBe(false)
		expect(isConversationRoute(null, BASE)).toBe(false)
	})

	it("refuse une profondeur de trois segments sous la base", () => {
		expect(isConversationRoute("/messages/chat/k1/plus", BASE)).toBe(false)
	})
})

describe("les deux composeurs", () => {
	it("portent des adresses distinctes sous la liste", () => {
		expect(composeHref(BASE)).toBe("/messages/nouveau")
		expect(composeGroupeHref(BASE)).toBe("/messages/nouveau-groupe")
	})

	it("ne rendent aucune clé de conversation", () => {
		expect(conversationKeyFromPath(composeHref(BASE), BASE)).toBeNull()
		expect(conversationKeyFromPath(composeGroupeHref(BASE), BASE)).toBeNull()
	})
})

describe("le panneau d'informations s'adresse par une QUERY", () => {
	it("`?infos=1` ouvre, tout le reste ferme", () => {
		expect(infosOuvertes("?infos=1")).toBe(true)
		expect(infosOuvertes("infos=1")).toBe(true)
		expect(infosOuvertes("?infos=1&tab=ichat")).toBe(true)
		expect(infosOuvertes("?infos=0")).toBe(false)
		expect(infosOuvertes("?infos=oui")).toBe(false)
		expect(infosOuvertes("")).toBe(false)
		expect(infosOuvertes(null)).toBe(false)
		expect(infosOuvertes(undefined)).toBe(false)
	})

	it("ouvrir et refermer CONSERVE les autres paramètres", () => {
		// `?tab=…` porte un onglet : le perdre en ouvrant un panneau ramènerait
		// sur un autre volet en le refermant.
		const ouvert = hrefAvecInfos("/messages/groupe/abc", "?tab=ichat", true)
		expect(ouvert).toContain("tab=ichat")
		expect(ouvert).toContain("infos=1")
		expect(hrefAvecInfos("/messages/groupe/abc", ouvert.split("?")[1], false)).toBe(
			"/messages/groupe/abc?tab=ichat",
		)
	})

	it("refermer sans autre paramètre rend le chemin NU — pas un `?` orphelin", () => {
		expect(hrefAvecInfos("/messages/groupe/abc", "?infos=1", false)).toBe("/messages/groupe/abc")
		expect(hrefAvecInfos("/messages/groupe/abc", null, false)).toBe("/messages/groupe/abc")
	})

	it("la query ne change PAS la nature de l'adresse — elle reste une conversation", () => {
		// `isConversationRoute` compte les SEGMENTS, query retirée. C'est
		// l'argument central du choix d'une query plutôt qu'un segment de plus.
		expect(isConversationRoute("/messages/groupe/abc?infos=1", BASE)).toBe(true)
		expect(conversationKeyFromPath("/messages/groupe/abc?infos=1", BASE)).toBe("groupe:abc")
	})
})
