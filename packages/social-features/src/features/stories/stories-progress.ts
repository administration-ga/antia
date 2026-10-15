// Dupliqué de socle/packages/agent-features/src/features/stories/stories-progress.ts @ ad2e7fdc2 — adaptations : plafond absolu d'une vidéo (`STORY_VIDEO_CAP_MS`) recopié de la borne unique du moteur (`STORY_VIDEO_MAX_DURATION_MS`, cinq minutes) au lieu des dix minutes de la surface la plus large du socle — le moteur n'a qu'une surface ; aucun libellé.
/**
 * stories-progress — le DÉROULÉ d'une story : combien de temps, jusqu'où, et
 * ce qu'un doigt posé sur l'écran déclenche.
 *
 * Le socle testait ses surfaces en environnement `node`, SANS
 * testing-library : ce qui reste dans le corps d'un composant n'y était
 * vérifiable qu'à l'œil. La durée d'un segment, l'avancement à un instant
 * donné, la zone de tap, l'abandon d'un appui confisqué par le pager et
 * l'horloge de lecture vivent donc ici. `StoryViewer.tsx` n'a plus qu'à câbler
 * une boucle `requestAnimationFrame` sur ces fonctions.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'HORLOGE NE COMPTE PAS LE TEMPS DU DOIGT POSÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tickTimer` accumule des INTERVALLES, jamais un écart à un instant de
 * départ. La différence porte tout : garder un `startedAt` et calculer
 * `now - startedAt` ferait qu'une pause de trois secondes se rattraperait
 * d'un bond au relâchement — la barre de progression sauterait, et une image
 * regardée en détail disparaîtrait au moment précis où l'on relève le doigt.
 *
 * Aucun import : ce module ne connaît que des nombres.
 */

/**
 * Cinq secondes par image. C'est la durée de référence du genre (Instagram,
 * WhatsApp, Facebook) et elle n'est pas un réglage : une barre de progression
 * dont le rythme change d'un écran à l'autre ne se lit plus.
 */
export const STORY_IMAGE_MS = 5_000

/**
 * Le plafond ABSOLU d'une vidéo, RECOPIÉ du domaine du moteur
 * (`STORY_VIDEO_MAX_DURATION_MS`, `@antia/social-domain/stories`) — cinq
 * minutes. Le socle bornait par surface et prenait ici la plus permissive
 * (dix minutes sur le fil) ; le moteur n'a qu'une surface et une seule borne.
 *
 * ⚠️ Recopié, et pas importé, DÉLIBÉRÉMENT : ce module ne doit dépendre de
 * rien pour rester lisible et testable seul (son test vérifie que la copie
 * suit le domaine). Le vrai garde-fou est au serveur, qui refuse à la
 * publication — celui-ci n'existe que pour qu'une durée aberrante
 * (métadonnée corrompue, vidéo trafiquée) ne fige pas la lecture.
 */
export const STORY_VIDEO_CAP_MS = 5 * 60 * 1_000

/** Ce dont ce module a besoin pour minuter un segment — rien de plus. */
export interface StorySegment {
	media: {
		kind: "image" | "video"
		durationMs?: number
	}
}

/**
 * Combien de temps ce segment tient l'écran.
 *
 * Une vidéo dure ce qu'elle dure, bornée à cinq minutes. Une durée absente,
 * nulle ou négative retombe sur la durée d'image : le média est là, il doit
 * s'afficher — un segment de zéro milliseconde passerait sans qu'on l'ait vu.
 */
export function segmentDuration(story: StorySegment): number {
	if (story.media.kind !== "video") return STORY_IMAGE_MS
	const declared = story.media.durationMs
	if (declared === undefined || !Number.isFinite(declared) || declared <= 0) {
		return STORY_IMAGE_MS
	}
	return Math.min(declared, STORY_VIDEO_CAP_MS)
}

/**
 * L'avancement d'un segment, entre `0` et `1`.
 *
 * Une durée nulle rend `1` plutôt que `NaN` : un segment sans durée est
 * TERMINÉ, ce qui fait avancer la lecture — le contraire figerait le lecteur
 * sur une barre vide, sans rien à l'écran pour l'expliquer.
 */
