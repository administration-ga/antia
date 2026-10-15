// Dupliqué de socle/packages/agent-features/src/features/iappel/remote-video.ts @ ad2e7fdc2 — adaptations : aucune (module pur, sans texte affiché ni dépendance au socle).
/**
 * remote-video — « voit-on la caméra du correspondant, et sinon POURQUOI ? »
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'écran d'appel retenait la piste distante sur un seul critère :
 * `!publication.isMuted`. Trois états très différents passaient donc pour un
 * seul, et l'écran affichait « Caméra distante désactivée » dans tous :
 *
 *  1. le pair n'a rien publié                       → il n'a pas de caméra ;
 *  2. le pair a publié, la piste n'est pas encore   → ça arrive, ça dure une
 *     SOUSCRITE (`publication.track === undefined`)    seconde, et ce n'est
 *                                                      pas un refus ;
 *  3. le pair a coupé sa caméra (`isMuted`)         → là, c'est un choix.
 *
 * Le cas 2 est le plus traître : `useTracks(..., { onlySubscribed: false })`
 * — l'option que la scène utilise, à raison, pour ne pas manquer une piste —
 * rend AUSSI les publications non souscrites, et `<VideoTrack>` n'appelle
 * `track.attach()` que si `track` est défini. On monte alors un `<video>` qui
 * ne reçoit jamais de flux : un cadre noir, sans la moindre erreur.
 *
 * Pire, la boucle se referme : avec `adaptiveStream`, LiveKit décide d'envoyer
 * ou non la vidéo selon la visibilité de l'élément attaché. Pas d'élément
 * monté ⇒ pas d'envoi ⇒ la piste ne devient jamais « vivante » ⇒ on ne monte
 * toujours pas l'élément.
 *
 * D'où quatre états explicites, et un rendu qui monte le `<video>` DÈS que la
 * piste est souscrite — même le temps que la première image arrive.
 *
 * Aucun import LiveKit : le module décrit ce dont il a besoin (`TrackProbe`),
 * ce qui le rend lisible en environnement `node`.
 */

/**
 * Ce qu'on sait d'une publication de caméra, réduit à l'essentiel.
 * Volontairement structurel : `useTracks` rend des objets bien plus gros.
 */
export interface TrackProbe {
	/** Identité LiveKit du participant qui publie. */
	participantIdentity: string
	/** La publication existe-t-elle ? (une entrée sans publication n'arrive pas) */
	hasPublication: boolean
	/** La piste MÉDIA est-elle attachée à la publication ? */
	hasTrack: boolean
	/** Sommes-nous abonnés à cette piste ? */
	isSubscribed: boolean
	/** Le pair a-t-il coupé sa caméra ? */
	isMuted: boolean
}

/**
 * L'état de la vidéo distante.
 *
 *  · `none`       — rien de publié : appel audio, écran d'avatar ;
 *  · `connecting` — publiée, pas encore reçue : on monte le cadre et on
 *    patiente (« Connexion vidéo… ») ;
 *  · `off`        — publiée puis coupée par le pair : on le DIT, en le
 *    nommant, parce que c'est une décision de quelqu'un ;
 *  · `live`       — l'image arrive.
 */
export type RemoteVideoState = "none" | "connecting" | "off" | "live"

/** Forme minimale d'une référence de piste, telle que `useTracks` la rend. */
export interface CameraTrackLike {
	participant: { identity: string; isLocal?: boolean }
	publication: {
		track?: unknown
		isSubscribed?: boolean
		isMuted?: boolean
	}
}

/** L'état décrit par une sonde — le point de décision unique. */
export function classifyRemoteVideo(probe: TrackProbe | null): RemoteVideoState {
	if (probe === null || !probe.hasPublication) return "none"
	// L'ordre compte : une piste COUPÉE reste souvent souscrite et attachée.
	// La tester après « souscrite » afficherait « Connexion vidéo… » sur une
	// caméra délibérément éteinte, qui ne s'allumera pas.
	if (probe.isMuted) return "off"
	if (!probe.isSubscribed || !probe.hasTrack) return "connecting"
	return "live"
}

/** Sonde une référence de piste. Les champs absents sont lus au mieux-disant. */
export function probeOf(ref: CameraTrackLike): TrackProbe {
	return {
		participantIdentity: ref.participant.identity,
		hasPublication: true,
		hasTrack: ref.publication.track !== undefined && ref.publication.track !== null,
		// `isSubscribed` absent (piste LOCALE, ou publication simplifiée) vaut
		// « oui » : on ne s'abonne pas à soi-même, et une sonde pessimiste
		// laisserait la vignette locale en « Connexion vidéo… » pour toujours.
		isSubscribed: ref.publication.isSubscribed !== false,
		isMuted: ref.publication.isMuted === true,
	}
}

/**
 * La piste caméra du CORRESPONDANT, et l'état à afficher.
 *
 * ⚠️ On renvoie la piste même en `connecting` : c'est ce qui monte l'élément
 * `<video>`, ce qui déclenche la souscription sous `adaptiveStream`, donc ce
 * qui fait arriver l'image. Ne la rendre qu'en `live` verrouillerait la boucle
 * décrite en tête de fichier.
 *
 * `off` ne rend PAS la piste : il n'y a rien à afficher, et le cadre noir
 * serait pris pour une panne au lieu d'une caméra coupée.
 */
export function pickRemoteCameraTrack<T extends CameraTrackLike>(
	tracks: readonly T[],
	localIdentity: string | undefined,
): { track: T | null; state: RemoteVideoState } {
	const remotes = tracks.filter(
		(t) =>
			t.participant.isLocal !== true &&
			(localIdentity === undefined || t.participant.identity !== localIdentity),
	)
	if (remotes.length === 0) return { track: null, state: "none" }

	// Plusieurs publications caméra pour un même pair (partage d'écran mal
	// étiqueté, republication en cours) : on préfère celle qui MONTRE quelque
	// chose, puis celle qui arrive, et on ne retient « coupée » qu'en dernier.
	const rank: Record<RemoteVideoState, number> = {
		live: 0,
		connecting: 1,
		off: 2,
		none: 3,
	}
	let best: { track: T; state: RemoteVideoState } | null = null
	for (const candidate of remotes) {
		const state = classifyRemoteVideo(probeOf(candidate))
		if (best === null || rank[state] < rank[best.state]) {
			best = { track: candidate, state }
		}
	}
	if (best === null) return { track: null, state: "none" }
	return {
		track: best.state === "off" || best.state === "none" ? null : best.track,
		state: best.state,
	}
}

/** La piste caméra LOCALE, pour la vignette. */
export function pickLocalCameraTrack<T extends CameraTrackLike>(
	tracks: readonly T[],
	localIdentity: string | undefined,
): T | null {
	if (localIdentity === undefined) {
		return tracks.find((t) => t.participant.isLocal === true) ?? null
	}
	return (
		tracks.find(
			(t) =>
				t.participant.isLocal === true ||
				t.participant.identity === localIdentity,
		) ?? null
	)
}
