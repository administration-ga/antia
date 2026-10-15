// Dupliqué de socle/packages/agent-features/src/features/iappel/call-controls.ts @ ad2e7fdc2 — adaptations : libellés de qualité traduits par i18n (`t` ajouté en dernier paramètre de `qualityLabel`, clés `iappel:callControls.quality.…`) ; accès indexé gardé (`noUncheckedIndexedAccess`) dans `nextCameraDevice` ; refus serveur de l'attente d'un appel de groupe nommé par sa règle du moteur (`CALL_GROUP_NO_HOLD`).
/**
 * call-controls — quelles commandes l'écran d'appel affiche, et lesquelles il
 * MASQUE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA DOCTRINE : UNE COMMANDE INDISPONIBLE SE MASQUE, ELLE NE SE REND JAMAIS
 * INERTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'écran d'appel affichait un bouton « Haut-parleur » désactivé EN DUR, qui
 * ne réagissait à aucun clic. Un bouton grisé qui ne fait rien ne se lit pas
 * comme « pas encore disponible » : il se lit comme une panne — l'utilisateur
 * clique, rien ne se passe, il conclut que l'appel est cassé.
 *
 * La bonne réponse n'est donc jamais de DÉSACTIVER un contrôle : c'est de
 * décider s'il a sa place à l'écran DU TOUT. Ce module centralise ces
 * décisions pour que l'écran n'ait plus qu'à lire un booléen par commande et
 * choisir entre « je rends le bouton » et « je ne le rends pas ».
 *
 * Chaque règle est justifiée en commentaire à côté d'elle : ce ne sont pas des
 * seuils arbitraires, mais des réponses à « qu'est-ce que l'utilisateur
 * comprendrait s'il cliquait maintenant ? ».
 *
 * ⚠️ AMENDEMENT DU 2026-09-22 — une commande que tout le monde cherche au
 * téléphone se rend INDISPONIBLE AVEC SA RAISON, jamais muette. Masquer reste
 * la règle quand la commande n'a rien à piloter (une seule sortie audio, une
 * seule caméra) ; mais « Haut-parleur » sur un iPhone n'est pas une commande
 * sans objet : c'est une commande que le WEB ne sait pas honorer. La masquer
 * envoie chercher une panne, la rendre inerte aussi. Elle s'affiche donc,
 * `aria-disabled`, et DIT où le réglage se trouve vraiment (Centre de
 * contrôle). La forme du refus vit dans `audio-route.ts` (`planSpeakerControl`,
 * palier `unavailable`) ; ici, on décide seulement que la commande EXISTE.
 *
 * Aucun import LiveKit ni React : module pur, testable en environnement
 * `node`.
 */

import type { TFunction } from "i18next"

import type { CallPhase } from "./call-types"

/** Ce que l'écran connaît au moment de décider quoi montrer. */
export interface CallControlsInput {
	phase: CallPhase
	isMobile: boolean
	/** Nombre d'entrées vidéo détectées (caméras). */
	videoInputs: number
	/** Nombre de sorties audio détectées (haut-parleurs, casques…). */
	audioOutputs: number
	/** Le navigateur sait-il router l'audio vers un périphérique choisi ? */
	supportsSetSinkId: boolean
	/**
	 * L'appareil. Optionnel — absent vaut BUREAU, le cas de toutes les
	 * surfaces antérieures à ce champ (et de leurs tests).
	 */
	platform?: "ios" | "android" | "desktop"
	/**
	 * L'appel est-il un appel de GROUPE ? Optionnel — absent vaut 1:1, le cas
	 * de loin le plus courant et celui de toutes les surfaces antérieures.
	 *
	 * Il ne décide que de l'attente : un appel de groupe ne se parque pas
	 * (le serveur le refuse, règle `CALL_GROUP_NO_HOLD`, et « mettre en
	 * attente » n'a pas de sens à N — on quitte, ou on coupe son micro).
	 */
	isGroup?: boolean
}

/**
 * ⚠️ Cette entrée ne porte NI `mediaType` NI `isConnected`, et c'est délibéré.
 * Les deux avaient été prévus, aucun n'était lu : `phase` dit déjà si la
 * connexion est établie (`active`/`held`/`reconnecting`), et le média demandé
 * ne décide de rien ici — on peut allumer sa caméra au milieu d'un appel
 * audio, c'est même le geste le plus courant. Un champ que personne ne
 * consomme finit par être renseigné de travers puis lu comme s'il disait la
 * vérité ; on ne le garde pas « au cas où ».
 */

