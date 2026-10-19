// Dupliqué de socle/packages/agent-features/src/features/iappel/call-peer.ts @ ad2e7fdc2 — adaptations : branche poste élaguée (sous-titre « au titre du poste … » et badge « Appel poste ») ; libellés traduits par i18n (`t` ajouté en dernier paramètre de `peerDisplayName` et `scopeBadgeLabel`, clés `iappel:callPeer.…`).
/**
 * call-peer — comment on NOMME l'autre bout du fil.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DirectCallView` composait le nom affiché en cascade : nom LiveKit, puis
 * `title` transmis par l'appelant, puis — en DERNIER recours — le nom LiveKit
 * ENCORE UNE FOIS, ou l'identité technique du participant. Ce dernier repli
 * réintroduisait exactement ce que la règle « pas de hachage » voulait
 * exclure : un identifiant illisible du genre `570rjg5chav8n2k1p` pouvait
 * réapparaître à l'écran dès que `title` était absent. Ici, une fois qu'un nom
 * est jugé hachage, il ne ressurgit plus par AUCUN chemin — ni pour l'afficher,
 * ni pour en tirer des initiales.
 *
 * Le sous-titre (`peerSubtitle`) et les initiales (`peerInitials`) dépendent
 * de la même résolution de nom (`resolvedPeerName`) : la factoriser évite
 * qu'un futur repli diverge entre les deux (des initiales calculées sur un
 * hachage, par exemple, pendant que le nom affiché l'aurait déjà écarté).
 *
 * Aucun import React, aucun import LiveKit : module pur, testable en
 * environnement `node`. Les libellés passent par la fonction de traduction
 * REÇUE (`t`, clés qualifiées `iappel:callPeer.…`).
 */

import type { TFunction } from "i18next"

import type { CallPeerIdentity, CallScope } from "./call-types"

/**
 * Un nom qui RESSEMBLE à un identifiant technique (UUID compact, hash court,
 * slug interne) plutôt qu'à un nom de personne : une suite de 16 caractères
 * ou plus, sans espace, dans l'alphabet des identifiants (`a-z0-9_-`).
 *
 * Un vrai nom de personne contient presque toujours un espace ou fait moins
 * de 16 caractères ; la CONJONCTION des deux critères évite de rejeter un nom
 * composé court (« Ali-ben ») tout en attrapant `570rjg5chav8n2k1p`.
 */
export function isLikelyIdentityHash(value: string | null | undefined): boolean {
	if (!value) return false
	return /^[a-z0-9_-]{16,}$/i.test(value) && !value.includes(" ")
}

/**
 * Le nom retenu AVANT le tout dernier repli textuel — `null` si rien
 * d'exploitable n'existe. Point de résolution UNIQUE : `peerDisplayName` y
 * ajoute le repli final, `peerInitials` s'en sert pour savoir qu'il n'y a
 * « rien » plutôt que de tirer des initiales de ce repli.
 */
function resolvedPeerName(
	peer: CallPeerIdentity | null | undefined,
	fallback?: string,
): string | null {
	const name = peer?.name
	if (name && !isLikelyIdentityHash(name)) return name
	if (fallback && !isLikelyIdentityHash(fallback)) return fallback
	return null
}

/**
 * Le nom affiché pour l'autre bout du fil — jamais un identifiant technique.
 * Sans nom exploitable, le libellé neutre traduit (« Votre correspondant »).
 */
export function peerDisplayName(
	peer: CallPeerIdentity | null | undefined,
	fallback: string | undefined,
	t: TFunction,
): string {
	return resolvedPeerName(peer, fallback) ?? t("iappel:callPeer.fallbackName")
}

/**
 * La ligne sous le nom. Dans le moteur, l'appel est toujours personnel : la
 * ligne est l'adresse de réseau (`@marie.ndong`), ou rien.
 *
 * Pas de « Appel personnel » ici : le badge de portée le dit déjà ailleurs
 * sur l'écran — une redite n'aiderait personne. Le paramètre `scope` reste
 * (une seule valeur) : les écrans le passent déjà.
 */
export function peerSubtitle(
	peer: CallPeerIdentity | null | undefined,
	scope: CallScope,
): string | null {
	void scope
	const handle = peer?.handle
	return handle ? `@${handle}` : null
}

/**
 * Au plus deux lettres, tirées des DEUX PREMIERS mots du nom retenu par
 * `resolvedPeerName` — jamais du repli final « Votre correspondant » : ses
 * initiales (« VC ») ne diraient rien de la personne appelée.
 */
export function peerInitials(peer: CallPeerIdentity | null | undefined, fallback?: string): string {
	const name = resolvedPeerName(peer, fallback)
	if (!name) return "?"
	const initials = name
		.split(/\s+/)
		.map((word) => word[0])
		.filter((char): char is string => Boolean(char))
		.slice(0, 2)
		.join("")
		.toUpperCase()
	return initials || "?"
}

/** Le libellé du badge de portée — court, pour tenir sur une puce d'écran d'appel. */
export function scopeBadgeLabel(scope: CallScope, t: TFunction): string {
	void scope
	return t("iappel:callPeer.scopePersonnel")
}
