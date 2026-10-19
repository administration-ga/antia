// Dupliqué de socle/packages/agent-features/src/features/messagerie/forward-targets.ts @ ad2e7fdc2 — adaptations : TQ* — branche poste élaguée (`poste.positionTitle` du fil et `positionTitle` de la relation) ; cibles au vocabulaire de `messaging.forward` du moteur (`personal` / `group` / `handle`, au lieu de `chat` / `thread`) ; fils lus par `threadId` (DTO de `messaging.inbox`) ; libellés par clés i18n qualifiées (`messagerie:forwardTargets.*`, `t` en dernier paramètre de `buildForwardTargets` et `forwardTargetHint`, effectif accordé par la langue).
/**
 * forward-targets — VERS QUI transférer, décidé HORS du composant (ADR-0143).
 *
 * Le transfert exige une cible EXPLICITE — jamais « le dernier fil ». Ce
 * module construit les trois familles de cibles et leur recherche :
 *
 *  · **conversations 1:1** — la liste de la source (le réseau courant : la
 *    garde inter-réseaux du serveur ne peut pas être contournée par une liste,
 *    mais une liste cohérente évite le refus) ;
 *  · **groupes** — mes fils de groupe du réseau ;
 *  · **relations** — une personne SANS fil existant : le serveur l'ouvrira
 *    (`handle`), avec ses gardes (relation acceptée, blocage, indistinction).
 *
 * La conversation COURANTE est exclue : s'y transférer serait un doublon
 * silencieux dans le même fil.
 *
 * Module PUR, testé en `node` — aucun React, aucune donnée Convex brandée.
 */

import type { TFunction } from "i18next"

/**
 * La cible prête pour la mutation — miroir des cibles de `messaging.forward`
 * (`personal`, `group`, `handle`). Les identifiants restent des chaînes : la
 * référence typée les brande au dernier moment (`transfert-api.ts`).
 */
export type ForwardTargetArg =
	| { kind: "personal"; threadId: string }
	| { kind: "group"; threadId: string }
	| { kind: "handle"; handle: string }

export interface ForwardTargetRow {
	/** Clé stable de ligne : `chat:<id>` · `groupe:<id>` · `relation:<handle>`. */
	key: string
	kind: "chat" | "groupe" | "relation"
	to: ForwardTargetArg
	title: string
	/** `@handle`, titre ou effectif — ce qui distingue deux homonymes. */
	subtitle: string | null
}

/** Ce qu'il faut d'un fil 1:1 de la liste — le DTO serveur, lu structurellement. */
export interface ForwardThreadLike {
	threadId: unknown
	counterpart?: {
		displayName?: string | null
		handle?: string | null
	} | null
}

/** Ce qu'il faut d'un groupe de la liste. */
export interface ForwardGroupLike {
	threadId: unknown
	title?: string | null
	memberCount?: number | null
}

/** Ce qu'il faut d'une relation trouvée par la recherche serveur. */
export interface ForwardRelationLike {
	handle?: string | null
	displayName?: string | null
	headline?: string | null
}

function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
}

function threadTitle(thread: ForwardThreadLike, t: TFunction): string {
	return thread.counterpart?.displayName ?? t("messagerie:forwardTargets.fallbackConversation")
}

function threadSubtitle(thread: ForwardThreadLike): string | null {
	const handle = thread.counterpart?.handle
	return handle !== undefined && handle !== null && handle.length > 0
		? `@${handle}`
		: null
}

/**
 * Les lignes de cibles, conversations d'abord puis groupes — l'ordre des
 * deux listes de la source est conservé (il est celui de l'activité).
 *
 * `excludeKey` : la clé de la conversation courante (`chat:<id>` ou
 * `groupe:<id>`), retirée de la liste.
 */
export function buildForwardTargets(
	input: {
		threads: readonly ForwardThreadLike[]
		groupThreads: readonly ForwardGroupLike[]
		excludeKey?: string | null
	},
	t: TFunction,
): ForwardTargetRow[] {
	const rows: ForwardTargetRow[] = []
	for (const thread of input.threads) {
		const threadId = String(thread.threadId)
		const key = `chat:${threadId}`
		if (key === input.excludeKey) continue
		rows.push({
			key,
			kind: "chat",
			to: { kind: "personal", threadId },
			title: threadTitle(thread, t),
			subtitle: threadSubtitle(thread),
		})
	}
	for (const groupe of input.groupThreads) {
		const threadId = String(groupe.threadId)
		const key = `groupe:${threadId}`
		if (key === input.excludeKey) continue
		const effectif = groupe.memberCount
		rows.push({
			key,
			kind: "groupe",
			to: { kind: "group", threadId },
			title: groupe.title ?? t("messagerie:forwardTargets.fallbackGroup"),
			subtitle:
				effectif === undefined || effectif === null
					? null
					: t("messagerie:forwardTargets.memberCount", { count: effectif }),
		})
	}
	return rows
}

/**
 * Les relations SANS fil dans la liste — celles pour lesquelles le serveur
 * ouvrira une conversation au transfert. Une relation dont le fil est déjà
 * listé ne fait pas double emploi : sa ligne de conversation la couvre.
 */
export function relationForwardTargets(input: {
	relations: readonly ForwardRelationLike[]
	existingChatHandles: ReadonlySet<string>
}): ForwardTargetRow[] {
	const rows: ForwardTargetRow[] = []
	const vus = new Set<string>()
	for (const relation of input.relations) {
		const handle = relation.handle ?? null
		if (handle === null || handle.length === 0) continue
		if (input.existingChatHandles.has(handle)) continue
		if (vus.has(handle)) continue
		vus.add(handle)
		rows.push({
			key: `relation:${handle}`,
			kind: "relation",
			to: { kind: "handle", handle },
			title: relation.displayName ?? `@${handle}`,
			subtitle: relation.headline ?? `@${handle}`,
		})
	}
	return rows
}

/** Les handles des fils 1:1 listés — l'entrée du dédoublonnage ci-dessus. */
export function existingChatHandlesOf(
	threads: readonly ForwardThreadLike[],
): Set<string> {
	const out = new Set<string>()
	for (const thread of threads) {
		const handle = thread.counterpart?.handle
		if (handle !== undefined && handle !== null && handle.length > 0) {
			out.add(handle)
		}
	}
	return out
}

/** Le filtre local — nom, titre, @handle, sous-titre : insensible aux accents. */
export function filterForwardTargets(
	rows: readonly ForwardTargetRow[],
	term: string,
): ForwardTargetRow[] {
	const needle = normalizeText(term.trim().replace(/^@/, ""))
	if (needle.length === 0) return [...rows]
	return rows.filter((row) => {
		if (normalizeText(row.title).includes(needle)) return true
		return row.subtitle !== null && normalizeText(row.subtitle).includes(needle)
	})
}

/** Le texte du pied — ce que le transfert va faire, dit avant de le faire. */
export function forwardTargetHint(row: ForwardTargetRow, t: TFunction): string {
	switch (row.kind) {
		case "chat":
			return t("messagerie:forwardTargets.hintChat")
		case "groupe":
			return t("messagerie:forwardTargets.hintGroup")
		case "relation":
			return t("messagerie:forwardTargets.hintRelation")
	}
}
