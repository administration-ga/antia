// Dupliqué de socle/packages/agent-features/src/features/iappel/call-host.ts @ ad2e7fdc2 — adaptations : documentation seulement — carte du poste (`icom-poste`, espace de poste ADR-0123) retirée des exemples, un seul espace (le réseau) et une seule portée d'appel ; téléphone détaché au format unique du moteur (440 × 956).
/**
 * call-host — OÙ un appel se DESSINE quand un téléphone iCom est à l'écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT GARDÉ ICI (IC-01, IC-02, IC-06 — audit iCom du 2026-09-08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lancer un appel depuis la carte iCom ouvrait une SECONDE surface de
 * communication à côté d'elle : la fenêtre d'appel de bureau, portaillée vers
 * `<body>` par `CallSurface`. Le propriétaire a constaté deux espaces pour un
 * seul geste (capture du 2026-09-13) et rappelé la doctrine : la carte iCom
 * est un smartphone — l'appel reste À L'INTÉRIEUR, quelle que soit la forme
 * de la carte (téléphone détaché, carte moyenne du rail, carte rétractée).
 *
 * ── Un seul producteur, une destination de rendu ──────────────────────────
 * Ce module ne monte rien, ne calcule aucun plan d'appel et ne connaît aucune
 * salle. L'hôte global (`global-call-surface-host.tsx`) reste l'UNIQUE
 * producteur de la présentation (`planCallSurface`) ; la carte iCom n'est
 * qu'une DESTINATION visuelle, déclarée dans un registre
 * (`call-host-store.ts`). Le pool média (`CallRoomPool`) ne bouge pas :
 * changer de destination ne coupe ni le micro ni l'audio distant.
 *
 * ── Ce qui est DÉCIDÉ ici, et se teste sans DOM ───────────────────────────
 *   · QUELLE carte héberge un appel : la plus récemment déclarée qui accepte
 *     le SCOPE de l'appel (`pickCallHost`). Une carte qui ne sert pas ce scope
 *     est ignorée, où qu'elle soit — jamais un appel chez une carte qui ne
 *     l'a pas demandé. Sans carte pour son scope, l'appel garde la surface
 *     libre (fenêtre de bureau, pilule) : repli EXPLICITE, jamais deux
 *     rendus ;
 *   · CE QUE l'appel occupe dans la carte (`hostModeFor`) : tout le corps
 *     (`cover`) quand il est affiché, une BANDE en tête du corps (`strip`)
 *     quand il est réduit — les conversations redeviennent accessibles sous
 *     la bande, comme sur un téléphone ;
 *   · les trois règles de cohabitation avec la forme de la carte :
 *     `coverStarts` (une carte rétractée se DÉPLIE quand un appel la couvre —
 *     elle n'a pas de corps), `collapseRequiresMinimize` (rétracter une carte
 *     qui montre l'appel le RÉDUIT d'abord, il ne sort jamais dehors) et
 *     `cardYieldsEscape` (Échap va à la couche d'appel tant qu'elle couvre :
 *     panneau interne → réduction → ré-ancrage, IC-07).
 *
 * Aucun import React : module PUR.
 */

import type { CallPresentation } from "./call-surface-plan"
import type { CallScope } from "./call-types"

/**
 * La forme de la carte qui héberge.
 *
 *  · `phone`   — le téléphone détaché (440 × 956), tout est possible ;
 *  · `medium`  — la carte moyenne, dans son emplacement réservé ;
 *  · `compact` — l'en-tête et les briques seulement : PAS de corps.
 */
export type CallHostPose = "phone" | "medium" | "compact"

/** Ce que l'appel occupe DANS la carte : rien, une bande, ou tout le corps. */
export type CallHostMode = "none" | "strip" | "cover"

/** Une carte déclarée — ce qu'il faut pour décider, sans le DOM. */
export interface CallHostView {
	/** Identité stable de la carte (celle du téléphone iCom, par exemple). */
	id: string
	/** Les scopes d'appel que cette carte accepte d'héberger. */
	scopes: readonly CallScope[]
	pose: CallHostPose
}

/**
 * La carte qui héberge un appel de ce scope : la plus RÉCENTE qui l'accepte.
 *
 * La récence se lit en fin de liste (ordre de déclaration). Une carte qui ne
 * sert pas ce scope est ignorée, quelle que soit sa position — c'est ce qui
 * empêche un appel de s'afficher dans une carte qui ne l'a pas demandé.
 */
