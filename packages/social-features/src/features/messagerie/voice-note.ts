// Dupliqué de socle/packages/agent-features/src/features/messagerie/voice-note.ts @ ad2e7fdc2 — adaptations : commentaires seulement (environnement de test du paquet, « personnes » au lieu d'« agents ») ; le nom de fichier d'un vocal reste une donnée stable, hors i18n.
/**
 * voice-note — ce que le message VOCAL décide, hors de tout composant.
 *
 * Module pur, testé en environnement `node` : un enregistreur laissé entier
 * dans un `.tsx` ne se vérifie qu'en parlant dans un micro. Ce module porte donc les
 * quatre décisions du vocal — quel conteneur demander, quel nom de fichier
 * écrire, quelle durée afficher, et quand jeter la prise —, `MediaRecorder`
 * restant au composant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `audio/mp4` EN TÊTE — CE N'EST PAS UNE PRÉFÉRENCE, C'EST iOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Safari (iOS et macOS) ne PRODUIT pas de `webm` et n'en LIT pas. Une liste
 * qui commence par `audio/webm;codecs=opus` — l'ordre naturel sur Chrome, et
 * celui de `ActivityContributionsPage` — donne deux pannes distinctes :
 *
 *  · à l'ENREGISTREMENT, `isTypeSupported("audio/webm")` répond faux et l'on
 *    retombe sur le conteneur par défaut, dont le mime n'est pas celui qu'on
 *    croit envoyer ;
 *  · à la LECTURE, un vocal enregistré sur Android en `webm` ne s'ouvre pas
 *    sur l'iPhone d'en face — et rien à l'écran ne le dit, `<audio>` reste
 *    muet.
 *
 * `audio/mp4` (AAC) est le seul conteneur que les deux familles produisent et
 * lisent. Il passe donc en premier, pour que le fil soit AUDIBLE des deux
 * côtés — quitte à ce que Chrome n'utilise pas son format de prédilection.
 *
 * Aucun import : ce module ne connaît que des chaînes et des nombres.
 */

/** Deux minutes : au-delà, ce n'est plus un message, c'est un enregistrement. */
export const VOICE_NOTE_MAX_MS = 120_000

/**
 * En deçà, la prise est JETÉE sans un mot.
 *
 * 800 ms est la durée d'un appui manqué — le doigt qui effleure le micro en
 * visant la pièce jointe. Envoyer ce souffle-là pollue le fil, et le
 * destinataire ne peut pas savoir que c'était une erreur.
 */
export const VOICE_NOTE_MIN_MS = 800

/**
 * Les conteneurs demandés, DANS L'ORDRE. `audio/mp4` d'abord (cf. en-tête).
 * `null` en sortie de `pickRecorderMimeType` signifie « laisse le navigateur
 * choisir », jamais « échec ».
 */
export const RECORDER_MIME_CANDIDATES: readonly string[] = Object.freeze([
	"audio/mp4",
	"audio/mp4;codecs=mp4a.40.2",
	"audio/mpeg",
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/ogg;codecs=opus",
])

/**
 * Le premier conteneur pris en charge, ou `null`.
 *
 * `isSupported` est injecté (`MediaRecorder.isTypeSupported` au point
 * d'usage) : ce module ne touche à aucune API de navigateur, c'est ce qui le
 * rend testable en environnement `node`.
 */
export function pickRecorderMimeType(
	isSupported: (mimeType: string) => boolean,
): string | null {
	for (const candidate of RECORDER_MIME_CANDIDATES) {
		try {
			if (isSupported(candidate)) return candidate
		} catch {
			// Un `isTypeSupported` qui lève (implémentations anciennes) ne doit pas
			// interrompre le parcours : on essaie le candidat suivant.
		}
	}
	return null
}

/** L'extension qui correspond au conteneur — jamais devinée à l'aveugle. */
function extensionFor(mimeType: string): string {
	const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? ""
	switch (base) {
		case "audio/mp4":
		case "audio/x-m4a":
			return "m4a"
		case "audio/mpeg":
			return "mp3"
		case "audio/webm":
			return "webm"
		case "audio/ogg":
			return "ogg"
		case "audio/wav":
		case "audio/x-wav":
			return "wav"
		case "audio/aac":
			return "aac"
		default:
			// Extension NEUTRE plutôt qu'une extension fausse : un `.webm` posé sur
			// de l'AAC fait échouer l'ouverture par double-clic sur le poste de
			// travail, alors qu'un `.bin` laisse au moins le lecteur deviner.
			return "bin"
	}
}

/**
 * Le nom de fichier d'un vocal.
 *
 * Horodaté en UTC, et non en heure locale : c'est ce qui rend le nom
 * DÉTERMINISTE — deux personnes dans deux fuseaux ne fabriquent pas deux noms
 * différents pour la même prise, et le test ne dépend pas du fuseau de la
 * machine qui l'exécute.
 */
export function voiceNoteFileName(mimeType: string, at: number): string {
	const stamp = Number.isFinite(at)
		? new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, "-")
		: "sans-date"
	return `message-vocal-${stamp}.${extensionFor(mimeType)}`
}