/** Une commande par clé — `true` si elle a sa place à l'écran. */
export interface CallControlsAvailability {
	mic: boolean
	camera: boolean
	/** Basculer caméra avant / arrière. */
	flip: boolean
	/** Choisir le périphérique de sortie audio. */
	speaker: boolean
	/** Mettre l'appel en attente. */
	hold: boolean
	/**
	 * REPRENDRE un appel parqué.
	 *
	 * ⚠️ Son absence était le second verrou du multi-appels. `hold` était
	 * calculé ici et lu NULLE PART dans l'écran, et rien n'existait pour
	 * reprendre : un appel mis en attente — même le seul — n'avait aucune
	 * sortie. On pouvait parquer, jamais revenir.
	 */
	resume: boolean
	minimize: boolean
	/**
	 * AJOUTER une personne à l'appel (escalade 1:1 → groupe, ADR-0099).
	 *
	 * La surface v2 n'offrait AUCUN bouton d'ajout — le geste n'existait que
	 * dans la file d'organisation et à la voix, branchés sur une mutation qui
	 * ne faisait pas sonner. Offert sur un appel VIVANT : en conversation, en
	 * sonnerie sortante (escalade immédiate), ou en reconnexion — jamais sur
	 * un appel parqué (on reprend d'abord), terminé ou échoué.
	 */
	addParticipant: boolean
}

/**
 * La règle « haut-parleur », isolée pour être réutilisable ailleurs qu'à
 * l'écran d'appel (un panneau de réglages, par exemple, qui voudrait savoir
 * s'il vaut la peine de proposer le choix sans reconstruire tout
 * `CallControlsInput`).
 */
export function speakerControlAvailable(input: {
	supportsSetSinkId: boolean
	audioOutputs: number
	platform?: "ios" | "android" | "desktop"
}): boolean {
	// AU TÉLÉPHONE, la commande existe TOUJOURS : c'est la première qu'on
	// cherche en décrochant, et son absence se lit comme une régression de
	// l'application. Son ÉTAT dit si elle route (bascule réelle sur les
	// Android à deux sorties) ou non (`unavailable` + raison, cf.
	// `planSpeakerControl`). Ce qui serait malhonnête, ce serait de la rendre
	// inerte sans un mot — pas de l'afficher.
	if (input.platform === "ios" || input.platform === "android") return true
	// AU BUREAU, rien ne change : `setSinkId` absent (Safari) = impossible de
	// router, quel que soit le nombre de périphériques ; une seule sortie =
	// rien à choisir, même quand `setSinkId` existe.
	return input.supportsSetSinkId && input.audioOutputs >= 2
}

export function availableCallControls(input: CallControlsInput): CallControlsAvailability {
	// Avant que l'appel soit établi (sonnerie, connexion en cours), le flux
	// média local n'existe pas encore côté LiveKit : un bouton micro qui
	// « coupe » un flux inexistant laisserait croire que le micro est déjà
	// muet à l'arrivée de l'appel. `reconnecting` reste un état ACTIF (cf.
	// `CallPhase`) : la conversation continue, ou peut reprendre dès le retour
	// du réseau — le micro et la caméra restent donc pilotables. `peer_held`
	// aussi : le correspondant m'a suspendu, mais c'est MON micro et MA caméra
	// — je les règle pendant que je patiente, et ils seront dans l'état voulu
	// à la reprise.
	const inLiveMedia =
		input.phase === "active" ||
		input.phase === "held" ||
		input.phase === "peer_held" ||
		input.phase === "reconnecting"

	return {
		mic: inLiveMedia,
		camera: inLiveMedia,
		// Basculer avant/arrière n'a de sens qu'au téléphone — un ordinateur
		// n'a quasiment jamais de caméra arrière — et seulement s'il y a
		// vraiment un second choix à proposer.
		flip: input.isMobile && input.videoInputs >= 2,
		speaker: speakerControlAvailable(input),
		// « Mettre en attente » ne se propose qu'à un appel EN COURS : avant,
		// il n'y a rien à suspendre ; un appel déjà `held` ne se remet pas en
		// attente une seconde fois (la commande pour REPRENDRE vit ailleurs) ;
		// un appel de GROUPE ne se parque pas du tout — le serveur le refuse,
		// et l'offrir donnerait un bouton qui lève.
		// L'appel que le correspondant a parqué (`peer_held`) se parque AUSSI
		// de mon côté — pour prendre un autre appel pendant que je patiente :
		// le serveur tient l'attente croisée (`heldBy`), la ligne revient quand
		// le DERNIER reprend. Les deux rangées ont ainsi la même forme :
		// « Reprendre » chez celui qui parque, « En attente » chez l'autre
		// (recette du 22/09).
		hold:
			(input.phase === "active" || input.phase === "peer_held") &&
			input.isGroup !== true,
		// Exactement le miroir : un appel parqué PAR MOI se reprend, et lui
		// seul. En `peer_held`, la reprise appartient au correspondant : la
		// proposer laisserait croire qu'on peut revenir dans une conversation
		// que l'autre a suspendue. Les deux commandes restent mutuellement
		// exclusives par construction.
		resume: input.phase === "held",
		// Réduire la fenêtre d'appel reste utile tant que l'appel occupe
		// l'écran. Une fois `ended`/`failed`, l'écran de fin se referme de
		// lui-même : réduire mènerait vers un écran qui n'existe déjà plus.
		minimize: input.phase !== "ended" && input.phase !== "failed",
		addParticipant:
			input.phase === "active" ||
			input.phase === "ringing" ||
			input.phase === "reconnecting",
	}
}