export function pickCallHost<T extends CallHostView>(
	hosts: readonly T[],
	scope: CallScope,
): T | null {
	for (let index = hosts.length - 1; index >= 0; index -= 1) {
		const host = hosts[index]
		if (host !== undefined && host.scopes.includes(scope)) return host
	}
	return null
}

/**
 * Ce que l'appel occupe dans la carte, pour une présentation donnée.
 *
 * ⚠️ `fullscreen` rend `none` : c'est la pose du TÉLÉPHONE RÉEL (< 960 px),
 * où aucune carte ne se déclare — et si l'une le faisait, l'écran entier
 * resterait la bonne réponse. `hidden` rend `none` : rien à dessiner.
 */
export function hostModeFor(
	presentation: CallPresentation,
	host: CallHostView | null,
): CallHostMode {
	if (host === null) return "none"
	if (presentation === "floating") return "cover"
	if (presentation === "minimized") return "strip"
	return "none"
}

/**
 * L'appel vient-il de COUVRIR la carte ?
 *
 * Une carte rétractée n'a pas de corps : quand un appel arrive ou qu'on le
 * restaure depuis la bande, elle doit se déplier. On ne réagit qu'à la
 * TRANSITION vers `cover` — jamais à l'état : rétracter une carte pendant un
 * appel (qui le réduit d'abord) ne doit pas la rouvrir une frame plus tard.
 */
export function coverStarts(previous: CallHostMode, next: CallHostMode): boolean {
	return next === "cover" && previous !== "cover"
}

/**
 * Rétracter une carte qui MONTRE l'appel : l'appel se réduit d'abord.
 *
 * Il devient la bande en tête de la carte rétractée — visible, pilotable,
 * jamais perdu, jamais dehors.
 */
export function collapseRequiresMinimize(mode: CallHostMode): boolean {
	return mode === "cover"
}

/**
 * Échap dans la carte : tant que l'appel la COUVRE, la frappe appartient à la
 * couche d'appel (fermer un panneau, puis réduire), pas à la carte. La carte
 * ne reprend Échap (ré-ancrage, fermeture) qu'au repos ou sous la bande.
 */
export function cardYieldsEscape(mode: CallHostMode): boolean {
	return mode === "cover"
}

// ═══════════════════════════════════════════════════════════════════════════
// L'APPEL ENTRANT — il sonne DANS le téléphone, lui aussi (2026-09-13 soir)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ce qui sonne : le scope de l'appel entrant de tête. `null` = rien ne sonne,
 * ou l'entrant est un « appel en attente » pendant une communication (il vit
 * alors dans la bande de la scène, déjà hébergée), ou l'on est au téléphone
 * réel (l'écran entier reste la réponse).
 */
export interface CallRingingView {
	scope: CallScope
}

export interface CallHostingView {
	id: string
	mode: CallHostMode
}

/**
 * LA décision de l'hôte : quelle carte, et ce que l'appel y occupe.
 *
 * Un appel EN COURS l'emporte : sa carte et son mode (`hostModeFor`). Sans
 * appel en cours, un appel qui SONNE couvre la carte de son scope — c'est
 * l'écran d'appel entrant d'un téléphone, à la place de la bannière posée au
 * viewport. Sans carte pour son scope, `null` : la bannière libre reste le
 * repli explicite, jamais deux rendus.
 */
export function resolveCallHosting(input: {
	presentation: CallPresentation
	callHost: CallHostView | null
	ringing: CallRingingView | null
	ringingHost: CallHostView | null
}): CallHostingView | null {
	const mode = hostModeFor(input.presentation, input.callHost)
	if (mode !== "none" && input.callHost !== null) {
		return { id: input.callHost.id, mode }
	}
	if (
		input.presentation === "hidden" &&
		input.ringing !== null &&
		input.ringingHost !== null
	) {
		return { id: input.ringingHost.id, mode: "cover" }
	}
	return null
}

/**
 * Une carte FERMÉE se réveille-t-elle pour un appel qui sonne ?
 *
 * Une carte qu'on peut FERMER (un téléphone rangé) s'allume quand on
 * l'appelle. La règle vaut au bureau, pour un scope que la carte sert, et
 * seulement si elle est fermée — ouverte, c'est `resolveCallHosting` qui la
 * couvre.
 */
export function shouldWakeForRinging(input: {
	ringing: CallRingingView | null
	scopes: readonly CallScope[]
	open: boolean
	desktop: boolean
}): boolean {
	return (
		input.desktop &&
		!input.open &&
		input.ringing !== null &&
		input.scopes.includes(input.ringing.scope)
	)
}