/**
 * La durée d'un vocal, telle qu'elle s'affiche sous la bulle : `0:07`,
 * `1:23`, `12:00`, et `1:02:03` au-delà de l'heure (que le plafond interdit,
 * mais un fichier reçu d'ailleurs peut la dépasser).
 *
 * Une durée absente ou non finie rend `0:00`, jamais `NaN:NaN`.
 */
export function formatVoiceDuration(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
		return "0:00"
	}
	const total = Math.floor(ms / 1000)
	const secondes = total % 60
	const minutes = Math.floor(total / 60) % 60
	const heures = Math.floor(total / 3600)
	const ss = String(secondes).padStart(2, "0")
	if (heures > 0) return `${heures}:${String(minutes).padStart(2, "0")}:${ss}`
	return `${minutes}:${ss}`
}

/**
 * Les phases de l'enregistreur.
 *
 * `requesting` existe parce que `getUserMedia` OUVRE UNE PERMISSION : entre
 * l'appui et le premier octet, il peut s'écouler plusieurs secondes pendant
 * lesquelles l'écran doit dire quelque chose — sans quoi on appuie deux fois,
 * et deux flux s'ouvrent.
 */
export type RecorderPhase =
	| "idle"
	| "requesting"
	| "recording"
	| "stopping"
	| "error"

export interface RecorderState {
	phase: RecorderPhase
	/** Instant du premier octet — `null` hors enregistrement. */
	startedAt: number | null
	/** Durée écoulée, PLAFONNÉE à `VOICE_NOTE_MAX_MS`. */
	elapsedMs: number
	/** Message d'échec lisible — `null` hors `error`. */
	error: string | null
}

export type RecorderEvent =
	/** L'appui : on demande le micro. */
	| { kind: "request" }
	/** Le flux est ouvert, l'enregistrement commence. */
	| { kind: "started"; at: number }
	/** Battement d'horloge — l'appelant passe l'instant courant. */
	| { kind: "tick"; at: number }
	/** Le relâchement : on demande l'arrêt. */
	| { kind: "stop" }
	/** Le blob est prêt : retour au repos. */
	| { kind: "stopped" }
	/** Refus de permission, absence d'API, panne matérielle. */
	| { kind: "error"; message: string }
	/** Annulation explicite, ou fermeture de l'écran. */
	| { kind: "reset" }

export function initialRecorderState(): RecorderState {
	return { phase: "idle", startedAt: null, elapsedMs: 0, error: null }
}

/**
 * Applique un événement à l'enregistreur.
 *
 * ⚠️ Le PLAFOND est appliqué ici, et non par un `setTimeout` du composant :
 * un `tick` qui atteint `VOICE_NOTE_MAX_MS` fait passer la phase à `stopping`
 * de lui-même. Laisser cette borne au composant, c'est la perdre le jour où
 * l'onglet passe en arrière-plan et où les minuteries se figent — la phase,
 * elle, se rattrape au premier `tick` qui revient.
 */
export function recorderReducer(
	state: RecorderState,
	event: RecorderEvent,
): RecorderState {
	switch (event.kind) {
		case "request":
			// Un second appui pendant qu'on enregistre ne rouvre rien.
			if (state.phase === "requesting" || state.phase === "recording") {
				return state
			}
			return { phase: "requesting", startedAt: null, elapsedMs: 0, error: null }

		case "started":
			// Un `started` qui arrive après un `reset` (course de promesse) ne doit
			// pas ressusciter un enregistrement que l'on vient d'abandonner.
			if (state.phase !== "requesting") return state
			return { phase: "recording", startedAt: event.at, elapsedMs: 0, error: null }

		case "tick": {
			if (state.phase !== "recording" || state.startedAt === null) return state
			const brut = event.at - state.startedAt
			const elapsedMs = Math.min(
				VOICE_NOTE_MAX_MS,
				Number.isFinite(brut) && brut > 0 ? brut : 0,
			)
			const atteintLePlafond = elapsedMs >= VOICE_NOTE_MAX_MS
			if (elapsedMs === state.elapsedMs && !atteintLePlafond) return state
			return {
				...state,
				elapsedMs,
				phase: atteintLePlafond ? "stopping" : "recording",
			}
		}

		case "stop":
			if (state.phase !== "recording") return state
			return { ...state, phase: "stopping" }

		case "stopped":
			// Depuis n'importe quelle phase : le blob rendu clôt l'affaire.
			return initialRecorderState()

		case "error":
			return {
				phase: "error",
				startedAt: null,
				elapsedMs: 0,
				error: event.message,
			}

		case "reset":
			return state.phase === "idle" && state.error === null
				? state
				: initialRecorderState()
	}
}

/** Cette prise est-elle trop courte pour être envoyée ? */
export function shouldDiscard(durationMs: number): boolean {
	if (!Number.isFinite(durationMs)) return true
	return durationMs < VOICE_NOTE_MIN_MS
}