/** Les cinq niveaux de qualité que le serveur ou LiveKit peuvent signaler. */
export type ConnectionQualityLevel = "excellent" | "good" | "poor" | "lost" | "unknown"

/**
 * Ce que chaque niveau affiche. `degraded` ne choisit pas le TEXTE : il
 * décide si l'indicateur s'affiche DU TOUT. Une pastille verte affichée en
 * permanence n'informe de rien et finit ignorée — on ne montre que ce qui
 * doit inquiéter (`poor`, `lost`), jamais une confirmation que tout va bien.
 */
const QUALITY_LABELS: Record<
	ConnectionQualityLevel,
	{ bars: 0 | 1 | 2 | 3; textKey: string; degraded: boolean }
> = {
	excellent: { bars: 3, textKey: "iappel:callControls.quality.excellent", degraded: false },
	good: { bars: 2, textKey: "iappel:callControls.quality.good", degraded: false },
	poor: { bars: 1, textKey: "iappel:callControls.quality.poor", degraded: true },
	lost: { bars: 0, textKey: "iappel:callControls.quality.lost", degraded: true },
	// Absence de mesure ≠ mauvaise mesure : `unknown` ne doit pas alarmer.
	unknown: { bars: 0, textKey: "iappel:callControls.quality.unknown", degraded: false },
}

export function qualityLabel(
	level: ConnectionQualityLevel,
	t: TFunction,
): { bars: 0 | 1 | 2 | 3; text: string; degraded: boolean } {
	const { bars, textKey, degraded } = QUALITY_LABELS[level]
	return { bars, text: t(textKey), degraded }
}

const ENVIRONMENT_LABEL_HINTS = ["back", "rear", "arriere", "environment"]
const USER_LABEL_HINTS = ["front", "avant", "face", "user"]

/**
 * Retire les accents et met en minuscule, pour comparer des libellés de
 * périphériques qui varient selon le système et la langue de l'OS
 * (« Caméra arrière » vs « Back Camera » vs « CAMERA ARRIERE »).
 */
function normalizeDeviceLabel(label: string): string {
	return label
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
}

/** Le libellé désigne-t-il la direction demandée ? */
function labelMatchesDirection(label: string, wanted: "user" | "environment"): boolean {
	const normalized = normalizeDeviceLabel(label)
	// Un libellé vide (permission caméra pas encore accordée par le
	// navigateur) ne « correspond » à rien : c'est ce qui déclenche le repli
	// par cyclage plus bas, pas un faux « aucune direction ».
	if (normalized.length === 0) return false
	const hints = wanted === "environment" ? ENVIRONMENT_LABEL_HINTS : USER_LABEL_HINTS
	return hints.some((hint) => normalized.includes(hint))
}

/**
 * Choisit le périphérique vidéo à activer pour la bascule avant/arrière.
 *
 * Deux stratégies, dans cet ordre :
 *
 *  1. le LIBELLÉ, quand il en dit assez (« Caméra arrière », « Back Camera ») ;
 *  2. à défaut — les libellés sont souvent vides tant que la permission
 *     caméra n'a pas été accordée —, on CYCLE dans l'ordre de la liste.
 *     Changer de caméra sans certitude sur la direction reste préférable à ne
 *     rien proposer du tout.
 */
export function nextCameraDevice(
	devices: readonly { deviceId: string; label: string }[],
	currentId: string | null,
	wanted: "user" | "environment",
): string | null {
	if (devices.length === 0) return null

	const matches = devices.filter((d) => labelMatchesDirection(d.label, wanted))
	if (matches.length > 0) {
		const candidate = matches.find((d) => d.deviceId !== currentId)
		// Tout ce qui correspond au libellé demandé désigne déjà la caméra
		// active : il n'y a rien d'autre à proposer dans cette direction.
		return candidate?.deviceId ?? null
	}

	const currentIndex =
		currentId === null ? -1 : devices.findIndex((d) => d.deviceId === currentId)
	const next = devices[currentIndex === -1 ? 0 : (currentIndex + 1) % devices.length]
	// L'index est borné par la longueur (non vide, vérifiée plus haut) : la
	// garde ne sert que le typage.
	if (next === undefined) return null
	// Liste à un seul élément déjà actif : cycler reviendrait sur lui-même.
	return next.deviceId === currentId ? null : next.deviceId
}