export function progressAt(elapsed: number, duration: number): number {
	if (!Number.isFinite(duration) || duration <= 0) return 1
	if (!Number.isFinite(elapsed) || elapsed <= 0) return 0
	return Math.min(1, elapsed / duration)
}

/**
 * Ce qu'un tap déclenche selon l'endroit touché : le tiers GAUCHE revient en
 * arrière, tout le reste avance.
 *
 * Le tiers, et non la moitié : on avance cent fois pour reculer une, et une
 * cible de retour trop large fait reculer par accident au pouce. Une largeur
 * nulle ou absurde avance — le geste par défaut est celui qu'on voulait.
 */
export function tapZone(x: number, width: number): "prev" | "next" {
	if (!Number.isFinite(width) || width <= 0) return "next"
	return x < width * 0.3 ? "prev" : "next"
}

/**
 * L'appui en cours vient-il d'être CONFISQUÉ par le pager vertical ?
 *
 * Le pager engage son glissé quand |dy| atteint son hystérésis — au même
 * instant, il POSE sa capture de pointeur et `.st-stage` ne reverra plus ni
 * `pointermove` ni `pointerup` (cf. `justEngaged`, `gestures/swipe.ts`). Sans
 * cette décision, un glissé vertical laisserait la série de départ en pause
 * DÉFINITIVE : le `setPaused(false)` du relâchement ne l'atteindrait jamais.
 *
 * L'axe VERTICAL seulement, et c'est voulu : le pager est verrouillé sur `y`
 * (`lockAxis`), un déplacement horizontal ne l'engage pas — `.st-stage` garde
 * alors le flux entier et son `pointerup` normal relâche la pause. Le seuil
 * est un PARAMÈTRE (comme `now` dans `storyAgeLabel`) : ce module n'importe
 * rien, l'appelant passe `SWIPE_HYSTERESIS_PX`. La borne est INCLUSIVE
 * (`>=`), miroir exact du test d'engagement de `moveTrack`.
 */
export function pressLostToSwipe(
	start: { x: number; y: number },
	x: number,
	y: number,
	hysteresis: number,
): boolean {
	return Math.abs(y - start.y) >= hysteresis
}

/**
 * TOUTES les raisons d'arrêter l'horloge d'un segment — en oublier UNE fait
 * défiler une story que personne ne regarde :
 *   - `active`     — l'écran est celui que le pager montre ;
 *   - `paused`     — le doigt est posé (pause volontaire) ;
 *   - `stalled`    — le décodeur attend le réseau ;
 *   - `viewersOpen`— la feuille « Vu par » couvre la scène ;
 *   - `needsTap`   — l'autoplay a été REFUSÉ : la vidéo attend un geste, et
 *     laisser courir l'horloge ferait passer une vidéo jamais lue ;
 *   - `failed`     — le média est mort : l'écran TIENT, il ne défile pas.
 */
export interface HaltInput {
	active: boolean
	paused: boolean
	stalled: boolean
	viewersOpen: boolean
	needsTap: boolean
	failed: boolean
}

export function isPlaybackHalted(input: HaltInput): boolean {
	return (
		!input.active ||
		input.paused ||
		input.stalled ||
		input.viewersOpen ||
		input.needsTap ||
		input.failed
	)
}

/**
 * Le MÉDIA doit-il être mis en pause ? — la même liste, SANS `stalled`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ÉTAT QUE LE MÉDIA RAPPORTE NE DOIT JAMAIS COMMANDER SA PAUSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `stalled` est levé par le média lui-même (`waiting` : « je n'ai pas encore
 * de données ») et rabaissé par lui aussi (`playing`/`canplay` : « j'en ai »).
 * Le faire entrer dans la décision de PAUSE du média ferme la boucle qui a
 * gelé toutes les vidéos d'actu (constaté le 2026-08-20, chronologie au
 * navigateur) : `play()` → `waiting` dès la première milliseconde (le tampon
 * est vide, c'est NORMAL) → pause() → un élément en pause ne émettra jamais
 * `playing` → `stalled` reste levé → pause éternelle. La vidéo finissait
 * chargée à 100 %, prête, et muette — écran noir sans un mot.
 *
 * L'HORLOGE, elle, doit bien s'arrêter sur `stalled` (`isPlaybackHalted`) :
 * c'est le tampon réseau qui ne doit pas décompter la story. Deux décisions,
 * deux listes — les confondre re-crée le gel.
 */
