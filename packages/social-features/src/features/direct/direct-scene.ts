// Dupliqué de socle/packages/agent-features/src/features/direct/direct-scene.ts @ ad2e7fdc2 — adaptations : géométrie pure conservée ; nom accessible traduit par la scène, aucune phrase dans le domaine.
/**
 * direct-scene — CE QUE LA SCÈNE D'UN DIRECT MONTRE, ET COMMENT (D-04, D-05).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS NOTIONS QUE `direct-stage-format` CONFONDAIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · le FORMAT D'ÉMISSION (`stageFormat`) — le ratio de la SOURCE de l'hôte,
 *    choisi à la création et conservé toute la diffusion. Il dit la forme d'une
 *    image, jamais la taille du cadre ni le nombre de colonnes ;
 *  · la CAPACITÉ D'ANTENNE — huit, invariant SERVEUR (`DIRECT_MAX_SPEAKERS`).
 *    C'est un plafond de personnes autorisées à publier, pas une disposition ;
 *  · la DISPOSITION DU LECTEUR — combien de tuiles, en combien de colonnes,
 *    selon ce que le CONTENEUR mesure sur CET appareil.
 *
 * La scène dérivait la troisième des deux premières : elle remplissait toujours
 * huit cases et dimensionnait son cadre en `vh` selon le format d'émission
 * (`93.33vh`, `124.45vh`…). Conséquences constatées le 2026-09-06 : un direct à
 * deux personnes rendait six cases vides ; un document partagé occupait au plus
 * un huitième de l'écran ; et un direct filmé en vertical débordait de la
 * hauteur d'un bureau parce que la SESSION décidait de la taille du LECTEUR.
 *
 * Ici, la disposition se MESURE. Même doctrine que `iappel/group-stage.ts`
 * (`planGroupGrid`), dont les paliers sont repris : le module est PUR — aucun
 * import React, aucun import LiveKit — parce que ce sont exactement les
 * décisions qui se ratent en silence et qu'aucun typage n'attrape.
 */

import { emissionTileAspect } from "./direct-immersive"
import { DIRECT_STAGE_CAPACITY, type DirectStageFormat } from "./direct-stage-format"
import type { DirectSceneView } from "./direct-view"

/**
 * Ce que la scène montre.
 *
 *  · `solo` / `duo` / `grid` — des personnes, et rien d'autre ;
 *  · `presentation` — un CONTENU partagé domine (D-05) ;
 *  · `pinned` — quelqu'un a été mis en avant PAR CE LECTEUR (préférence
 *    locale, jamais envoyée au serveur) — ou par l'HÔTE pour tous
 *    (`programFocusKey`, le spotlight de `sessions.setSpotlight`) ;
 *  · `fixed` — la grille de huit places, demandée explicitement par l'hôte ;
 *  · `speaker` — la vue « Orateur » (2026-09-14) : la personne qui PARLE en
 *    grand, les autres en bandeau — c'est le dessin des directs grand public
 *    que le propriétaire cite en modèle ;
 *  · `cinema` — la vue « Cinéma » : UNE image, sans bandeau ; les autres sont
 *    comptés (`hidden`), jamais escamotés en silence.
 */
export type DirectSceneKind =
	| "solo"
	| "duo"
	| "grid"
	| "presentation"
	| "pinned"
	| "fixed"
	| "speaker"
	| "cinema"

/** Où se posent les tuiles secondaires quand une image domine. */
export type DirectSceneBand = "none" | "bottom" | "right"

