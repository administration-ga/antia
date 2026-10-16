// Dupliqué de socle/packages/agent-features/src/features/iappel/group-stage.ts @ ad2e7fdc2 — adaptations : raisons d'indisponibilité de poste retirées (« Hors horaires », « Injoignable en direct ») ; libellés traduits par i18n avec leurs pluriels (`t` ajouté en dernier paramètre de `participantStatusLabel`, `groupCallSubtitle` et `shortGroupLabel`, clés `iappel:groupStage.…`) ; titre d'un appel de groupe composé ICI (`composeGroupCallTitle`, depuis les parties `groupCallTitleParts` du contrat — le moteur ne compose plus de phrase) ; téléphone détaché au format unique du moteur (440 × 956) dans la documentation, comptes exemptés retirés des commentaires.
/**
 * group-stage — CE QUE LA GRILLE D'UN APPEL DE GROUPE MONTRE, ET COMMENT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN MODULE PUR PLUTÔT QUE DU CALCUL DANS LE COMPOSANT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `agent-features` tourne en environnement `node`, SANS testing-library : un
 * composant ne se monte pas ici (cf. CLAUDE.md). Toute décision laissée dans
 * le corps d'un JSX n'est vérifiable qu'à l'œil, sur un appel réel, à
 * plusieurs appareils. Or les décisions ci-dessous sont exactement celles qui
 * se ratent en silence :
 *
 *  · le NOMBRE DE COLONNES — une grille à colonnes fixes rend des vignettes
 *    de 40 px de haut à cinq personnes sur un téléphone ;
 *  · le LIBELLÉ D'ÉTAT — « a refusé » et « indisponible » se ressemblent, et
 *    les confondre accuse de rejet quelqu'un dont le téléphone était en
 *    silence ;
 *  · L'ORDRE — celui qui parle doit être devant, pas celui qui a raccroché.
 *
 * Aucun import React, aucun import LiveKit. Les libellés passent par la
 * fonction de traduction REÇUE (`t`, clés qualifiées `iappel:groupStage.…`).
 */

import { groupCallTitleParts } from "@antsia/social-contracts/callGroup"
import type { TFunction } from "i18next"

import type { CallParticipantState, CallParticipantView } from "./call-types"

/**
 * L'ordre d'affichage : ce qui est VIVANT d'abord.
 *
 * Un participant qui a quitté, refusé ou manqué l'appel garde sa place dans
 * la grille — le retirer ferait croire qu'il n'a jamais été convié, et
 * l'appelant perdrait la seule trace de « j'ai bien essayé de le joindre ».
 * Mais il passe DERRIÈRE : la place de devant revient à ceux avec qui l'on
 * parle.
 */
const STATE_RANK: Record<CallParticipantState, number> = {
	host: 0,
	connected: 1,
	ringing: 2,
	unavailable: 3,
	declined: 4,
	missed: 5,
	left: 6,
}

export function compareParticipants(
	a: CallParticipantView,
	b: CallParticipantView,
): number {
	// MOI en DERNIER, toujours — comme la case « Vous » de WhatsApp, en bas à
	// droite. Ma vignette est un retour de caméra, pas une information : elle
	// s'ancre, et ne bouge pas quand quelqu'un décroche ou s'en va. Avant cette
	// règle, l'hôte (moi, le plus souvent) ouvrait la grille et occupait par
	// défaut la scène du mode compact — on se regardait soi-même parler.
	if (a.isMe !== b.isMe) return a.isMe ? 1 : -1
	const rank = STATE_RANK[a.state] - STATE_RANK[b.state]
	if (rank !== 0) return rank
	// À égalité, l'ordre stable des noms : une grille qui se réordonne à
	// chaque battement de query donne le mal de mer.
	return (a.name ?? "").localeCompare(b.name ?? "")
}

/**
 * Ce qu'on écrit SOUS le nom d'un participant.
 *
 * `null` pour ceux qui sont là : leur présence se voit, l'écrire est du bruit.
 */
