// Dupliqué de socle/packages/agent-features/src/features/iappel/participant-identity.ts @ ad2e7fdc2 — adaptations : le jeton du moteur (`calls.livekitActions.requestToken`) porte la PERSONNE (`attributes.personId`, et `metadata` JSON en repli) au lieu du `userId` du socle — la constante et les fonctions gardent leur nom, l'attribut lu devient `personId`.
/**
 * participant-identity — QUI est ce participant LiveKit, côté métier.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE (2026-09-13)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'identité LiveKit d'un participant n'est PAS sa personne : c'est
 * `{subject}::{nonce}`, unique par CONNEXION (`convex/lib/livekitIdentity.ts`
 * — deux onglets du même compte ne doivent pas s'éjecter). La grille d'un
 * appel de groupe, elle, se construit sur les personnes CONVIÉES
 * (`calls.groupCalls.listParticipants`), dont la clé est la personne. L'écran
 * comparait l'une à l'autre — `tracksByIdentity.get(String(userId))`,
 * `identity === localIdentity` — et la comparaison ne réussissait JAMAIS :
 * ma vignette montrait mon avatar pendant que ma caméra tournait (l'image
 * partait dans une incrustation à part), et les caméras des autres restaient
 * des initiales. Constat en production, appel « Cyber & Digital », capture du
 * propriétaire. Ni le typage ni les tests ne pouvaient le voir : les deux
 * côtés sont des `string`.
 *
 * Le pont est porté par le JETON : `calls.livekitActions.requestToken` inscrit
 * la personne (`personId`) dans les `attributes` du participant (mécanisme
 * LiveKit prévu pour cela, visible de toute la salle comme l'identité), et la
 * répète dans `metadata` (JSON) pour un serveur antérieur aux attributs. Ce
 * module lit les deux, dans cet ordre.
 *
 * Aucun import LiveKit : le module décrit ce dont il a besoin, ce qui le rend
 * lisible en environnement `node` et testable sans salle.
 */

/**
 * Le nom de l'attribut — le MÊME des deux côtés
 * (`convex/modules/calls/livekitActions.ts`). Le nom de la constante est celui
 * du socle ; l'attribut porte la personne.
 */
export const PARTICIPANT_USER_ID_ATTRIBUTE = "personId"

/** Ce qu'on lit d'un participant LiveKit — `Participant` en est une. */
export interface ParticipantIdentityProbe {
	identity: string
	attributes?: Readonly<Record<string, string>> | null
	metadata?: string | null
}

/**
 * La personne (`Id<"persons">`, en chaîne) d'un participant, ou `null` si le
 * jeton ne la porte pas (serveur qui ignore attributs ET métadonnées,
 * participant de service). Jamais une valeur inventée : l'appelant replie
 * sur l'identité brute et la vignette reste un avatar, ce qui dit au moins
 * qui est là.
 */
export function participantUserId(probe: ParticipantIdentityProbe): string | null {
	const fromAttributes = probe.attributes?.[PARTICIPANT_USER_ID_ATTRIBUTE]
	if (typeof fromAttributes === "string" && fromAttributes.length > 0) {
		return fromAttributes
	}
	const metadata = probe.metadata
	if (typeof metadata !== "string" || metadata.length === 0) return null
	try {
		const parsed: unknown = JSON.parse(metadata)
		if (parsed !== null && typeof parsed === "object") {
			const candidate = (parsed as Record<string, unknown>)[
				PARTICIPANT_USER_ID_ATTRIBUTE
			]
			if (typeof candidate === "string" && candidate.length > 0) return candidate
		}
	} catch {
		// Une métadonnée qui n'est pas la nôtre (autre intégration, texte libre)
		// n'est pas une erreur : elle ne nomme simplement personne.
	}
	return null
}

/**
 * La CLÉ sous laquelle la scène range ce participant : sa personne quand le
 * jeton la porte, son identité LiveKit sinon. C'est cette clé — et elle seule
 * — que la grille compare à `String(participant.userId)`.
 */
export function participantKey(probe: ParticipantIdentityProbe): string {
	return participantUserId(probe) ?? probe.identity
}
