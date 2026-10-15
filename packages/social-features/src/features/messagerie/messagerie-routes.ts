// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-routes.ts @ ad2e7fdc2 — adaptations : la base de la messagerie n'est plus une constante (`MESSAGES_URL` retirée) mais un paramètre `base`, en DERNIER argument (`useRoutes().messages()` de l'application), de `conversationHref`, `composeHref`, `composeGroupeHref`, `isConversationRoute` et `conversationKeyFromPath` ; la borne de profondeur se compte depuis les segments de la base (base + genre + identifiant) ; barre finale de la base tolérée ; adresse du hub administratif retirée (`hubChatHref`, `HUB_CHAT_PARAM`) ; renvois au chrome de l'espace agent (`personal-chrome.ts`, iAsted) retirés de la doc.
/**
 * messagerie-routes — la traduction entre une CLÉ de conversation et une URL.
 *
 * L'adressage de la messagerie est une DÉCISION — quelle clé donne quelle
 * adresse, quelle adresse rend quelle clé, et laquelle n'en rend aucune — elle
 * vit donc ici, hors de tout composant, là où elle se teste.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI DES ADRESSES, ALORS QUE LE DOCK N'EN AVAIT PAS BESOIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le dock du bureau porte sa conversation dans un état de module
 * (`dock-store.ts`) : une carte de 312 px n'a pas d'historique de navigation à
 * elle. Au téléphone, la conversation occupe l'ÉCRAN — et un écran plein qui
 * ne s'adresse pas est un cul-de-sac : le bouton « retour » du système en
 * sort, un lien ne peut pas y mener, et rien ne survit à un rechargement.
 *
 * D'où trois genres d'adresse, exactement les trois clés de
 * `messagerie-dock.ts`, et pas une de plus (`<base>` : la messagerie de
 * l'application, injectée — `useRoutes().messages()`) :
 *
 *   `chat:<threadId>`    → `<base>/chat/<threadId>`
 *   `groupe:<threadId>`  → `<base>/groupe/<threadId>`
 *   `draft:<handle>`     → `<base>/a/<handle>`
 *
 * ⚠️ AUCUNE base écrite ici : l'application seule sait ses URL (cliquet
 * `no-hardcoded-urls`). Chaque fonction reçoit la base en DERNIER argument.
 *
 * ⚠️ Le brouillon prend le segment `a` (« à quelqu'un »), et non `draft` : ce
 * n'est pas une conversation en attente d'être écrite pour celui qui la lit
 * dans la barre d'adresse, c'est une adresse — « j'écris À ce handle ». Le mot
 * `draft` reste celui de la CLÉ interne ; les deux vocabulaires ne se
 * mélangent qu'ici.
 *
 * ⚠️ Les deux composeurs sont des FEUILLES à un segment sous la base
 * (`<base>/nouveau`), une conversation en a deux. C'est ce qui empêche
 * `<base>/nouveau` d'être lu comme la conversation du genre « nouveau ».
 *
 * Un seul import — un autre module PUR du même dossier, qui ne connaît que des
 * données.
 */

import { chatKey, draftKey, groupeKey, parseKey, type ConversationKey } from "./messagerie-dock"

/** Le genre tel qu'il s'écrit DANS L'URL. Distinct des genres de clé. */
export type ConversationRouteKind = "chat" | "groupe" | "a"

/** Les trois genres d'URL, pour valider un segment inconnu sans le deviner. */
export const CONVERSATION_ROUTE_KINDS: readonly ConversationRouteKind[] =
	Object.freeze(["chat", "groupe", "a"])

/** Les deux feuilles de composition — jamais des conversations. */
export const COMPOSE_LEAF = "nouveau"
export const COMPOSE_GROUPE_LEAF = "nouveau-groupe"

/**
 * La base sans barre finale : `/messages/` et `/messages` désignent la même
 * liste, et une base racine (`/`) ne doit pas fabriquer `//chat/…`.
 */
function racine(base: string): string {
	return base.replace(/\/+$/, "")
}

/**
 * L'adresse d'une conversation, ou `null` si la clé n'en est pas une.
 *
 * L'identifiant est ENCODÉ : un handle porte des accents (`@mengue.mé`), et
 * une adresse qui ne les encode pas se casse au premier copier-coller — ou
 * pire, aboutit sur une autre page.
 */
export function conversationHref(key: ConversationKey, base: string): string | null {
	const parsed = parseKey(key)
	if (parsed === null) return null
	const liste = racine(base)
	switch (parsed.kind) {
		case "chat":
			return `${liste}/chat/${encodeURIComponent(parsed.chatId)}`
		case "groupe":
			return `${liste}/groupe/${encodeURIComponent(parsed.threadId)}`
		case "draft":
			return `${liste}/a/${encodeURIComponent(parsed.handle)}`
	}
}

/**
 * La clé que désignent un genre et un identifiant d'URL — `null` si le genre
 * est inconnu ou l'identifiant vide.
 *
 * ⚠️ L'identifiant est attendu DÉJÀ DÉCODÉ : c'est la coquille de route qui
 * appelle `decodeURIComponent` (Next.js sert les segments encodés). Décoder
 * une seconde fois ici transformerait un `%25` légitime en `%`, et un handle
 * contenant un pourcent deviendrait un identifiant différent.
 */