export function participantStatusLabel(
	participant: Pick<CallParticipantView, "state" | "reason">,
	t: TFunction,
): string | null {
	switch (participant.state) {
		case "host":
		case "connected":
			return null
		case "ringing":
			return t("iappel:groupStage.status.ringing")
		case "left":
			return t("iappel:groupStage.status.left")
		case "missed":
			return t("iappel:groupStage.status.missed")
		case "declined":
			// Un refus HUMAIN : quelqu'un a vu l'appel et l'a écarté.
			return t("iappel:groupStage.status.declined")
		case "unavailable":
			// Un refus AUTOMATIQUE : personne n'a rien vu passer. La nuance
			// n'est pas de politesse — elle dit à l'appelant s'il peut rappeler.
			switch (participant.reason) {
				case "busy":
					return t("iappel:groupStage.status.busy")
				case "in_meeting":
					return t("iappel:groupStage.status.inMeeting")
				// « Ne pas déranger », et — volontairement le même mot — « hors
				// de ses relations » : la grille d'un appel de groupe n'a pas à
				// révéler à tous les conviés qui est, ou n'est pas, une relation
				// de l'appelé.
				case "dnd":
				case "outside_relations":
				default:
					return t("iappel:groupStage.status.unavailable")
			}
	}
}

/** Une vignette est-elle « vivante » — quelqu'un avec qui l'on parle ? */
export function isLiveParticipant(
	participant: Pick<CallParticipantView, "state">,
): boolean {
	return participant.state === "host" || participant.state === "connected"
}

/**
 * La ligne TIENT-ELLE UN SIÈGE ? Vivant ou qui sonne — la même règle que le
 * plafond du serveur (`reservesSeat`, convex/modules/iappel/group.ts).
 *
 * ⚠️ À ne pas confondre avec une VIGNETTE : un refus, un départ, un appel
 * manqué gardent leur case (cf. `STATE_RANK`) mais libèrent leur siège. Un
 * appel à onze sièges peut donc montrer douze vignettes — un convié a refusé,
 * un remplaçant a été ajouté — et la lisibilité de la grille se juge sur les
 * sièges, pas sur l'historique.
 */
export function reservesGridSeat(
	participant: Pick<CallParticipantView, "state">,
): boolean {
	return (
		participant.state === "host" ||
		participant.state === "connected" ||
		participant.state === "ringing"
	)
}

export interface GroupGridLayout {
	/** Colonnes de la grille. */
	columns: number
	/**
	 * Proportion d'une vignette (largeur / hauteur) — sert au CHOIX des
	 * colonnes. En grille, la case ne l'impose plus : les vignettes remplissent
	 * la scène ligne par ligne (modèle WhatsApp), et la vidéo couvre la case.
	 */
	aspect: number
	/** Au-delà, les vignettes deviennent une bande compacte sous la scène. */
	compact: boolean
	/**
	 * Où va la commande « Ajouter » — TOUJOURS une barre sous la grille depuis
	 * ADR-0149 (2026-09-14).
	 *
	 * ⚠️ Elle a été une CELLULE de la grille tant que les vignettes étaient peu
	 * nombreuses. À onze personnes au téléphone, une cellule « Ajouter » vole la
	 * place d'un visage, et sa disparition au dernier siège (ligne T3) aurait
	 * rebattu toute la grille au moment précis où l'appel se remplit. Le champ
	 * reste, et son type avec : il est exporté par le barrel public.
	 */
	addTile: "cell" | "bar"
	/** Largeur d'une vignette dans la disposition retenue, en pixels. */
	tileWidth: number
	/**
	 * Hauteur d'une ligne de la grille, en pixels — celle que la feuille de
	 * style donne à chaque case (`--iappel-grid-rows`, lignes égales). Sans
	 * hauteur mesurée : déduite de la proportion.
	 */
	tileHeight: number
	/** Lignes de la grille (vignettes de personnes, barre exclue). */
	rows: number
	/**
	 * Vignettes de la PREMIÈRE ligne. Le reste de la division va en haut
	 * (modèle WhatsApp) : dix personnes sur trois colonnes ⇒ une case pleine
	 * largeur puis trois lignes de trois ; onze ⇒ deux demi-cases puis trois
	 * lignes de trois. Jamais une case vide en fin de grille.
	 */
	firstRowTiles: number
	/**
	 * Pistes de la grille CSS — `ppcm(columns, firstRowTiles)`. Trois colonnes
	 * et deux cases en tête ⇒ six pistes : chaque case ordinaire en prend deux,
	 * chaque case de tête trois. C'est ce qui rend une « demi-case » exprimable
	 * sans calcul de largeur fragile.
	 */
	tracks: number
	/**
	 * La PREMIÈRE vignette prend-elle toute la largeur ? Dérivé de
	 * `firstRowTiles` — gardé parce que la grille et le barrel le lisent.
	 */
	spanFirst: boolean
}