export interface DirectScenePlan {
	kind: DirectSceneKind
	/**
	 * Colonnes et lignes de la GRILLE DE TUILES DE PERSONNES.
	 *
	 * ⚠️ Quand `band !== "none"`, ces tuiles SONT le bandeau : le contenu
	 * dominant n'est pas une cellule de cette grille, il a sa propre zone.
	 */
	columns: number
	rows: number
	/** Proportion largeur/hauteur d'une tuile — celle de la SOURCE émise. */
	tileAspect: number
	band: DirectSceneBand
	/** Cellules réellement rendues (places libres comprises en `fixed`). */
	maxVisible: number
	/** Cellules que le bandeau porterait s'il avait toute la place. `0` sans bandeau. */
	bandTotal: number
	/** Tuiles de personnes soumises, bornées à la capacité d'antenne. */
	tiles: number
	/**
	 * La tuile mise en avant, quand c'est une PERSONNE nommée.
	 *
	 * ⚠️ `null` ne veut pas dire « rien ne domine » : en `presentation` c'est le
	 * partage d'écran, et en `grid` à bandeau (comme en `speaker` ou `cinema`
	 * sans orateur connu) c'est la PREMIÈRE tuile ordonnée. Le module ne
	 * connaît que des nombres — nommer ces deux-là revient au composant, seul
	 * à tenir la liste.
	 */
	focusKey: string | null
	/**
	 * Personnes NON rendues par choix de vue (`cinema`) — pour que l'écran les
	 * COMPTE (« +3 »). `0` partout ailleurs : un bandeau qui déborde se résume
	 * par `maxVisible`, pas par ce champ.
	 */
	hidden: number
}

export interface DirectScenePlanInput {
	/** Nombre de PERSONNES (identités dédupliquées), pas de pistes. */
	tiles: number
	/** Un partage d'écran est-il diffusé ? Au plus un est rendu. */
	hasPresentation?: boolean
	/** Mise en avant LOCALE — la préférence de ce lecteur, et elle prime. */
	pinnedKey?: string | null
	/**
	 * Ce que l'HÔTE met en avant pour tous — le spotlight
	 * (`direct_sessions.spotlightUserId`, servi par `sessions.get.spotlight`).
	 * L'ordre de priorité est écrit et testé une fois pour toutes :
	 * local > programme > partage > vue > automatique.
	 */
	programFocusKey?: string | null
	/**
	 * La personne qui PARLE (identité du SFU, `useSpeakingParticipants`). Ne
	 * décide qu'en vue `speaker` ou `cinema` — ailleurs, elle ordonne les
	 * tuiles (`orderDirectTiles`) sans jamais déplacer la scène : une grille
	 * qui saute à chaque prise de parole ne se regarde pas.
	 */
	activeSpeakerKey?: string | null
	/**
	 * La VUE demandée par ce lecteur (`direct-view.ts`). `auto` (défaut) est
	 * la scène mesurée ; les trois autres sont des dispositions choisies, qui
	 * s'effacent toujours devant un contenu (partage, mise en avant).
	 */
	view?: DirectSceneView
	/** Le conteneur MESURÉ. `null` (rendu serveur, avant mesure) est admis. */
	container?: { width: number; height: number } | null
	emission: DirectStageFormat
	/** La grille de huit places, demandée explicitement à la création. */
	fixedGrid?: boolean
}

/**
 * Sous cette largeur de tuile, un visage n'est plus qu'un repère : c'est le
 * plancher d'un bandeau, et ce qui décide combien il en montre.
 */
export const DIRECT_SCENE_MIN_BAND_TILE = 72
/** Gouttière du bandeau — la feuille de style fait foi. */
const BAND_GAP = 6
/** Marge intérieure de la scène — idem. */
const SCENE_PAD = 8
/**
 * Sous cette largeur, le conteneur est ÉTROIT : c'est un téléphone, ou une
 * colonne de studio, et trois colonnes y donneraient des fentes.
 */
export const DIRECT_SCENE_NARROW_MAX = 640
/** Sous cette largeur, la grille fixe se retourne (2 colonnes × 4 lignes). */
export const DIRECT_SCENE_FIXED_NARROW_MAX = 480
/**
 * Sous cette hauteur, le conteneur est BAS (téléphone en paysage, fenêtre
 * écrasée) : un bandeau horizontal y mangerait la seule chose qui manque.
 */
