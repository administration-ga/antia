// Dupliqué de socle/packages/agent-features/src/features/direct/direct-scene.test.ts @ ad2e7fdc2 — adaptations : tests de géométrie et d’ordre conservés ; assertions de phrases déplacées dans les tests i18n de la scène.
import { describe, expect, it } from "vitest"
import {
	DIRECT_SCENE_MIN_BAND_TILE,
	orderDirectTiles,
	planDirectScene,
	type DirectSceneCandidate,
	type DirectScenePlanInput,
} from "./direct-scene"
import { DIRECT_STAGE_CAPACITY } from "./direct-stage-format"

/** Les trois conteneurs de la matrice de recette, plus les deux extrêmes. */
const TELEPHONE_PORTRAIT = { width: 390, height: 844 }
const TELEPHONE_PAYSAGE = { width: 844, height: 390 }
const BUREAU = { width: 1280, height: 720 }
const TRES_ETROIT = { width: 320, height: 568 }
const MOBILE_MOYEN = { width: 360, height: 640 }

function plan(input: Partial<DirectScenePlanInput> & { tiles: number }) {
	return planDirectScene({
		emission: "computer",
		container: BUREAU,
		...input,
	})
}

describe("planDirectScene — les paliers, mesurés sur le CONTENEUR", () => {
	it("une seule personne occupe la scène, sans case vide", () => {
		// LE défaut D-04 : la scène remplissait toujours huit places. À deux
		// intervenants, six cases « Place intervenant n » prenaient les trois
		// quarts de l'écran.
		const solo = plan({ tiles: 1 })
		expect(solo.kind).toBe("solo")
		expect(solo.columns).toBe(1)
		expect(solo.rows).toBe(1)
		expect(solo.maxVisible).toBe(1)
	})

	it("personne n'a encore publié : la scène reste valide", () => {
		const vide = plan({ tiles: 0 })
		expect(vide.kind).toBe("solo")
		expect(vide.tiles).toBe(0)
		expect(vide.maxVisible).toBe(1)
	})

	it("à deux, côte à côte au paysage et empilées au portrait", () => {
		expect(plan({ tiles: 2, container: BUREAU })).toMatchObject({
			kind: "duo",
			columns: 2,
			rows: 1,
		})
		expect(plan({ tiles: 2, container: TELEPHONE_PAYSAGE })).toMatchObject({
			columns: 2,
			rows: 1,
		})
		// Deux fentes verticales ne montrent aucun visage.
		expect(plan({ tiles: 2, container: TELEPHONE_PORTRAIT })).toMatchObject({
			kind: "duo",
			columns: 1,
			rows: 2,
		})
	})

	it.each([3, 4])("à %i, deux colonnes partout", (tiles) => {
		for (const container of [TRES_ETROIT, MOBILE_MOYEN, TELEPHONE_PORTRAIT, BUREAU]) {
			const result = plan({ tiles, container })
			expect(result.kind).toBe("grid")
			expect(result.columns).toBe(2)
			expect(result.rows).toBe(Math.ceil(tiles / 2))
			expect(result.band).toBe("none")
		}
	})

	it.each([5, 6])("à %i, trois colonnes au large et deux à l'étroit", (tiles) => {
		expect(plan({ tiles, container: BUREAU }).columns).toBe(3)
		expect(plan({ tiles, container: TELEPHONE_PAYSAGE }).columns).toBe(3)
		expect(plan({ tiles, container: TELEPHONE_PORTRAIT }).columns).toBe(2)
		expect(plan({ tiles, container: TRES_ETROIT }).columns).toBe(2)
	})

	it.each([7, 8])("à %i, une image en grand et les autres en bandeau", (tiles) => {
		const result = plan({ tiles, container: BUREAU })
		expect(result.kind).toBe("grid")
		expect(result.band).not.toBe("none")
		expect(result.bandTotal).toBe(tiles - 1)
		// Personne n'est NOMMÉ : c'est la première tuile ordonnée qui domine.
		expect(result.focusKey).toBeNull()
	})

	it("au-delà de la capacité d'antenne, on ne rend pas une neuvième place", () => {
		expect(plan({ tiles: 42 }).tiles).toBe(DIRECT_STAGE_CAPACITY)
	})

	it("sans mesure (rendu serveur), la disposition suppose le LARGE", () => {
		// Même doctrine que `resolveDirectLayout` : on se trompe du côté qui
		// MONTRE. Supposer l'étroit cacherait des gens le temps de la mesure.
		expect(plan({ tiles: 6, container: null }).columns).toBe(3)
		expect(plan({ tiles: 2, container: null }).columns).toBe(2)
		// Une mesure absurde (0, NaN) vaut une absence de mesure.
		expect(plan({ tiles: 6, container: { width: 0, height: 0 } }).columns).toBe(3)
		expect(
			plan({ tiles: 6, container: { width: Number.NaN, height: 720 } }).columns,
		).toBe(3)
	})
})