/** Marge intérieure de `.iappel-grid` — la feuille de style fait foi. */
const GRID_PAD = 10
/** Gouttière entre deux vignettes — idem. */
const GRID_GAP = 8
/**
 * Hauteur que la barre « Ajouter » (ou la ligne T3 qui la remplace) retire à
 * la grille : `.iappel-grid[data-add="bar"]` porte `padding-bottom: 64px` au
 * lieu des 10 px ordinaires. Une barre posée sans cette réserve recouvrirait
 * les noms de la dernière ligne.
 */
const ADD_BAR_RESERVE = 54
/**
 * Sous cette largeur, une vignette ne porte plus un visage ET son nom.
 *
 * 108 et non plus 120 (ADR-0149) : trois colonnes dans un téléphone étroit
 * (390 px) donnaient ~118 px par case, et en donnent ~134 dans le téléphone
 * iCom détaché du moteur (440 px) — une grille de onze reste donc une
 * grille ; dans la carte de rail (312 px), elles tombent à ~92 px, et la
 * scène + bande prend le relais d'elle-même, sans règle propre à la carte.
 */
export const MIN_TILE_WIDTH = 108
/**
 * Sous cette hauteur, une vignette n'est plus qu'une fente : l'avatar et la
 * ligne du nom (≈ 44 px de pied dégradé) ne tiennent plus ensemble. C'est la
 * carte moyenne très basse qui la rencontre — large, mais écrasée — et la
 * largeur seule ne l'aurait jamais vu.
 */
export const MIN_TILE_HEIGHT = 64
/** En bandeau, la vignette n'est plus qu'un repère : 96 px suffisent. */
export const MIN_STRIP_TILE_WIDTH = 96
/** Jamais plus de quatre colonnes : au-delà, la vignette est une fente. */
const MAX_COLUMNS = 4
/** Au téléphone, jamais plus de trois (fiche du 2026-09-14, §4). */
const MAX_COLUMNS_NARROW = 3
/** Au-delà de cette largeur, la surface est « large » (fenêtre agrandie, plein écran). */
const NARROW_SURFACE_MAX = 640
/**
 * PERSONNES qu'une grille garde lisibles — étroite, puis large.
 *
 * Onze au téléphone (6 jusqu'au 2026-09-14) : c'est le plafond d'un appel de
 * groupe (ADR-0149, onze dans le moteur). Au-delà, la grille passe en scène +
 * bande.
 *
 * ⚠️ Le plafond porte sur les SIÈGES tenus (`seats`), pas sur les lignes
 * d'historique : un refus libère un siège sans retirer sa vignette, et un
 * appel à onze sièges plus un refus basculait en scène au téléphone —
 * l'inverse de la fiche (« jamais compact au téléphone pour N ≤ 11 »).
 */
const MAX_GRID_TILES_NARROW = 11
const MAX_GRID_TILES_WIDE = 12

/** La proportion d'une vignette, inchangée depuis la première grille. */
function aspectFor(count: number, mobile: boolean): number {
	if (count === 1) return 3 / 4
	if (count === 2) return mobile ? 4 / 3 : 3 / 4
	return 1
}