export function parseConversationRoute(
	kind: string | null | undefined,
	id: string | null | undefined,
): ConversationKey | null {
	if (typeof kind !== "string" || typeof id !== "string") return null
	if (id.length === 0) return null
	switch (kind) {
		case "chat":
			return chatKey(id)
		case "groupe":
			return groupeKey(id)
		case "a":
			return draftKey(id)
		default:
			return null
	}
}

/** L'adresse du choix d'un destinataire. */
export function composeHref(base: string): string {
	return `${racine(base)}/${COMPOSE_LEAF}`
}

/** L'adresse de la composition d'un GROUPE. */
export function composeGroupeHref(base: string): string {
	return `${racine(base)}/${COMPOSE_GROUPE_LEAF}`
}

/** Les segments d'un chemin, query et ancre retirées, barre finale ignorée. */
function segmentsOf(pathname: string | null | undefined): string[] {
	if (pathname === null || pathname === undefined) return []
	const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? ""
	return withoutQuery.split("/").filter((segment) => segment.length > 0)
}

/**
 * Les segments PROPRES à la conversation (genre, identifiant), ou `null` si
 * le chemin n'est pas exactement « la base, puis deux segments ».
 */
function segmentsDeConversation(
	pathname: string | null | undefined,
	base: string,
): { kind: string; id: string } | null {
	const segments = segmentsOf(pathname)
	const prefixe = segmentsOf(base)
	if (segments.length !== prefixe.length + 2) return null
	if (prefixe.some((segment, index) => segments[index] !== segment)) return null
	return {
		kind: segments[prefixe.length] ?? "",
		id: segments[prefixe.length + 1] ?? "",
	}
}

/**
 * Cette adresse est-elle UNE conversation ? (et non la liste, ni un composeur)
 *
 * La base, puis deux segments exactement, et un genre connu — les conditions
 * ensemble, sans quoi `<base>/nouveau` passerait pour une conversation dont
 * le genre serait « nouveau », et la liste elle-même passerait pour une
 * conversation vide.
 */
export function isConversationRoute(
	pathname: string | null | undefined,
	base: string,
): boolean {
	const conversation = segmentsDeConversation(pathname, base)
	if (conversation === null) return false
	return (
		(CONVERSATION_ROUTE_KINDS as readonly string[]).includes(conversation.kind) &&
		conversation.id.length > 0
	)
}

/**
 * La clé portée par un chemin COMPLET — le pendant lecture de
 * `conversationHref`. Les segments sont décodés ici, puisqu'ils viennent d'une
 * URL et non d'une coquille de route.
 */
export function conversationKeyFromPath(
	pathname: string | null | undefined,
	base: string,
): ConversationKey | null {
	if (!isConversationRoute(pathname, base)) return null
	const conversation = segmentsDeConversation(pathname, base)
	if (conversation === null) return null
	let id: string
	try {
		id = decodeURIComponent(conversation.id)
	} catch {
		// Un pourcent isolé (`%zz`) fait lever `decodeURIComponent` : l'adresse
		// est alors abîmée, pas « une autre conversation ».
		return null
	}
	return parseConversationRoute(conversation.kind, id)
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE PANNEAU D'INFORMATIONS D'UN GROUPE — UNE QUERY, PAS UNE ROUTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `?infos=1` sur l'adresse de la conversation, et non un segment de plus.
 * Deux raisons, dans l'ordre où elles pèsent :
 *
 *  1. la profondeur d'une conversation (la base, puis deux segments) est le
 *     critère de `isConversationRoute` : une route de plus en ferait une
 *     autre page, et le panneau changerait le régime de l'écran ;
 *  2. le bouton retour du SYSTÈME referme le panneau, sans code : la query a
 *     été poussée dans l'historique.
 */
export const INFOS_PARAM = "infos"

/** Le panneau est-il demandé par cette query ? */
export function infosOuvertes(search: string | null | undefined): boolean {
	if (typeof search !== "string" || search.length === 0) return false
	const params = new URLSearchParams(
		search.startsWith("?") ? search.slice(1) : search,
	)
	return params.get(INFOS_PARAM) === "1"
}

/**
 * L'adresse du panneau ouvert ou fermé, les AUTRES paramètres conservés.
 *
 * ⚠️ Conserver le reste n'est pas de la politesse : `?brique=…` porte la
 * brique d'iCom, et la perdre en ouvrant un panneau ramènerait l'usager sur
 * une autre brique en le refermant.
 */
export function hrefAvecInfos(
	pathname: string,
	search: string | null | undefined,
	ouvert: boolean,
): string {
	const brut = typeof search === "string" ? search : ""
	const params = new URLSearchParams(brut.startsWith("?") ? brut.slice(1) : brut)
	if (ouvert) {
		params.set(INFOS_PARAM, "1")
	} else {
		params.delete(INFOS_PARAM)
	}
	const qs = params.toString()
	return qs.length === 0 ? pathname : `${pathname}?${qs}`
}