export function isMediaHalted(input: HaltInput): boolean {
	return (
		!input.active ||
		input.paused ||
		input.viewersOpen ||
		input.needsTap ||
		input.failed
	)
}

/**
 * Le média est en ERREUR : sauter, ou tenir l'écran ?
 *
 * Sauter quand la série a d'autres stories — le genre ne s'arrête pas sur un
 * fichier mort. Mais sur une série d'UNE seule, sauter sort par `onExhausted`
 * et REFERME le lecteur à l'instant où il s'ouvre : un « la vidéo ne marche
 * pas » sans un mot (constaté le 2026-08-20). Là, l'écran TIENT et dit
 * pourquoi — le glissé du pager reste la sortie.
 */
export function storyMediaErrorPlan(storyCount: number): "skip" | "hold" {
	return storyCount > 1 ? "skip" : "hold"
}

/**
 * Par quelle story une série S'OUVRE : la première NON VUE, ou la première
 * tout court quand tout a déjà été regardé.
 *
 * C'est la conduite du genre, et elle a une raison : revenir sur une série
 * qu'on a laissée à moitié doit reprendre là où on s'est arrêté, sans
 * retraverser huit images déjà vues. Une série entièrement vue, elle, se
 * relit du début — le contraire l'ouvrirait sur sa dernière image, qui
 * s'écoulerait aussitôt et refermerait le lecteur.
 */
export function initialStoryIndex(
	stories: readonly { seen: boolean }[],
): number {
	const first = stories.findIndex((story) => !story.seen)
	return first < 0 ? 0 : first
}

/**
 * L'horloge d'un segment.
 *
 * `elapsed` — les millisecondes déjà consommées, hors pauses.
 * `pausedAt`  — l'ANCRE : l'horodatage jusqu'auquel `elapsed` est à jour.
 *
 * ⚠️ `null` sur l'ancre veut dire « rien n'est en cours de décompte » : la
 * lecture est arrêtée (doigt posé, onglet caché), ou c'est le tout premier
 * tour. C'est ce qui fait que deux images consécutives ne facturent jamais
 * deux fois le même intervalle, et qu'une pause n'en facture aucun.
 */
export interface StoryTimer {
	elapsed: number
	pausedAt: number | null
}

/** L'horloge au repos, au début de chaque segment. */
export const STORY_TIMER_ZERO: StoryTimer = Object.freeze({
	elapsed: 0,
	pausedAt: null,
})

/**
 * Avance l'horloge d'un échantillon.
 *
 * En PAUSE : `elapsed` ne bouge pas et l'ancre tombe — le temps du doigt posé
 * n'est facturé à personne.
 *
 * EN MARCHE sans ancre (premier tour, ou reprise) : on POSE l'ancre sans rien
 * facturer. C'est la moitié qu'on oublie : facturer `now - 0` au premier tour
 * ajouterait cinquante-sept ans d'un coup.
 *
 * Un `now` qui recule (horloge remise à l'heure) ne retranche rien : on
 * réancre, sans jamais faire diminuer `elapsed`.
 */
export function tickTimer(
	timer: StoryTimer,
	now: number,
	paused: boolean,
): StoryTimer {
	if (paused) {
		if (timer.pausedAt === null) return timer
		return { elapsed: timer.elapsed, pausedAt: null }
	}
	if (timer.pausedAt === null) return { elapsed: timer.elapsed, pausedAt: now }
	const delta = now - timer.pausedAt
	if (delta <= 0) return { elapsed: timer.elapsed, pausedAt: now }
	return { elapsed: timer.elapsed + delta, pausedAt: now }
}