/**
 * La grille, MESURÉE SUR SON CONTENEUR — plus sur le navigateur (IC-10).
 *
 * ⚠️ Le défaut corrigé ici : la disposition se décidait sur un booléen
 * d'ÉCRAN (`useIsReseauMobile`, une media query à 959 px) alors que la surface
 * réelle est une fenêtre de 400 px de large. Sur un grand écran, « desktop »
 * donnait donc quatre colonnes dans 400 px : 86 px par personne, marges
 * comprises. L'écran était large, la fenêtre ne l'était pas.
 *
 * DEUX règles mesurées, selon la LARGEUR de la surface (ADR-0149) :
 *
 *  · surface ÉTROITE (≤ 640 px — le téléphone iCom détaché à 440, la carte de
 *    rail à 312) : les colonnes sont FIXÉES par le nombre, comme au téléphone
 *    WhatsApp — une colonne à un ou deux, deux de trois à huit, trois de neuf
 *    à onze, jamais plus. Laisser l'algorithme « meilleure vignette » choisir
 *    donnait trois colonnes à cinq et deux à dix selon quelques pixels de
 *    hauteur : la grille changeait de forme quand quelqu'un décrochait ;
 *  · surface LARGE : parmi 1 à 4 colonnes, celle qui rend la vignette la PLUS
 *    GRANDE une fois la hauteur prise en compte (à égalité, le moins de
 *    colonnes : deux grandes vignettes valent mieux que quatre moyennes).
 *
 * Puis trois critères, tous nommés, font basculer en scène + bandeau :
 *
 *  · la vignette passe sous `MIN_TILE_WIDTH` (108) ;
 *  · la ligne passe sous `MIN_TILE_HEIGHT` (64) ;
 *  · le nombre de SIÈGES tenus (`seats`, pas les vignettes d'historique)
 *    dépasse ce qu'une grille garde lisible — onze sur une surface étroite (le
 *    plafond d'un appel), douze sur un plein écran.
 *
 * La commande « Ajouter » n'est plus jamais une cellule : elle ne compte pas
 * comme vignette, mais elle RÉSERVE sa hauteur (`hasAddTile`).
 *
 * ⚠️ L'ANCIENNE SIGNATURE `{ count, viewport }` RESTE ACCEPTÉE : elle est
 * exportée par le barrel public, et un appelant sans mesure (premier rendu,
 * avant le `ResizeObserver`) doit obtenir une disposition plausible plutôt
 * qu'un écran vide.
 */
export function planGroupGrid(input: {
	/** Vignettes de PERSONNES — la commande « Ajouter » ne s'y compte pas. */
	count: number
	/** Largeur mesurée du conteneur, en pixels. Absente ⇒ repli `viewport`. */
	width?: number | null
	/** Hauteur mesurée du conteneur, en pixels. */
	height?: number | null
	/**
	 * Une barre est-elle posée sous la grille — « Ajouter », ou la ligne T3
	 * qui la remplace au dernier siège ? Elle réserve sa hauteur.
	 */
	hasAddTile?: boolean
	/**
	 * Places RÉSERVÉES (hôte, en ligne, qui sonne — `reservesGridSeat`). C'est
	 * à elles que se compare le plafond de lisibilité ; absente ⇒ repli sur
	 * `count`. Les critères de largeur et de hauteur, eux, restent jugés sur
	 * les vignettes : une grille trop pleine d'historique bascule par la taille.
	 */
	seats?: number | null
	viewport?: "mobile" | "desktop"
}): GroupGridLayout {
	const count = Math.max(1, input.count)
	const width = typeof input.width === "number" && input.width > 0 ? input.width : null
	const mobile = width !== null ? width <= NARROW_SURFACE_MAX : input.viewport === "mobile"
	const aspect = aspectFor(count, mobile)

	if (width === null) {
		// ── Repli SANS mesure. Il ne vit que le premier rendu, mais ce rendu est
		// PEINT : `useStageSize` mesure dans un `useEffect`, donc après la
		// peinture. ⚠️ Au téléphone, il doit rendre la MÊME disposition que la
		// mesure, sinon la grille passe une image en scène + bande puis remonte
		// toutes ses vignettes (pistes vidéo détachées puis rattachées).
		const legacy = legacyGrid(count, mobile)
		return shapeLayout({
			count,
			columns: legacy.columns,
			aspect: legacy.aspect,
			compact: legacy.compact,
			tileWidth: 0,
			tileHeight: 0,
		})
	}

	const height =
		typeof input.height === "number" && input.height > 0 ? input.height : null
	// La hauteur UTILE : marges de la grille et réserve de la barre ôtées.
	const usable =
		height === null
			? null
			: height - 2 * GRID_PAD - (input.hasAddTile === true ? ADD_BAR_RESERVE : 0)
	const rowHeight = (rows: number): number =>
		usable === null ? Number.POSITIVE_INFINITY : (usable - GRID_GAP * (rows - 1)) / rows
	const widthFor = (columns: number): number =>
		(width - 2 * GRID_PAD - GRID_GAP * (columns - 1)) / columns

	let columns: number
	let tileWidth: number
	if (mobile) {
		columns = narrowColumns(count)
		tileWidth = widthFor(columns)
	} else {
		let best = { columns: 1, tileWidth: 0 }
		for (let candidate = 1; candidate <= Math.min(MAX_COLUMNS, count); candidate++) {
			const rows = Math.ceil(count / candidate)
			// La hauteur rogne la vignette autant que la largeur : trois colonnes
			// dans une fenêtre basse donnent des vignettes larges et écrasées.
			const size = Math.min(widthFor(candidate), rowHeight(rows) * aspect)
			// `+ 0.5` : à égalité (à un demi-pixel près), on garde MOINS de colonnes.
			if (size > best.tileWidth + 0.5) best = { columns: candidate, tileWidth: size }
		}
		columns = best.columns
		tileWidth = best.tileWidth
	}

	const rows = Math.ceil(count / columns)
	const tileHeight = usable === null ? tileWidth / aspect : rowHeight(rows)
	const maxTiles = mobile ? MAX_GRID_TILES_NARROW : MAX_GRID_TILES_WIDE
	const seatCount =
		typeof input.seats === "number" && input.seats > 0 ? input.seats : count
	const compact =
		tileWidth < MIN_TILE_WIDTH ||
		(usable !== null && tileHeight < MIN_TILE_HEIGHT) ||
		seatCount > maxTiles

	return shapeLayout({
		count,
		columns,
		aspect,
		compact,
		tileWidth: Math.max(0, Math.round(tileWidth * 100) / 100),
		tileHeight: Math.max(0, Math.round(tileHeight * 100) / 100),
	})
}