const SHORT_CONTAINER_MAX_HEIGHT = 480
/** Un bandeau vertical ne se prend que si la largeur peut se le permettre. */
const RIGHT_BAND_MIN_WIDTH = 560

/**
 * Où poser le bandeau : LÀ OÙ LE CONTENEUR A DE LA PLACE À PERDRE.
 *
 * ⚠️ Ce n'est PAS « portrait ⇒ bas, paysage ⇒ droite », qui se trompe sur un
 * bureau : à 1280×720 (paysage) une colonne de droite vole 200 px au document
 * partagé, alors que la hauteur, elle, ne manque pas. La règle porte donc sur
 * la grandeur RARE :
 *
 *  · conteneur BAS (844×390, un téléphone couché) — la hauteur est la
 *    ressource rare, le bandeau part à DROITE ;
 *  · partout ailleurs (390×844, 1280×720) — la largeur sert le contenu, le
 *    bandeau part EN BAS.
 */
function bandSideFor(container: { width: number; height: number } | null): DirectSceneBand {
	if (container === null) return "bottom"
	return container.height < SHORT_CONTAINER_MAX_HEIGHT &&
		container.width >= RIGHT_BAND_MIN_WIDTH
		? "right"
		: "bottom"
}

/** Combien de tuiles de `DIRECT_SCENE_MIN_BAND_TILE` px tiennent dans `available`. */
function bandCapacity(available: number): number {
	if (!Number.isFinite(available) || available <= 0) return DIRECT_STAGE_CAPACITY
	return Math.max(
		1,
		Math.floor((available - 2 * SCENE_PAD + BAND_GAP) / (DIRECT_SCENE_MIN_BAND_TILE + BAND_GAP)),
	)
}

function normalizeContainer(
	container: DirectScenePlanInput["container"],
): { width: number; height: number } | null {
	if (container == null) return null
	const { width, height } = container
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null
	if (width <= 0 || height <= 0) return null
	return { width, height }
}

/**
 * LA DISPOSITION DE LA SCÈNE, mesurée sur son conteneur.
 *
 * Ordre de décision, et il est le cœur du lot :
 *
 *  1. la mise en avant LOCALE — un choix explicite ne se fait jamais déloger,
 *     pas même par un partage d'écran qui démarre (`pinned`) ;
 *  2. le programme de l'HÔTE, s'il existe un jour (même géométrie) ;
 *  3. un PARTAGE D'ÉCRAN — il domine, et la caméra du partageur RESTE dans le
 *     bandeau (`presentation`) ;
 *  4. la grille fixe demandée à la création (`fixed`) ;
 *  5. sinon, les paliers mesurés : 1 solo · 2 duo · 3-4 deux colonnes ·
 *     5-6 trois colonnes au large, deux à l'étroit · 7-8 scène + bandeau.
 *
 * ⚠️ La grille fixe passe APRÈS la présentation, et c'est délibéré : elle
 * décrit la disposition des PERSONNES. Lui laisser la main sur un document
 * partagé remettrait ce document dans un huitième d'écran — le défaut D-05
 * exactement, rentré par la porte de derrière.
 */
