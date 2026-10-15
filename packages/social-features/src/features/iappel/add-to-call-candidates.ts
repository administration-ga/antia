// Dupliqué de socle/packages/agent-features/src/features/iappel/add-to-call-candidates.ts @ ad2e7fdc2 — adaptations : relations seules — annuaire de poste retiré (`contactGroupsToCandidates`, `ContactGroupLike`) ; une relation se lit sur le DTO du moteur tel quel (`ConnectionPersonDto` de `graph.connections` : `otherPersonId`, `displayName` qui peut être neutre) ; une relation sans profil publié (nom neutre) n'est pas proposée — le serveur refuserait de la convier ; fonction de poste retirée du sous-titre (titre de profil seul).
/**
 * add-to-call-candidates — QUI PEUT-ON AJOUTER À L'APPEL, ET COMMENT ON LE
 * NOMME (IC-01, Lot 01 du plan espace agent, 2026-09-06).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE SOURCE, UN SEUL VOCABULAIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mes connexions ACCEPTÉES dans le réseau (`graph.connections.paginateMine`,
 * via la pagination à deux côtés). Ni une recherche de profils découvrables,
 * ni un annuaire : la liste propose, le serveur (`calls.groupCalls.addInvitee`)
 * décide.
 *
 * Le candidat ne porte AUCUNE coordonnée privée : nom, identifiant de réseau,
 * titre de profil. Rien d'autre ne franchit ce module.
 *
 * Module PUR, testé en `node`.
 */

export interface AddToCallCandidate {
	/** La personne (`Id<"persons">`, en chaîne) — le nom du champ est celui du socle. */
	userId: string
	name: string
	/** Ce qui s'écrit sous le nom — le titre de profil, quand il existe. */
	position: string | null
	/** Adresse de réseau (`@marie.ndong`) quand elle est connue. */
	handle: string | null
}

/**
 * Ce que ce module lit d'une connexion acceptée — le DTO `ConnectionPersonDto`
 * du moteur, accepté TEL QUEL (aucune conversion au point d'appel).
 */
export interface RelationLike {
	otherPersonId: unknown
	/** `null` : profil non publié (nom neutre) — la personne n'est pas joignable. */
	displayName: string | null
	handle?: string | null
	headline?: string | null
}

function pushUnique(
	out: AddToCallCandidate[],
	seen: Set<string>,
	candidate: AddToCallCandidate,
): void {
	if (seen.has(candidate.userId)) return
	seen.add(candidate.userId)
	out.push(candidate)
}

/**
 * Connexions acceptées → candidats, dédoublonnés par personne.
 *
 * Une relation SANS profil publié (nom neutre, `displayName: null`) n'est pas
 * proposée : le serveur ne convie qu'une personne joignable (profil publié,
 * membre du réseau) — l'afficher donnerait un bouton qui échoue à l'appui.
 */
export function toCallCandidates(
	relations: readonly RelationLike[],
): AddToCallCandidate[] {
	const out: AddToCallCandidate[] = []
	const seen = new Set<string>()
	for (const relation of relations) {
		const name = relation.displayName?.trim() ?? ""
		if (name.length === 0) continue
		pushUnique(out, seen, {
			userId: String(relation.otherPersonId),
			name,
			position: relation.headline ?? null,
			handle: relation.handle ?? null,
		})
	}
	return out
}

/**
 * SOUS QUEL NOM la ligne se lit — la hiérarchie d'identité du réseau.
 *
 * On s'adresse à une personne : son nom, et dessous son titre de profil ou, à
 * défaut, son adresse de réseau. Une relation sans titre de profil
 * n'affichait rien du tout — une ligne anonyme, alors que son `@identifiant`
 * est précisément ce par quoi on la reconnaît (et ce sur quoi la recherche
 * porte déjà).
 */
export function candidateSubtitle(candidate: AddToCallCandidate): string | null {
	if (candidate.position !== null && candidate.position.length > 0) {
		return candidate.position
	}
	if (candidate.handle !== null && candidate.handle.length > 0) {
		return `@${candidate.handle}`
	}
	return null
}

/**
 * Faut-il charger la page SUIVANTE des relations ?
 *
 * Le filtre est local et la liste paginée : chercher la 26e relation trouve
 * « rien » sur la première page. Le défaut IC-05 (Nouveau message) mettait le
 * bouton « Voir plus » dans la branche où il y a DÉJÀ des résultats — celui
 * qui cherchait ne pouvait jamais l'atteindre. Ici, tant qu'un terme saisi ne
 * trouve rien et qu'il reste des pages, on continue de charger.
 */
export function shouldAutoLoadMore(input: {
	term: string
	matchCount: number
	hasMore: boolean
	isLoadingMore: boolean
}): boolean {
	if (input.term.trim().length === 0) return false
	if (input.matchCount > 0) return false
	if (!input.hasMore) return false
	if (input.isLoadingMore) return false
	return true
}