/**
 * Les colonnes au TÉLÉPHONE, par nombre de vignettes (fiche du 2026-09-14,
 * §4). À deux, on EMPILE : côte à côte sur 440 px, deux vignettes sont deux
 * fentes où l'on ne reconnaît personne.
 */
function narrowColumns(count: number): number {
	if (count <= 2) return 1
	if (count <= 8) return 2
	return MAX_COLUMNS_NARROW
}

/** Le plus grand commun diviseur — pour le ppcm des pistes. */
function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b)
}

/**
 * Lignes, première ligne, pistes — la forme de la grille une fois les
 * colonnes et le mode décidés. Une seule écriture pour le repli ET la mesure :
 * deux calculs de `spanFirst` auraient fini par diverger.
 *
 * Le reste de la division va sur la PREMIÈRE ligne (modèle WhatsApp) : trois
 * personnes sur deux colonnes ⇒ une case pleine largeur puis une paire ; onze
 * sur trois ⇒ deux demi-cases puis trois lignes de trois. Sans cela, une case
 * vide restait en bas à droite — et depuis que la grille remplit la scène, ce
 * vide serait aussi grand qu'un visage.
 */
function shapeLayout(input: {
	count: number
	columns: number
	aspect: number
	compact: boolean
	tileWidth: number
	tileHeight: number
}): GroupGridLayout {
	const columns = Math.max(1, input.columns)
	const firstRowTiles = input.compact ? columns : input.count % columns || columns
	return {
		columns,
		aspect: input.aspect,
		compact: input.compact,
		addTile: "bar",
		tileWidth: input.tileWidth,
		tileHeight: input.tileHeight,
		rows: Math.ceil(input.count / columns),
		firstRowTiles,
		tracks: (columns * firstRowTiles) / gcd(columns, firstRowTiles),
		spanFirst: !input.compact && columns > 1 && firstRowTiles === 1,
	}
}

/**
 * La taille de l'avatar d'une vignette SANS caméra, proportionnée à la case :
 * 56 px dans une case de 190 px se lisait comme une pastille perdue dans le
 * noir. Bornes : jamais moins de 40 px, jamais plus de 96 px (la scène). En
 * bandeau, la vignette n'est qu'un repère.
 *
 * Plancher 40 et non plus 44 (ADR-0149) : une case de onze dans un téléphone
 * étroit fait ~118 × 120, et 44 px d'avatar y chevauchaient le pied du nom.
 * La HAUTEUR,
 * quand elle est connue, borne aussi : une case large et basse (deux personnes
 * empilées dans une carte moyenne) aurait sinon un avatar plus haut que la
 * place laissée au-dessus du nom.
 *
 * ⚠️ En grille, l'avatar ne dispose PAS de toute la case : le corps réserve le
 * texte du pied (`TILE_FOOT_RESERVE_PX`, miroir du `padding-bottom` de
 * `globals.css`) et, sur la case de l'appelant, la puce « Appelant »
 * (`TILE_CALLER_RESERVE_PX`, miroir du `padding-top`). Revue du 14/09 : entre
 * 64 et ~77 px de haut, le plancher de 40 px débordait encore sur le nom, et la
 * puce couvrait un tiers du disque de l'appelant. Dans la place qui reste,
 * l'avatar descend jusqu'à `TILE_AVATAR_MIN_PX` — une case plus basse que
 * `MIN_TILE_HEIGHT` bascule déjà en scène + bande.
 */