export function planDirectScene(input: DirectScenePlanInput): DirectScenePlan {
	const tiles = Math.max(0, Math.min(Math.floor(input.tiles), DIRECT_STAGE_CAPACITY))
	const container = normalizeContainer(input.container)
	const tileAspect = emissionTileAspect(input.emission)
	// Largeur INCONNUE ⇒ on suppose LARGE, comme `resolveDirectLayout` suppose
	// la page : se tromper vers le large montre plus de monde, se tromper vers
	// l'étroit cache des gens le temps que la mesure arrive.
	const narrow = container !== null && container.width <= DIRECT_SCENE_NARROW_MAX
	const hasPresentation = input.hasPresentation === true
	const view: DirectSceneView = input.view ?? "auto"
	const nonEmpty = (key: string | null | undefined): string | null =>
		key != null && key.length > 0 ? key : null
	const focusKey = nonEmpty(input.pinnedKey) ?? nonEmpty(input.programFocusKey)
	const speakerKey = nonEmpty(input.activeSpeakerKey)

	const base = {
		tileAspect,
		tiles,
		focusKey: null as string | null,
		hidden: 0,
	}

	/** Une scène à bandeau : contenu dominant + tuiles secondaires. */
	const banded = (
		kind: DirectSceneKind,
		bandTotal: number,
		key: string | null,
	): DirectScenePlan => {
		const band = bandSideFor(container)
		const available =
			container === null
				? Number.POSITIVE_INFINITY
				: band === "bottom"
					? container.width
					: container.height
		const total = Math.max(0, bandTotal)
		const maxVisible = Math.min(total, bandCapacity(available))
		return {
			...base,
			kind,
			band,
			bandTotal: total,
			maxVisible,
			columns: band === "bottom" ? Math.max(1, maxVisible) : 1,
			rows: band === "bottom" ? 1 : Math.max(1, maxVisible),
			focusKey: key,
		}
	}

	/**
	 * La vue CINÉMA : une image, et rien d'autre. `hidden` compte ce qui
	 * n'est pas rendu — le composant le dit en « +n ». Avec une clé, c'est
	 * une personne ; sans clé et avec partage, c'est le partage ; sans rien,
	 * la première tuile ordonnée (l'hôte).
	 */
	const cinema = (key: string | null): DirectScenePlan => {
		const showsPresentation = key === null && hasPresentation
		const hidden = showsPresentation ? tiles : Math.max(0, tiles - 1)
		return {
			...base,
			kind: "cinema",
			band: "none",
			bandTotal: 0,
			maxVisible: 0,
			columns: 1,
			rows: 1,
			focusKey: key,
			hidden,
		}
	}

	/**
	 * Une grille de PERSONNES, sans bandeau — solo, duo, puis colonnes. Un
	 * solo VIDE (personne n'a encore publié) garde une case : c'est là que le
	 * composant pose son attente.
	 */
	const grid = (kind: "grid" | "solo" | "duo", columns: number): DirectScenePlan => ({
		...base,
		kind,
		band: "none",
		bandTotal: 0,
		maxVisible: kind === "solo" ? 1 : tiles,
		columns,
		rows: Math.max(1, Math.ceil(Math.max(1, tiles) / columns)),
	})

	// 1 & 2 — la mise en avant, locale d'abord. Le partage d'écran ne disparaît
	// pas pour autant : il rejoint le bandeau, où il reste consultable. En
	// cinéma, il n'y a pas de bandeau : la personne mise en avant est SEULE.
	if (focusKey !== null && tiles > 0) {
		if (view === "cinema") return cinema(focusKey)
		return banded("pinned", Math.max(0, tiles - 1) + (hasPresentation ? 1 : 0), focusKey)
	}

	// 3 — le contenu partagé domine, et TOUTES les caméras restent au bandeau,
	// celle du partageur comprise : elle n'est plus REMPLACÉE par son écran.
	if (hasPresentation) {
		if (view === "cinema") return cinema(null)
		return banded("presentation", tiles, null)
	}

	// 4 — la grille de huit places, parce qu'on l'a demandée. Elle décrit la
	// disposition des PERSONNES : une vue qui en choisit une seule (orateur,
	// cinéma) la remplace ; la grille et l'auto la respectent.
	if (input.fixedGrid === true && (view === "auto" || view === "gallery")) {
		const columns = container !== null && container.width <= DIRECT_SCENE_FIXED_NARROW_MAX ? 2 : 4
		return {
			...base,
			kind: "fixed",
			band: "none",
			bandTotal: 0,
			maxVisible: DIRECT_STAGE_CAPACITY,
			columns,
			rows: Math.ceil(DIRECT_STAGE_CAPACITY / columns),
		}
	}

	// 5 — les VUES choisies. Zéro ou une tuile : il n'y a rien à disposer, la
	// scène est un solo quelle que soit la vue demandée.
	if (view === "cinema") {
		return tiles <= 1 ? grid("solo", 1) : cinema(speakerKey)
	}
	if (view === "speaker") {
		if (tiles <= 1) return grid("solo", 1)
		return banded("speaker", tiles - 1, speakerKey)
	}
	if (view === "gallery" && tiles > 6) {
		// Jamais de bandeau en grille : sept ou huit personnes se partagent la
		// scène en quatre colonnes au large, deux à l'étroit.
		return grid("grid", narrow ? 2 : 4)
	}

	// 6 — les paliers. Zéro tuile reste une scène valide (personne n'a encore
	// publié) : une case, et le composant y met son attente.
	if (tiles <= 1) return grid("solo", 1)
	if (tiles === 2) {
		// Côte à côte quand le conteneur est au moins aussi large que haut ;
		// empilées sinon — deux fentes verticales ne montrent aucun visage.
		const sideBySide = container === null || container.width / container.height >= 1
		return {
			...base,
			kind: "duo",
			band: "none",
			bandTotal: 0,
			maxVisible: 2,
			columns: sideBySide ? 2 : 1,
			rows: sideBySide ? 1 : 2,
		}
	}
	if (tiles <= 4) return grid("grid", 2)
	if (tiles <= 6) return grid("grid", narrow ? 2 : 3)
	// 7-8 : la grille ne tient plus. Une image passe en grand, les autres en
	// bandeau — c'est le `compact` de `planGroupGrid`, sous un autre nom.
	return banded("grid", tiles - 1, null)
}