describe("planDirectScene — le format d'ÉMISSION ne cadre plus la scène", () => {
	it("une source verticale regardée au bureau reste verticale, sans cadre en vh", () => {
		// Le défaut : `.direct-stage-frame` valait `min(100%, 39.375vh)` pour une
		// émission mobile — la SESSION imposait sa hauteur au LECTEUR.
		const result = plan({ tiles: 4, emission: "mobile", container: BUREAU })
		expect(result.tileAspect).toBeCloseTo(9 / 16)
		expect(result.columns).toBeGreaterThanOrEqual(2)
	})

	it("chaque format donne sa proportion de tuile, et rien d'autre", () => {
		expect(plan({ tiles: 1, emission: "television" }).tileAspect).toBeCloseTo(16 / 9)
		expect(plan({ tiles: 1, emission: "computer" }).tileAspect).toBeCloseTo(4 / 3)
		expect(plan({ tiles: 1, emission: "mobile" }).tileAspect).toBeCloseTo(9 / 16)
		// Le format ne change NI le nombre de colonnes NI le nombre de lignes.
		for (const emission of ["television", "computer", "mobile"] as const) {
			expect(plan({ tiles: 4, emission })).toMatchObject({ columns: 2, rows: 2 })
		}
	})
})

describe("planDirectScene — la grille fixe est un choix, pas un défaut", () => {
	it("demandée, elle rend huit places : 4×2 au large, 2×4 à l'étroit", () => {
		const large = plan({ tiles: 2, fixedGrid: true, container: BUREAU })
		expect(large).toMatchObject({ kind: "fixed", columns: 4, rows: 2 })
		expect(large.maxVisible).toBe(DIRECT_STAGE_CAPACITY)

		const etroit = plan({ tiles: 2, fixedGrid: true, container: TRES_ETROIT })
		expect(etroit).toMatchObject({ kind: "fixed", columns: 2, rows: 4 })
	})

	it("elle ne s'applique JAMAIS à un contenu partagé", () => {
		// Sinon le document repasserait dans un huitième d'écran — le défaut
		// D-05 exactement, rentré par la porte de derrière.
		const result = plan({ tiles: 3, fixedGrid: true, hasPresentation: true })
		expect(result.kind).toBe("presentation")
	})

	it("non demandée, elle n'arrive jamais toute seule", () => {
		expect(plan({ tiles: 3 }).kind).toBe("grid")
		expect(plan({ tiles: 3, fixedGrid: false }).kind).toBe("grid")
	})
})