export const TILE_FOOT_RESERVE_PX = 34
export const TILE_CALLER_RESERVE_PX = 24
export const TILE_AVATAR_MIN_PX = 24
/** Bordure haute + basse de la case (1 px chacune). */
const TILE_BORDER_PX = 2

export function avatarSizeFor(
	tileWidth: number,
	variant: "grid" | "stage" | "strip",
	tileHeight?: number,
	options?: { caller?: boolean },
): number {
	if (variant === "strip") return 32
	if (variant === "stage") return 96
	if (!(tileWidth > 0)) return 56
	const knownHeight = typeof tileHeight === "number" && tileHeight > 0
	const base = knownHeight ? Math.min(tileWidth, tileHeight) : tileWidth
	const size = Math.round(Math.min(96, Math.max(40, base * 0.36)))
	if (!knownHeight) return size
	const room =
		tileHeight -
		TILE_BORDER_PX -
		TILE_FOOT_RESERVE_PX -
		(options?.caller === true ? TILE_CALLER_RESERVE_PX : 0)
	if (room >= size) return size
	return Math.max(TILE_AVATAR_MIN_PX, Math.floor(room))
}

/** La disposition d'avant la mesure — conservée pour le repli. */
function legacyGrid(
	count: number,
	mobile: boolean,
): { columns: number; aspect: number; compact: boolean } {
	if (count === 1) return { columns: 1, aspect: 3 / 4, compact: false }
	if (mobile) {
		// La table du téléphone (fiche §4) : exactement celle de la mesure —
		// deux colonnes jusqu'à huit, trois jusqu'à onze, scène au-delà.
		if (count > MAX_GRID_TILES_NARROW) return { columns: 2, aspect: 1, compact: true }
		return { columns: narrowColumns(count), aspect: aspectFor(count, true), compact: false }
	}
	// Au bureau, la disposition d'avant IC-10 (le téléphone est traité plus
	// haut : à deux, il empile).
	if (count === 2) return { columns: 2, aspect: 3 / 4, compact: false }
	if (count <= 4) return { columns: 2, aspect: 1, compact: false }
	if (count <= 6) return { columns: 3, aspect: 1, compact: false }
	// Sept et plus : la grille ne tient plus, on bascule en scène + bandeau.
	return { columns: 4, aspect: 1, compact: true }
}

/**
 * La ligne d'état de l'en-tête : « 3 en ligne · 2 sonnent ».
 *
 * ⚠️ Ne JAMAIS rendre une phrase à trou. Un décompte partiel (« 0 en ligne »)
 * pendant que la query se charge dirait le contraire de la réalité : on rend
 * `null` tant qu'on ne sait rien, et l'en-tête montre alors le titre seul.
 */
export function groupCallSubtitle(
	input: {
		connected: number
		ringing: number
		unreachable: number
	},
	t: TFunction,
): string | null {
	const parts: string[] = []
	if (input.connected > 0) {
		parts.push(t("iappel:groupStage.subtitle.connected", { count: input.connected }))
	}
	if (input.ringing > 0) {
		parts.push(t("iappel:groupStage.subtitle.ringing", { count: input.ringing }))
	}
	if (parts.length === 0) {
		// Personne en ligne, rien qui sonne : l'appel est fini ou tout le monde
		// s'est éclipsé. Le dire vaut mieux qu'un blanc.
		if (input.unreachable > 0) return t("iappel:groupStage.subtitle.nobodyAnswered")
		return null
	}
	return parts.join(" · ")
}

/**
 * Le nom d'un appel de groupe pour la pilule réduite et les libellés courts.
 *
 * `title` porte déjà de quoi nommer l'appel (titre du fil, ou noms composés
 * par `composeGroupCallTitle`), mais il peut être long : la pilule fait
 * 200 px.
 */