/** Une tuile candidate, telle que le composant la connaît après dédoublonnage. */
export interface DirectSceneCandidate {
	key: string
	/** `track` : une piste réellement connectée. `roster` : une place attribuée. */
	kind: "track" | "roster"
	isHost: boolean
	displayName: string
}

/**
 * L'ORDRE des tuiles : l'hôte, celui qui parle, les pistes, puis les places
 * attribuées mais pas encore rejointes.
 *
 * ⚠️ DEUX RÈGLES DE DÉPARTAGE, et ce n'est pas une hésitation.
 *
 * L'ordre du roster vient du SERVEUR et veut dire quelque chose (l'hôte, puis
 * l'ordre d'invitation) : on le garde tel quel. L'ordre des PISTES, lui, vient
 * du SDK et change à chaque abonnement, chaque republication, chaque
 * reconnexion — le suivre ferait sauter les tuiles pendant la conférence. Les
 * pistes se départagent donc sur leur identité, qui, elle, ne bouge pas.
 *
 * C'est ce qui rend `useSortedParticipants`/`useVisualStableUpdate` inutiles
 * ici : la stabilité est une propriété de cette fonction, testable en `node`,
 * plutôt qu'un effet de bord d'un hook qu'aucun test ne peut atteindre.
 */
export function orderDirectTiles<T extends DirectSceneCandidate>(
	candidates: readonly T[],
	options?: { activeSpeakerKey?: string | null; pinnedKey?: string | null },
): T[] {
	const pinnedKey = options?.pinnedKey ?? null
	const activeSpeakerKey = options?.activeSpeakerKey ?? null

	const rankOf = (candidate: T): number => {
		if (pinnedKey !== null && candidate.key === pinnedKey) return 0
		if (candidate.isHost) return 1
		if (activeSpeakerKey !== null && candidate.key === activeSpeakerKey) return 2
		return candidate.kind === "track" ? 3 : 4
	}

	return candidates
		.map((candidate, index) => ({ candidate, index, rank: rankOf(candidate) }))
		.sort((a, b) => {
			if (a.rank !== b.rank) return a.rank - b.rank
			if (a.candidate.kind === "track" && b.candidate.kind === "track") {
				return a.candidate.key.localeCompare(b.candidate.key)
			}
			return a.index - b.index
		})
		.map((entry) => entry.candidate)
}