describe("planDirectScene — la présentation domine (D-05)", () => {
	it("un partage d'écran passe en grand, et TOUTES les caméras restent au bandeau", () => {
		// Le défaut : le partage REMPLAÇAIT la caméra du partageur dans sa case
		// (priorité 2 > 1). On perdait le visage de qui présente.
		const result = plan({ tiles: 2, hasPresentation: true, container: BUREAU })
		expect(result.kind).toBe("presentation")
		expect(result.bandTotal).toBe(2)
		expect(result.maxVisible).toBe(2)
	})

	it("au téléphone, le bandeau est en BAS ; couché, il passe à DROITE", () => {
		expect(
			plan({ tiles: 3, hasPresentation: true, container: TELEPHONE_PORTRAIT }).band,
		).toBe("bottom")
		expect(
			plan({ tiles: 3, hasPresentation: true, container: TELEPHONE_PAYSAGE }).band,
		).toBe("right")
		// Au bureau, la hauteur ne manque pas : le contenu garde toute la largeur.
		expect(plan({ tiles: 3, hasPresentation: true, container: BUREAU }).band).toBe(
			"bottom",
		)
	})

	it("un bandeau étroit ne rend pas huit vidéos de quarante pixels", () => {
		const result = plan({
			tiles: 8,
			hasPresentation: true,
			container: TRES_ETROIT,
		})
		expect(result.band).toBe("bottom")
		expect(result.bandTotal).toBe(8)
		// (320 − 16 + 6) / (72 + 6) = 3,97 ⇒ trois tuiles, le reste est résumé.
		expect(result.maxVisible).toBe(3)
		expect(result.maxVisible * DIRECT_SCENE_MIN_BAND_TILE).toBeLessThanOrEqual(
			TRES_ETROIT.width,
		)
		expect(result.columns).toBe(3)
		expect(result.rows).toBe(1)
	})

	it("couché, c'est la HAUTEUR qui borne la colonne de droite", () => {
		const result = plan({ tiles: 8, hasPresentation: true, container: TELEPHONE_PAYSAGE })
		expect(result.band).toBe("right")
		expect(result.columns).toBe(1)
		// (390 − 16 + 6) / 78 = 4,87 ⇒ quatre tuiles empilées.
		expect(result.rows).toBe(4)
		expect(result.maxVisible).toBe(4)
	})
})

describe("planDirectScene — la mise en avant LOCALE prime sur tout", () => {
	it("épingler quelqu'un pendant une présentation le met en grand", () => {
		const result = plan({
			tiles: 3,
			hasPresentation: true,
			pinnedKey: "track:direct-s_alice",
		})
		expect(result.kind).toBe("pinned")
		expect(result.focusKey).toBe("track:direct-s_alice")
		// La présentation ne disparaît pas : elle rejoint le bandeau.
		expect(result.bandTotal).toBe(3)
	})

	it("sans présentation, l'épinglé quitte le bandeau", () => {
		const result = plan({ tiles: 4, pinnedKey: "track:direct-s_bob" })
		expect(result.kind).toBe("pinned")
		expect(result.bandTotal).toBe(3)
	})

	it("le programme de l'hôte est suivi — sauf si ce lecteur a choisi", () => {
		expect(plan({ tiles: 4, programFocusKey: "track:direct-s_ministre" })).toMatchObject(
			{ kind: "pinned", focusKey: "track:direct-s_ministre" },
		)
		expect(
			plan({
				tiles: 4,
				programFocusKey: "track:direct-s_ministre",
				pinnedKey: "track:direct-s_moi",
			}).focusKey,
		).toBe("track:direct-s_moi")
	})

	it("une clé vide n'épingle personne", () => {
		expect(plan({ tiles: 4, pinnedKey: "" }).kind).toBe("grid")
		expect(plan({ tiles: 4, pinnedKey: null }).kind).toBe("grid")
	})

	it("épingler sans personne à l'écran ne fabrique pas une scène vide", () => {
		expect(plan({ tiles: 0, pinnedKey: "track:fantome" }).kind).toBe("solo")
	})
})


