// Dupliqué de socle/packages/agent-features/src/features/stories/stories-viewer.test.ts @ ad2e7fdc2 — adaptations : groupes au DTO du moteur (`personId`, `cover` toujours porté) ; cas de `parseStorySurface` retiré avec les surfaces (le moteur n'en a qu'une) ; noms accessibles lus par l'i18n du moteur (`t` français, mêmes phrases attendues) ; cas ajoutés : hôte et auteur sans nom (libellé neutre), média suivant retenu par la garde des fichiers.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { StoryTrayGroup } from "./stories-tray"
import {
	buildViewerItems,
	preloadTarget,
	storySourceFor,
	viewerBodyState,
	viewerItemKey,
	viewerItemLabel,
	type LiveDirectCard,
} from "./stories-viewer"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "stories" }).getFixedT("fr")

function direct(sessionId: string, title = "Point de presse"): LiveDirectCard {
	return {
		sessionId,
		title,
		audience: "public",
		startedAt: 1_000,
		host: { displayName: "Marie Ndong", handle: "marie", avatarUrl: null },
		counters: { viewerGrantCount: 3, comments: 0, reactions: 0 },
		isHost: false,
	}
}

function group(handle: string | null, storyCount = 2): StoryTrayGroup {
	return {
		author: {
			personId: `person-${handle ?? "anonyme"}`,
			handle,
			displayName: handle ?? "Sans profil",
			avatarUrl: null,
		},
		storyCount,
		unseenCount: 0,
		latestPublishedAt: 0,
		cover: { url: "c.jpg", kind: "image" },
	}
}

describe("buildViewerItems", () => {
	it("empile les directs AVANT les stories", () => {
		const plan = buildViewerItems(
			[direct("s1")],
			[group("marie"), group("paul")],
		)
		expect(plan.items.map((item) => item.kind)).toEqual([
			"direct",
			"stories",
			"stories",
		])
	})

	it("conserve l'ordre des groupes reçu — il vient d'orderTray", () => {
		const plan = buildViewerItems([], [group("paul"), group("marie")])
		expect(
			plan.items.map((item) =>
				item.kind === "stories" ? item.group.author.handle : null,
			),
		).toEqual(["paul", "marie"])
	})

	it("entre par le début quand aucun auteur n'est demandé", () => {
		expect(buildViewerItems([direct("s1")], [group("marie")]).startIndex).toBe(
			0,
		)
	})

	it("entre sur l'auteur demandé, directs compris dans le décompte", () => {
		const plan = buildViewerItems(
			[direct("s1"), direct("s2")],
			[group("marie"), group("paul")],
			{ startAuthor: "paul" },
		)
		expect(plan.startIndex).toBe(3)
		const entry = plan.items[3]
		expect(entry?.kind === "stories" && entry.group.author.handle).toBe("paul")
	})

	it("retombe sur le début quand l'auteur demandé n'a plus de story", () => {
		const plan = buildViewerItems([], [group("marie")], {
			startAuthor: "disparu",
		})
		expect(plan.startIndex).toBe(0)
	})

	it("ignore un auteur demandé vide ou nul", () => {
		expect(
			buildViewerItems([], [group("marie")], { startAuthor: "" }).startIndex,
		).toBe(0)
		expect(
			buildViewerItems([], [group("marie")], { startAuthor: null }).startIndex,
		).toBe(0)
	})

	it("écarte un groupe sans story — un écran vide passe pour un bug", () => {
		const plan = buildViewerItems([], [group("marie", 0), group("paul", 1)])
		expect(plan.items).toHaveLength(1)
		const entry = plan.items[0]
		expect(entry?.kind === "stories" && entry.group.author.handle).toBe("paul")
	})

	it("n'empile que les directs quand on le demande", () => {
		const plan = buildViewerItems([direct("s1")], [group("marie")], {
			onlyDirects: true,
		})
		expect(plan.items.map((item) => item.kind)).toEqual(["direct"])
	})

	it("rend une pile vide et un index nul quand il n'y a rien", () => {
		expect(buildViewerItems([], [])).toEqual({ items: [], startIndex: 0 })
	})
})

