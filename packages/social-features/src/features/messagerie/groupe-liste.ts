// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-liste.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
/**
 * groupe-liste — la fusion des conversations 1:1 et de GROUPE en UNE liste.
 *
 * La carte n'a qu'une liste, comme Messenger : y empiler deux sections
 * (« Directs » puis « Groupes ») ferait défiler les groupes hors de vue dès
 * dix conversations. On fusionne donc, triés par dernier message.
 *
 * Module PUR, même doctrine que `messagerie-liste.ts` : ce tri est une
 * décision, pas un détail de rendu — il vit là où il se teste. Seul import :
 * un autre module pur du même dossier (des données, rien d'autre).
 */

import { normaliseRecherche } from "./messagerie-liste"

/** Le minimum qu'une conversation doit porter pour être fusionnée : sa date. */
export interface ConversationDatee {
	lastMessageAt: number | null
}

/**
 * Une entrée de la liste fusionnée — l'union DISCRIMINÉE, pour que le rendu
 * n'ait jamais à deviner la nature d'une ligne à ses champs.
 */
export type EntreeConversation<
	C extends ConversationDatee,
	G extends ConversationDatee,
> = { kind: "chat"; chat: C } | { kind: "groupe"; groupe: G }

/** Les trois vues offertes par le sélecteur de la liste iChat. */
export type FiltreConversations = "toutes" | "individuelles" | "groupes"

/** Le minimum requis pour composer une pastille de non-lus. */
export interface ConversationAvecNonLus {
	unreadCount: number
	/** Vrai quand le serveur sait que le compteur réel dépasse sa borne. */
	unreadCapped?: boolean
}

/**
 * Un total garde le chiffre chargé ET le fait qu'il est borné.
 *
 * Conserver les deux évite de perdre « 99+ » lorsqu'un seul fil est déjà
 * plafonné à 99 : la somme numérique vaut alors 99, mais ce n'est pas le total
 * réel.
 */
export interface TotalNonLus {
	total: number
	capped: boolean
}

/** Les deux familles restent séparées jusqu'au rendu de leurs pastilles. */
export interface NonLusParType {
	individuelles: TotalNonLus
	groupes: TotalNonLus
}

/**
 * Fusionne les deux listes, du plus récent au plus ancien.
 *
 * Les conversations SANS date (fil vide — cas du brouillon côté 1:1) tombent
 * en fin de liste : une conversation qui n'a jamais parlé ne passe devant
 * personne. Le tri est STABLE (garantie ES2019) : à date égale, l'ordre
 * d'entrée survit — les 1:1 d'abord, puisque passés en premier.
 */
export function fusionnerConversations<
	C extends ConversationDatee,
	G extends ConversationDatee,
>(
	chats: readonly C[],
	groupes: readonly G[],
): readonly EntreeConversation<C, G>[] {
	const entrees: EntreeConversation<C, G>[] = [
		...chats.map((chat) => ({ kind: "chat" as const, chat })),
		...groupes.map((groupe) => ({ kind: "groupe" as const, groupe })),
	]
	const dateDe = (entree: EntreeConversation<C, G>): number => {
		const at =
			entree.kind === "chat"
				? entree.chat.lastMessageAt
				: entree.groupe.lastMessageAt
		return at ?? Number.NEGATIVE_INFINITY
	}
	return entrees.sort((a, b) => dateDe(b) - dateDe(a))
}

/**
 * Filtre les deux familles SANS perdre leur union discriminée ni leur tri.
 *
 * Le filtre intervient après la recherche propre à chaque famille : cette
 * fonction ne connaît ni le nom d'un correspondant ni le titre d'un groupe,
 * seulement leur nature.
 */
export function filtrerConversationsParType<
	C extends ConversationDatee,
	G extends ConversationDatee,
>(
	chats: readonly C[],
	groupes: readonly G[],
	filtre: FiltreConversations,
): readonly EntreeConversation<C, G>[] {
	switch (filtre) {
		case "individuelles":
			return fusionnerConversations(chats, [])
		case "groupes":
			return fusionnerConversations([], groupes)
		case "toutes":
			return fusionnerConversations(chats, groupes)
	}
}

/** Additionne les messages non lus d'une famille et propage tout plafond. */
export function sommerNonLus(
	conversations: readonly ConversationAvecNonLus[],
): TotalNonLus {
	const total = conversations.reduce(
		(somme, conversation) => somme + conversation.unreadCount,
		0,
	)
	return {
		total,
		capped:
			total > 99 || conversations.some((conversation) => conversation.unreadCapped),
	}
}

/** Calcule les deux pastilles depuis les listes déjà chargées par iChat. */
export function sommerNonLusParType(
	chats: readonly ConversationAvecNonLus[],
	groupes: readonly ConversationAvecNonLus[],
): NonLusParType {
	return {
		individuelles: sommerNonLus(chats),
		groupes: sommerNonLus(groupes),
	}
}

/** Texte d'une pastille ; `null` signifie qu'aucune pastille ne se rend. */
export function formaterNonLus(compteur: TotalNonLus): string | null {
	if (compteur.total <= 0) return null
	return compteur.capped ? "99+" : String(compteur.total)
}

/**
 * Filtre les groupes sur leur TITRE — le pendant de `filtrerThreads`, qui ne
 * connaît que des correspondants. Même repli sans accents, et la même
 * référence quand la requête est vide, pour que le rendu ne se relance pas.
 */
export function filtrerGroupes<G extends { title: string }>(
	groupes: readonly G[],
	requete: string,
): readonly G[] {
	const terme = normaliseRecherche(requete)
	if (terme.length === 0) return groupes
	return groupes.filter((groupe) =>
		normaliseRecherche(groupe.title).includes(terme),
	)
}
