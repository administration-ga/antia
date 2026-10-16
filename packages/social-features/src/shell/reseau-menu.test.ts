// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-menu.test.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque avec son module ; adresses composées sur une table de routes INJECTÉE (celle du test) au lieu des chemins de l'espace — la fiche d'une page par `links.page(handle)`, son échappement compris ; entrées comparées aux volets SERVIS (« Conférences » attend le module `live`) et par leurs CLÉS i18n ; phrase de la pastille lue dans l'i18n du moteur ; cas ajoutés : volets servis dérivés du contrat, volet non servi rabattu sur le fil, base qui porte déjà une query.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../i18n"
import {
	RESEAU_AGENT_TAB_IDS,
	RESEAU_AGENT_TABS,
	reseauAgentHref,
} from "./reseau-agent-nav"
import {
	isServedReseauTab,
	menuBadgeLabel,
	menuItemsFor,
	RESEAU_SERVED_TAB_IDS,
	servedReseauTab,
	SHORTCUTS_MAX,
	shortcutsFor,
	type ShortcutLinks,
} from "./reseau-menu"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** La base de la page réseau, telle que l'application l'injecterait (`useRoutes().home()`). */
const BASE = "/reseau-test"

/** Les adresses des raccourcis, telles que l'application les injecterait (`useRoutes()`). */
const LINKS: ShortcutLinks = {
	home: BASE,
	page: (handle) => `/page-test/${encodeURIComponent(handle)}`,
}

describe("les volets servis — dérivés du contrat, jamais recopiés", () => {
	it("gardent l'ordre du contrat et incluent les conférences (F3a)", () => {
		expect(RESEAU_SERVED_TAB_IDS).toEqual(RESEAU_AGENT_TAB_IDS)
		expect(isServedReseauTab("conferences")).toBe(true)
		for (const id of RESEAU_SERVED_TAB_IDS) expect(isServedReseauTab(id)).toBe(true)
	})

	it("servent chaque volet du contrat", () => {
		// Une adresse ancienne (`?tab=directs`) ne doit pas ouvrir un écran vide.
		expect(servedReseauTab("conferences")).toBe("conferences")
		for (const id of RESEAU_SERVED_TAB_IDS) expect(servedReseauTab(id)).toBe(id)
	})
})

describe("menuItemsFor — les volets, dérivés et non recopiés", () => {
	it("reprend TOUS les volets servis quand il remplace la tablist", () => {
		const ids = menuItemsFor({}, BASE).map((item) => item.id)
		expect(ids).toEqual(RESEAU_SERVED_TAB_IDS)
		expect(ids).not.toContain("messages")
		// Retiré le 2026-09-06 avec le volet lui-même (R-03) : le relevé des
		// notifications est le contenu de la cloche, pas une destination.
		expect(ids).not.toContain("activite")
		// Sans directs servis, aucune entrée ne mène à un volet vide.
		expect(ids).toContain("conferences")
	})

	it("suit AUTOMATIQUEMENT la liste complète des volets", () => {
		// C'est l'invariant qui justifie ce module : le jour où un volet est
		// ajouté à `RESEAU_AGENT_TABS`, il doit apparaître au rail sans que
		// personne n'y pense. Une liste recopiée ici aurait laissé le rail en
		// retard d'un volet sur la page — c'est exactement ce qui est arrivé au
		// manifeste de navigation du socle.
		const volets = menuItemsFor({}, BASE)
		const attendus = RESEAU_AGENT_TABS.filter((tab) => isServedReseauTab(tab.id))
		expect(volets).toHaveLength(attendus.length)
		for (const [index, tab] of attendus.entries()) {
			expect(volets[index]!.id).toBe(tab.id)
			expect(volets[index]!.labelKey).toBe(tab.labelKey)
		}
	})

	it("nomme chaque entrée par une clé TRADUITE (jamais une clé nue à l'écran)", () => {
		for (const item of menuItemsFor({}, BASE)) {
			const label = t(item.labelKey)
			expect(label.length).toBeGreaterThan(0)
			expect(label).not.toBe(item.labelKey)
		}
		expect(t(menuItemsFor({}, BASE)[0]!.labelKey)).toBe("Fil")
	})

	it("adresse chaque volet par `reseauAgentHref` sur la base injectée", () => {
		for (const item of menuItemsFor({}, BASE)) {
			expect(item.href).toBe(reseauAgentHref(item.id, BASE))
		}
		// Le fil, volet par défaut, est la base NUE.
		expect(menuItemsFor({}, BASE)[0]!.href).toBe(BASE)
	})

	it("donne une icône à CHAQUE volet", () => {
		for (const item of menuItemsFor({}, BASE)) {
			expect(item.icon.length).toBeGreaterThan(0)
		}
	})

	it("n'a AUCUNE adresse en double", () => {
		const hrefs = menuItemsFor({}, BASE).map((item) => item.href)
		expect(new Set(hrefs).size).toBe(hrefs.length)
	})
})

