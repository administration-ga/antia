// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-recipients.ts @ ad2e7fdc2 — adaptations : casse rabattue par `toLowerCase()` au lieu de `toLocaleLowerCase("fr")` (aucune langue écrite en dur ; même repli pour le français et l'anglais) ; nom d'une relation NULLABLE (`displayName: string | null`, DTO `ConnectionPersonDto` du moteur : un profil sans nom reste trouvable par son identifiant) ; « l'agent » devient « la personne » dans la doc ; logique inchangée.
/**
 * Filtre LOCAL des destinataires d'iCom.
 *
 * La liste reçue est déjà bornée par le serveur aux relations acceptées. Ce
 * filtre ne doit donc jamais devenir une recherche dans l'annuaire public : il
 * ne fait que retrouver un nom ou un @identifiant parmi les relations que
 * la personne a le droit de contacter.
 */

interface RelationRecipient {
	/** `null` : la relation n'a pas de nom publié — seul son identifiant la retrouve. */
	displayName: string | null
	handle: string | null
}

function normalizeRecipientSearch(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim()
		.replace(/^@/, "")
		.toLowerCase()
}

export function filterRelationRecipients<T extends RelationRecipient>(
	relations: readonly T[],
	query: string,
): T[] {
	const term = normalizeRecipientSearch(query)
	if (!term) return [...relations]

	return relations.filter((relation) => {
		const name = normalizeRecipientSearch(relation.displayName ?? "")
		const handle = normalizeRecipientSearch(relation.handle ?? "")
		return name.includes(term) || handle.includes(term)
	})
}

/**
 * Ce que la recherche SERVEUR (`useRelationSearch`) rapporte, vu du sélecteur.
 * Un instantané, pas le hook : la décision ci-dessous se teste sans React.
 */
export interface RelationSearchSnapshot<T> {
	/** Le terme SAISI atteint le seuil serveur — avant même la pause de frappe. */
	eligible: boolean
	/** Les résultats correspondent au terme saisi et plus rien n'est en route. */
	settled: boolean
	isError: boolean
	items: readonly T[]
}

/**
 * L'état de la liste de destinataires, et d'où viennent ses lignes.
 *
 *  - `liste`   : des personnes à montrer — `local` (pages déjà chargées,
 *                pré-filtrées) ou `serveur` (recherche exhaustive) ;
 *  - `attente` : la recherche serveur est en route ; `items` est le
 *                pré-filtre local, montré en attendant — jamais « aucun » ;
 *  - `erreur`  : la recherche a échoué ; `items` est le pré-filtre local ;
 *  - `vide`    : rien ne correspond. `exhaustive` dit si l'on a VRAIMENT
 *                tout regardé (réponse serveur vide, ou toutes les pages
 *                chargées) — sinon l'écran ne conclut pas et laisse charger.
 */
export type RecipientListState<T> =
	| { kind: "liste"; items: T[]; source: "local" | "serveur" }
	| { kind: "attente"; items: T[] }
	| { kind: "erreur"; items: T[] }
	| { kind: "vide"; exhaustive: boolean }

/**
 * Décide ce que le sélecteur montre pour un terme donné.
 *
 * C'est LA correction d'IC-05 : « aucune relation ne correspond » n'était dit
 * qu'après avoir regardé une première page de 25. Ici, le vide n'est
 * EXHAUSTIF que lorsque le serveur a répondu vide pour ce terme précis — ou
 * qu'il n'y a plus aucune page à charger. Entre-temps, le pré-filtre local
 * rend la frappe instantanée, sans jamais conclure à sa place.
 */
export function deriveRecipientListState<T extends RelationRecipient>(input: {
	terme: string
	/** Les relations déjà chargées par la pagination. */
	loaded: readonly T[]
	/** Reste-t-il des pages à charger ? */
	hasMore: boolean
	search: RelationSearchSnapshot<T>
}): RecipientListState<T> {
	const local = filterRelationRecipients(input.loaded, input.terme)
	if (!input.search.eligible) {
		if (local.length > 0) return { kind: "liste", items: local, source: "local" }
		return { kind: "vide", exhaustive: !input.hasMore }
	}
	if (input.search.isError) return { kind: "erreur", items: local }
	if (!input.search.settled) return { kind: "attente", items: local }
	if (input.search.items.length === 0) return { kind: "vide", exhaustive: true }
	return { kind: "liste", items: [...input.search.items], source: "serveur" }
}

/**
 * « Voir plus de relations » a-t-il un sens dans cet état ?
 *
 * Le défaut IC-05 tenait aussi à ce bouton : il n'était rendu QUE sous une
 * liste non vide, donc jamais quand la 26e relation manquait à l'écran — là
 * précisément où charger la suite était la seule issue. Il reste atteignable
 * tant que des pages existent et que l'écran n'a pas une réponse exhaustive
 * du serveur : une liste locale, un vide non exhaustif, une panne. Pendant
 * l'attente, la réponse arrive ; sous une liste serveur, elle est déjà là.
 */
export function shouldOfferMoreRecipients<T>(
	state: RecipientListState<T>,
	hasMore: boolean,
): boolean {
	if (!hasMore) return false
	switch (state.kind) {
		case "liste":
			return state.source === "local"
		case "vide":
			return !state.exhaustive
		case "attente":
			return false
		case "erreur":
			return true
	}
}