describe("orderDirectTiles", () => {
	const candidat = (
		key: string,
		kind: "track" | "roster",
		isHost = false,
	): DirectSceneCandidate => ({ key, kind, isHost, displayName: key })

	it("l'hôte d'abord, puis qui parle, puis les pistes, puis le roster", () => {
		const ordered = orderDirectTiles(
			[
				candidat("track:zoe", "track"),
				candidat("roster:claire", "roster"),
				candidat("track:bob", "track"),
				candidat("track:awa", "track", true),
			],
			{ activeSpeakerKey: "track:zoe" },
		)
		expect(ordered.map((tile) => tile.key)).toEqual([
			"track:awa",
			"track:zoe",
			"track:bob",
			"roster:claire",
		])
	})

	it("l'épinglé passe devant l'hôte lui-même", () => {
		const ordered = orderDirectTiles(
			[candidat("track:awa", "track", true), candidat("track:bob", "track")],
			{ pinnedKey: "track:bob" },
		)
		expect(ordered[0]?.key).toBe("track:bob")
	})

	it("un remaniement du SDK ne remanie pas la scène", () => {
		// Les pistes se départagent sur leur identité, pas sur l'ordre du tableau
		// que `useTracks` renvoie — celui-ci change à chaque abonnement.
		const a = candidat("track:direct-s_a", "track")
		const b = candidat("track:direct-s_b", "track")
		const c = candidat("track:direct-s_c", "track")
		expect(orderDirectTiles([c, a, b]).map((t) => t.key)).toEqual(
			orderDirectTiles([a, b, c]).map((t) => t.key),
		)
	})

	it("l'ordre du roster, lui, vient du serveur et se conserve", () => {
		const ordered = orderDirectTiles([
			candidat("roster:zoe", "roster"),
			candidat("roster:awa", "roster"),
		])
		expect(ordered.map((tile) => tile.key)).toEqual(["roster:zoe", "roster:awa"])
	})

	it("ne perd ni n'invente aucune tuile", () => {
		const entree = [
			candidat("track:b", "track"),
			candidat("roster:a", "roster"),
			candidat("track:a", "track", true),
		]
		expect(orderDirectTiles(entree)).toHaveLength(3)
		expect(orderDirectTiles([])).toEqual([])
	})
})


describe("planDirectScene — la vue ORATEUR met en grand la personne qui parle", () => {
	it("l'orateur connu domine, les autres vont au bandeau", () => {
		const result = planDirectScene({
			tiles: 4,
			emission: "computer",
			view: "speaker",
			activeSpeakerKey: "track:direct-s_bob",
		})
		expect(result.kind).toBe("speaker")
		expect(result.focusKey).toBe("track:direct-s_bob")
		expect(result.band).not.toBe("none")
		expect(result.bandTotal).toBe(3)
	})

	it("sans orateur connu, la scène ne nomme personne — le composant prend l'hôte", () => {
		const result = planDirectScene({ tiles: 3, emission: "computer", view: "speaker" })
		expect(result.kind).toBe("speaker")
		expect(result.focusKey).toBeNull()
		expect(result.bandTotal).toBe(2)
	})

	it("seul, il n'y a personne à mettre en bandeau : un solo", () => {
		expect(
			planDirectScene({ tiles: 1, emission: "computer", view: "speaker" }).kind,
		).toBe("solo")
		expect(
			planDirectScene({ tiles: 0, emission: "computer", view: "speaker" }).kind,
		).toBe("solo")
	})

	it("un partage d'écran ou une mise en avant priment sur la vue", () => {
		expect(
			planDirectScene({
				tiles: 3,
				emission: "computer",
				view: "speaker",
				hasPresentation: true,
				activeSpeakerKey: "track:direct-s_bob",
			}).kind,
		).toBe("presentation")
		expect(
			planDirectScene({
				tiles: 3,
				emission: "computer",
				view: "speaker",
				pinnedKey: "track:direct-s_alice",
				activeSpeakerKey: "track:direct-s_bob",
			}),
		).toMatchObject({ kind: "pinned", focusKey: "track:direct-s_alice" })
	})

	it("hors des vues orateur et cinéma, qui parle n'ordonne que les tuiles — la scène ne saute pas", () => {
		const auto = planDirectScene({
			tiles: 4,
			emission: "computer",
			activeSpeakerKey: "track:direct-s_bob",
		})
		expect(auto.kind).toBe("grid")
		expect(auto.focusKey).toBeNull()
	})
})

