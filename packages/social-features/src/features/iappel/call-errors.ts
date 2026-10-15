// Dupliqué de socle/packages/agent-features/src/lib/call-errors.ts @ ad2e7fdc2 — adaptations : codes du MOTEUR (`engineErrorCode`, `engineErrorRule` de `@antia/social-contracts/errors`) au lieu des codes `LIVEKIT_*` et `NOT_*` du socle — serveur des appels non configuré, injoignable ou saturé (`mediaServer*`), session expirée, appel introuvable ; règles du domaine (`CALL_*`, `GROUP_CALL_*`, `VOICEMAIL_*`) traduites avec leurs bornes ; refus de rendez-vous, de créneau et d'EAU retirés ; plus de phrase française portée par le serveur ni de code cherché dans le message (le moteur lève des `ConvexError` à code, dont `data` traverse partout) ; phrases traduites par i18n (`t` ajouté en dernier paramètre de `callErrorMessage` et `livekitRoomErrorMessage`, clés `iappel:callErrors.…`).
/**
 * Traduction des échecs de connexion d'appel en message affichable.
 *
 * Pourquoi ce module existe : quand le jeton de salle (`calls.livekitActions
 * .requestToken`) ou le décrochage (`calls.lifecycle.join`) échoue, les trois
 * surfaces d'appel — fenêtre sortante, alerte entrante, onglet iAppel — se
 * contentaient d'attendre un `token` qui n'arriverait jamais et tournaient
 * indéfiniment sur « Connexion… ». Un appel qui ne peut pas aboutir doit le
 * DIRE.
 *
 * Le moteur ne lève que des `ConvexError` à CODE (`{ code, rule?, params? }`) :
 * seul ce `data` traverse jusqu'au client, en production comme en
 * développement. Le texte vit dans les locales, jamais dans le serveur.
 *
 * Module pur (aucun import React/Convex) : testable et utilisable partout.
 */

import { engineErrorCode, engineErrorRule, type EngineErrorCode } from "@antia/social-contracts/errors"
import type { TFunction } from "i18next"

/**
 * Les codes du moteur qui ont une phrase PROPRE à l'appel — plus juste, ici,
 * que la phrase générique de l'espace de noms `errors`.
 */
const CALL_ERROR_KEYS: Partial<Record<EngineErrorCode, string>> = {
	// Les variables du serveur des appels manquent au déploiement : réessayer
	// ne guérira rien.
	mediaServerNotConfigured: "iappel:callErrors.mediaServerNotConfigured",
	// Le serveur temps réel s'éteint après une période sans session ; son
	// réveil prend une trentaine de secondes. Réessayer est ici la bonne action.
	mediaServerUnavailable: "iappel:callErrors.mediaServerUnavailable",
	// Le fournisseur n'a pas de machine pour rallumer le serveur (pénurie de
	// capacité de zone, 17 min constatées le 15/09/2026) : promettre un
	// démarrage en une minute faisait réessayer en boucle.
	mediaServerNoCapacity: "iappel:callErrors.mediaServerNoCapacity",
	unauthenticated: "iappel:callErrors.unauthenticated",
	// Le refus indistinct du moteur : appel inconnu, terminé pour moi, ou qui
	// ne m'est pas destiné — une seule phrase pour tous.
	notFound: "iappel:callErrors.notFound",
}

/**
 * Extrait le code applicatif d'une erreur Convex.
 *
 * Une `ConvexError` expose sa charge utile via `.data` — un objet `{ code }`
 * dans le moteur. C'est la SEULE information qui survit en production, où
 * `message` vaut « Server Error ». Une chaîne seule dans `data` est aussi lue.
 */
export function convexErrorCode(err: unknown): string | undefined {
	if (typeof err !== "object" || err === null) return undefined
	const data = (err as { data?: unknown }).data
	if (typeof data === "string" && data.length > 0) return data
	// Les erreurs du moteur portent le code dans un objet `{ code }`.
	if (typeof data === "object" && data !== null) {
		const code = (data as { code?: unknown }).code
		if (typeof code === "string" && code.length > 0) return code
	}
	return undefined
}

/**
 * Message affichable pour un échec de connexion d'appel.
 *
 * Ordre de résolution :
 *   1. la RÈGLE du domaine que le serveur a nommée (`CALL_ENDED`,
 *      `GROUP_CALL_FULL`…) : sa phrase, avec ses bornes — un refus DÉFINITIF
 *      ne s'affiche jamais « Réessayez dans un instant » ;
 *   2. le CODE du moteur : la phrase propre à l'appel quand elle existe, sinon
 *      celle de l'espace de noms `errors` ;
 *   3. le repli générique — on n'affiche JAMAIS « Server Error » à l'usager.
 */
export function callErrorMessage(err: unknown, t: TFunction): string {
	const rule = engineErrorRule(err)
	if (rule !== null) return t(`rules:${rule.rule}`, rule.params)

	const code = engineErrorCode(err)
	if (code !== null) {
		const callKey = CALL_ERROR_KEYS[code]
		return callKey !== undefined ? t(callKey) : t(`errors:${code}`)
	}
	return t("iappel:callErrors.fallback")
}

/**
 * Message affichable quand le jeton est valide mais que la ROOM reste
 * injoignable — échec remonté par `<LiveKitRoom onError>`.
 *
 * Distinct de `callErrorMessage` : ici le jeton a été délivré, c'est la
 * connexion au serveur temps réel qui échoue. Trois causes vues en vrai :
 * l'origine du serveur absente du `connect-src` du CSP (le navigateur bloque
 * le handshake), la machine éteinte, ou le réseau de l'appareil. L'usager n'a
 * pas à connaître la différence — mais il doit savoir que ça n'aboutira pas.
 */
export function livekitRoomErrorMessage(err: unknown, t: TFunction): string {
	const raw = err instanceof Error ? err.message : ""
	// Trace technique : la cause exacte reste lisible en console pour
	// l'exploitant, jamais affichée à l'usager.
	if (raw) console.error("[call] connexion LiveKit échouée :", raw)
	return t("iappel:callErrors.roomUnreachable")
}

/**
 * Vrai quand l'échec vient de la configuration du déploiement, pas de l'usager.
 * Réessayer est alors inutile : l'UI doit proposer de raccrocher, pas de
 * relancer une connexion qui échouera à l'identique.
 */
export function isCallConfigurationError(err: unknown): boolean {
	return engineErrorCode(err) === "mediaServerNotConfigured"
}