export function shortGroupLabel(
	input: {
		title?: string | null
		memberCount?: number | null
	},
	t: TFunction,
): string {
	const title = input.title?.trim()
	if (title !== undefined && title.length > 0 && title.length <= 28) {
		return title
	}
	const count = input.memberCount ?? 0
	if (count > 0) return t("iappel:groupStage.shortLabel.withCount", { members: count })
	return t("iappel:groupStage.shortLabel.plain")
}

/**
 * Le titre d'un appel de groupe SANS fil, composé à partir des noms :
 * « Appel de groupe — A, B, C +2 ».
 *
 * Un appel lancé depuis un fil porte le titre du fil ; un appel sans fil n'a
 * rien, et « Appel de groupe » tout court ne dit pas à qui l'on parle — ni
 * dans l'écran, ni six mois plus tard dans le journal. Le moteur rend les
 * PARTIES (`groupCallTitleParts` : trois noms au plus, puis le nombre de ceux
 * qu'on tait — au-delà, le titre déborde de la pilule et du push) ; la phrase,
 * elle, se compose ici, dans la langue de l'écran.
 *
 * `total` : combien de personnes le titre désigne EN TOUT, quand les noms ne
 * sont qu'un aperçu (l'écran d'appel entrant n'en reçoit que quatre) ou que
 * certains n'ont pas de nom publié — le « +k » les compte quand même.
 */
export function composeGroupCallTitle(
	input: { names: readonly string[]; total?: number | null },
	t: TFunction,
): string {
	const { shown, more } = groupCallTitleParts(input.names)
	if (shown.length === 0) return t("iappel:groupStage.title.plain")
	const hidden = Math.max(more, (input.total ?? 0) - shown.length)
	const list = shown.join(", ")
	return hidden > 0
		? t("iappel:groupStage.title.namesMore", { names: list, more: hidden })
		: t("iappel:groupStage.title.names", { names: list })
}

/**
 * QUI OCCUPE LA SCÈNE quand la grille cède la place (IC-10).
 *
 * Le mode `compact` était spécifié en commentaire — « scène + bandeau » — et
 * n'existait nulle part : le composant rendait toutes les vignettes en grille,
 * simplement plus serrées. Décider qui passe en grand est la moitié manquante,
 * et c'est une règle, pas un hasard :
 *
 *  1. l'ÉPINGLE de l'utilisateur, si la personne est encore là — un choix
 *     explicite ne se fait jamais déloger par quelqu'un qui parle ;
 *  2. celui qui parle MAINTENANT ;
 *  3. le dernier à avoir parlé — sans lui, la scène redeviendrait vide à
 *     chaque silence, et l'image sauterait entre deux phrases ;
 *  4. le premier participant vivant, sinon le premier de la liste.
 */
export function pickStageIdentity(input: {
	/** Participants DÉJÀ triés (`compareParticipants`). */
	ordered: readonly (Pick<CallParticipantView, "userId" | "state"> & {
		isMe?: boolean
	})[]
	speaking?: ReadonlySet<string> | null
	pinned?: string | null
	lastSpeaker?: string | null
}): string | null {
	const identities = input.ordered.map((participant) => String(participant.userId))
	if (identities.length === 0) return null

	if (input.pinned != null && identities.includes(input.pinned)) {
		return input.pinned
	}
	// ⚠️ MOI, jamais en scène de mon propre chef : ma voix me mettait en grand
	// à chaque phrase, et l'écran montrait mon retour de caméra au lieu de ceux
	// à qui je parle. Seule l'ÉPINGLE (ci-dessus) peut m'y mettre. S'il n'y a
	// que moi, la scène me revient faute de mieux.
	const others = input.ordered.filter((participant) => participant.isMe !== true)
	const candidates = others.length > 0 ? others : input.ordered
	const candidateIds = candidates.map((participant) => String(participant.userId))
	const speaking = input.speaking
	if (speaking != null) {
		const active = candidateIds.find((identity) => speaking.has(identity))
		if (active !== undefined) return active
	}
	if (input.lastSpeaker != null && candidateIds.includes(input.lastSpeaker)) {
		return input.lastSpeaker
	}
	const live = candidates.find((participant) => isLiveParticipant(participant))
	return live !== undefined ? String(live.userId) : (candidateIds[0] ?? null)
}