describe("pastilles — un chiffre ne s'affiche que s'il dit quelque chose", () => {
	it("porte le décompte sur Relations — le SEUL du rail", () => {
		// Le décompte d'activité a suivi son volet : il vit sur la cloche du
		// chrome, une seule fois (R-03). Deux surfaces pour un chiffre, c'est
		// deux états de lecture à tenir d'accord.
		const items = menuItemsFor({ invitations: 3 }, BASE)
		const byId = new Map(items.map((item) => [item.id, item]))
		expect(byId.get("relations")?.badge).toBe(3)
		for (const item of items) {
			if (item.id === "relations") continue
			expect(item.badge).toBeNull()
		}
	})

	it("rend `null` à zéro comme à l'absence", () => {
		// Un « 0 » à côté de « Relations » se lit comme un décompte à traiter,
		// alors qu'il annonce exactement le contraire.
		const zero = menuItemsFor(
			{
				invitations: 0,
			},
			BASE,
		)
		for (const item of zero) expect(item.badge).toBeNull()
		for (const item of menuItemsFor({}, BASE)) expect(item.badge).toBeNull()
	})

	it("ne pose AUCUNE pastille sur les volets qui n'en portent pas", () => {
		const items = menuItemsFor({ invitations: 3 }, BASE)
		for (const item of items) {
			if (item.id === "relations") continue
			expect(item.badge).toBeNull()
		}
	})

	it("double chaque pastille d'une phrase — un « 3 » nu ne dit pas 3 quoi", () => {
		const items = menuItemsFor(
			{
				invitations: 1,
			},
			BASE,
		)
		const byId = new Map(items.map((item) => [item.id, item]))
		expect(menuBadgeLabel(byId.get("relations")!, t)).toBe("1 invitation en attente")
		const plusieurs = menuItemsFor({ invitations: 3 }, BASE).find((item) => item.id === "relations")
		expect(menuBadgeLabel(plusieurs!, t)).toBe("3 invitations en attente")
		// Pas de pastille, pas de phrase — sinon le lecteur d'écran annonce un
		// décompte là où l'écran n'affiche rien.
		expect(menuBadgeLabel(byId.get("fil")!, t)).toBeNull()
	})
})

describe("shortcutsFor", () => {
	const pages = [
		{ pageId: "p1", handle: "min-sante", name: "Ministère de la Santé" },
		{ pageId: "p2", handle: "dgi", name: "Direction Générale des Impôts", logoUrl: "u" },
	]
	const groups = [
		{ groupId: "g1", name: "Numérique" },
		{ groupId: "g2", name: "Achats publics", imageUrl: "v" },
	]

	it("met les pages AVANT les groupes", () => {
		// Ce qui ARRIVE (une page publie pour moi) prime sur ce que je visite.
		const ids = shortcutsFor(pages, groups, LINKS).map((item) => item.id)
		expect(ids).toEqual(["page:p1", "page:p2", "groupe:g1", "groupe:g2"])
	})

	it("adresse une page par la table des routes et un groupe par le volet Groupes", () => {
		const [page] = shortcutsFor(pages, [], LINKS)
		expect(page!.href).toBe(LINKS.page("min-sante"))
		const [group] = shortcutsFor([], groups, LINKS)
		expect(group!.href.startsWith(`${BASE}?`)).toBe(true)
		expect(group!.href).toContain("tab=groupes")
		expect(group!.href).toContain("groupe=g1")
	})

	it("échappe un handle qui en aurait besoin", () => {
		const [page] = shortcutsFor([{ pageId: "p", handle: "a b", name: "A B" }], [], LINKS)
		expect(page!.href).toBe(LINKS.page("a b"))
		expect(page!.href).toContain("a%20b")
	})

	it("compose le groupe sur une base qui porte déjà une query", () => {
		const [group] = shortcutsFor([], groups, { ...LINKS, home: `${BASE}?reseau=x` })
		expect(group!.href).toContain("reseau=x&tab=groupes")
	})

	it("tronque à SHORTCUTS_MAX", () => {
		const many = Array.from({ length: 9 }, (_, index) => ({
			pageId: `p${index}`,
			handle: `h${index}`,
			name: `P${index}`,
		}))
		expect(shortcutsFor(many, groups, LINKS)).toHaveLength(SHORTCUTS_MAX)
		expect(shortcutsFor(many, groups, LINKS, 2)).toHaveLength(2)
		expect(shortcutsFor(many, groups, LINKS, 0)).toHaveLength(0)
	})

	it("rend une liste vide sans rien casser", () => {
		expect(shortcutsFor([], [], LINKS)).toEqual([])
	})

	it("normalise l'absence de visuel en `null`", () => {
		const [sans] = shortcutsFor([pages[0]!], [], LINKS)
		expect(sans!.imageUrl).toBeNull()
		const [avec] = shortcutsFor([pages[1]!], [], LINKS)
		expect(avec!.imageUrl).toBe("u")
	})

	it("n'a AUCUN identifiant en double — page et groupe sont préfixés", () => {
		// Un `pageId` et un `groupId` peuvent parfaitement coïncider : ce sont
		// deux tables. Sans préfixe, React verrait deux enfants de même clé.
		const items = shortcutsFor([{ pageId: "x", handle: "h", name: "N" }], [{ groupId: "x", name: "G" }], LINKS)
		expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
	})
})