describe("planDirectScene — la vue GRILLE ne fait jamais de bandeau", () => {
	it("sept ou huit personnes se partagent la scène : quatre colonnes au large, deux à l'étroit", () => {
		const large = planDirectScene({
			tiles: 8,
			emission: "computer",
			view: "gallery",
			container: { width: 1280, height: 720 },
		})
		expect(large.kind).toBe("grid")
		expect(large.band).toBe("none")
		expect(large.maxVisible).toBe(8)
		expect(large.columns).toBe(4)
		expect(large.rows).toBe(2)

		const etroit = planDirectScene({
			tiles: 7,
			emission: "computer",
			view: "gallery",
			container: { width: 390, height: 844 },
		})
		expect(etroit.columns).toBe(2)
		expect(etroit.rows).toBe(4)
		expect(etroit.band).toBe("none")
	})

	it("en deçà, la grille suit les mêmes paliers que l'auto", () => {
		for (const tiles of [1, 2, 3, 4, 5, 6]) {
			const auto = planDirectScene({ tiles, emission: "computer" })
			const gallery = planDirectScene({ tiles, emission: "computer", view: "gallery" })
			expect(gallery).toEqual(auto)
		}
	})

	it("la grille fixe de l'hôte reste respectée en grille et en auto, remplacée en orateur et cinéma", () => {
		expect(
			planDirectScene({ tiles: 2, emission: "computer", view: "gallery", fixedGrid: true }).kind,
		).toBe("fixed")
		expect(
			planDirectScene({ tiles: 2, emission: "computer", view: "auto", fixedGrid: true }).kind,
		).toBe("fixed")
		expect(
			planDirectScene({ tiles: 2, emission: "computer", view: "speaker", fixedGrid: true }).kind,
		).toBe("speaker")
		expect(
			planDirectScene({ tiles: 2, emission: "computer", view: "cinema", fixedGrid: true }).kind,
		).toBe("cinema")
	})
})

describe("planDirectScene — la vue CINÉMA ne montre qu'une image, et COMPTE le reste", () => {
	it("l'orateur seul, les autres comptés", () => {
		const result = planDirectScene({
			tiles: 5,
			emission: "computer",
			view: "cinema",
			activeSpeakerKey: "track:direct-s_bob",
		})
		expect(result).toMatchObject({
			kind: "cinema",
			band: "none",
			maxVisible: 0,
			focusKey: "track:direct-s_bob",
			hidden: 4,
		})
	})

	it("une mise en avant reste seule aussi — sans bandeau", () => {
		const result = planDirectScene({
			tiles: 3,
			emission: "computer",
			view: "cinema",
			pinnedKey: "track:direct-s_alice",
			hasPresentation: true,
		})
		expect(result.kind).toBe("cinema")
		expect(result.focusKey).toBe("track:direct-s_alice")
		expect(result.band).toBe("none")
		// Deux autres personnes non rendues (le partage, lui, n'est pas une personne).
		expect(result.hidden).toBe(2)
	})

	it("un partage sans mise en avant est l'image — toutes les personnes sont comptées", () => {
		const result = planDirectScene({
			tiles: 3,
			emission: "computer",
			view: "cinema",
			hasPresentation: true,
		})
		expect(result.kind).toBe("cinema")
		expect(result.focusKey).toBeNull()
		expect(result.hidden).toBe(3)
	})

	it("seul, c'est un solo — rien à cacher", () => {
		const result = planDirectScene({ tiles: 1, emission: "computer", view: "cinema" })
		expect(result.kind).toBe("solo")
		expect(result.hidden).toBe(0)
	})


	it("`hidden` vaut zéro partout ailleurs", () => {
		for (const view of ["auto", "gallery", "speaker"] as const) {
			expect(planDirectScene({ tiles: 8, emission: "computer", view }).hidden).toBe(0)
		}
	})
})