describe("viewerItemKey", () => {
	it("préfixe la clé d'un direct par sa session", () => {
		expect(viewerItemKey({ kind: "direct", direct: direct("s1") })).toBe(
			"direct:s1",
		)
	})

	it("clé une série par l'identifiant d'auteur, jamais par son handle", () => {
		expect(viewerItemKey({ kind: "stories", group: group(null) })).toBe(
			"stories:person-anonyme",
		)
	})

	it("distingue deux séries sans handle publié", () => {
		const first = group(null)
		const second = {
			...group(null),
			author: { ...group(null).author, personId: "person-2" },
		}
		expect(viewerItemKey({ kind: "stories", group: first })).not.toBe(
			viewerItemKey({ kind: "stories", group: second }),
		)
	})
})

describe("storySourceFor", () => {
	it("sert MA série par myActive quand le handle est le mien", () => {
		expect(storySourceFor("moi", "moi")).toBe("mine")
	})

	it("sert la série d'un tiers par listByAuthor", () => {
		expect(storySourceFor("marie", "moi")).toBe("author")
	})

	it("sert par myActive un auteur sans handle quand je n'en ai pas non plus", () => {
		expect(storySourceFor(null, null)).toBe("mine")
	})

	it("rend indisponible un auteur sans handle quand j'en ai un", () => {
		expect(storySourceFor(null, "moi")).toBe("unavailable")
	})

	it("traite une chaîne vide comme un handle absent", () => {
		expect(storySourceFor("", "")).toBe("mine")
		expect(storySourceFor("", "moi")).toBe("unavailable")
	})
})

describe("viewerItemLabel", () => {
	it("nomme un direct par son hôte et son titre", () => {
		expect(
			viewerItemLabel({ kind: "direct", direct: direct("s1", "Conseil") }, t),
		).toBe("Conférence de Marie Ndong : Conseil")
	})

	it("nomme une série par son auteur", () => {
		expect(viewerItemLabel({ kind: "stories", group: group("marie") }, t)).toBe(
			"Actus de marie",
		)
	})

	it("nomme par le libellé neutre un hôte ou un auteur que le moteur ne nomme pas", () => {
		const anonymousHost = {
			...direct("s1", "Conseil"),
			host: { displayName: null, handle: null, avatarUrl: null },
		}
		expect(viewerItemLabel({ kind: "direct", direct: anonymousHost }, t)).toBe(
			"Conférence de Membre du réseau : Conseil",
		)
		const unnamed = {
			...group(null),
			author: { ...group(null).author, displayName: null },
		}
		expect(viewerItemLabel({ kind: "stories", group: unnamed }, t)).toBe(
			"Actus de Membre du réseau",
		)
	})
})

describe("viewerBodyState — priorité stricte error > loading > empty > pager", () => {
	it("l'erreur prime sur TOUT — y compris un chargement encore en vol", () => {
		expect(
			viewerBodyState({ fatalError: true, loaded: false, empty: true }),
		).toBe("error")
		expect(
			viewerBodyState({ fatalError: true, loaded: true, empty: false }),
		).toBe("error")
	})

	it("charge tant que tout n'a pas répondu", () => {
		expect(
			viewerBodyState({ fatalError: false, loaded: false, empty: true }),
		).toBe("loading")
	})

	it("vide une fois chargé sans rien à empiler", () => {
		expect(
			viewerBodyState({ fatalError: false, loaded: true, empty: true }),
		).toBe("empty")
	})

	it("pager quand tout est là", () => {
		expect(
			viewerBodyState({ fatalError: false, loaded: true, empty: false }),
		).toBe("pager")
	})
})

describe("preloadTarget — le segment suivant de la MÊME série", () => {
	const media = (url: string | null, kind: "image" | "video" = "image") => ({
		media: { url, kind },
	})

	it("vise la story suivante", () => {
		expect(
			preloadTarget([media("a.jpg"), media("b.mp4", "video")], 0),
		).toEqual({ url: "b.mp4", kind: "video" })
	})

	it("rend null en fin de série — les auteurs voisins sont déjà montés par le pager", () => {
		expect(preloadTarget([media("a.jpg")], 0)).toBeNull()
	})

	it("rend null sur une série vide ou un index aberrant", () => {
		expect(preloadTarget([], 0)).toBeNull()
		expect(preloadTarget([media("a.jpg"), media("b.jpg")], -1)).toBeNull()
		expect(preloadTarget([media("a.jpg"), media("b.jpg")], 1.5)).toBeNull()
	})

	it("ne précharge pas un média retenu par la garde des fichiers", () => {
		expect(preloadTarget([media("a.jpg"), media(null, "video")], 0)).toBeNull()
	})
})
