// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-dock.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance ; CC-5 : clé de destination contextuelle `contexte:` (`contextualConversationKey`, jamais lue par `parseKey`).
/**
 * messagerie-dock — l'ÉTAT de la messagerie, hors React.
 *
 * `packages/agent-features` tourne en environnement `node`, SANS
 * testing-library : ce qui reste dans le corps d'un composant n'est vérifiable
 * qu'à l'œil. Tout ce que la messagerie DÉCIDE vit donc ici. Même patron que
 * `shell/mobile-bar.ts` et `features/itravail/workbench-store.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN SEUL BLOC (2026-08-12) — CE QUI A CHANGÉ, ET CE QUI SURVIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce module a porté jusqu'ici un dock à FENÊTRES MULTIPLES : plusieurs
 * conversations côte à côte, réductibles, avec une capacité calculée sur la
 * largeur et une éviction des plus anciennes. Ce modèle vient du dock flottant
 * en bas d'écran ; il ne survit pas au déplacement dans une carte de 312 px,
 * où deux fenêtres ne tiennent pas — et où elles se rendaient hors de la carte,
 * donnant à voir DEUX blocs de messagerie au lieu d'un.
 *
 * Le modèle est donc : une conversation ouverte à la fois, dans la carte.
 * `active === null` montre la liste. Sont partis avec les fenêtres : la
 * réduction, la capacité, le suivi des instants de dernier contact, et le
 * plafond d'éviction.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'INVARIANT SURVIT, MAIS IL A CHANGÉ DE PORTEUR : RIEN NE SE PERD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une fenêtre réduite gardait son texte en cours de frappe. Avec un seul
 * panneau, passer d'une conversation à l'autre DÉMONTE la précédente — le
 * texte tapé disparaîtrait sans un mot, ce qui est très exactement ce que le
 * modèle à fenêtres refusait.
 *
 * Les brouillons de frappe sont donc remontés ICI, dans l'état, par
 * conversation. C'est la seule raison d'être de `drafts` : sans lui, « un seul
 * bloc » se paierait d'une perte silencieuse.
 *
 * ⚠️ **Les PIÈCES suivent le même chemin depuis le lot 05** (`media`). Elles
 * vivaient dans un `useState` du composeur : changer de conversation perdait
 * un fichier de 20 Mo qui venait de FINIR de monter. Seule leur FICHE voyage
 * ici (nom, poids, type, sort du téléversement) — les octets restent dans le
 * registre de `messagerie-media-draft.ts`, hors de tout stockage.
 *
 * Fonctions PURES : chacune rend un nouvel état, ou LA MÊME RÉFÉRENCE quand
 * rien ne change — c'est ce qui permet à `useSyncExternalStore` de ne pas
 * re-rendre pour rien.
 *
 * Un seul import, et lui-même sans import : `messagerie-media-draft.ts`. Ce
 * module ne connaît toujours que des données.
 */

import {
	initialMediaDrafts,
	mediaFor,
	parseMediaDrafts,
	reconcileMediaDrafts,
	setMediaFor,
	updateMediaFor,
	type MediaDraftItem,
	type MediaDraftsState,
} from "./messagerie-media-draft"

/** En deçà, la messagerie ne se rend pas : la carte n'aurait pas sa place. */
export const DOCK_MIN_VIEWPORT_PX = 960

/**
 * Clé d'une conversation : `chat:<id>` pour un fil 1:1 existant,
 * `draft:<handle>` pour une conversation qu'on s'apprête à ouvrir,
 * `groupe:<threadId>` pour une conversation de GROUPE.
 *
 * Le brouillon est une VRAIE conversation et non un état à part : sans lui,
 * cliquer « Message » sur un profil devrait créer un fil vide pour avoir
 * quelque chose à afficher — or `initiateChat` exige un message initial, et
 * c'est la bonne sémantique (un fil existe parce que quelqu'un a écrit).
 *
 * ⚠️ Le brouillon porte le HANDLE, pas l'identifiant d'utilisateur. Il l'a
 * porté jusqu'au 2026-08-12, et le brouillon ne pouvait alors pas devenir un
 * fil : `startThreadWithHandle` — la seule mutation qui ouvre un fil depuis le
 * réseau — adresse par handle, et rien n'expose la traduction inverse. Le
 * handle est d'ailleurs l'adresse publique partout ailleurs (profil, mention).
 *
 * ⚠️ La clé de groupe est OPAQUE : rien d'autre que `parseKey` n'a le droit
 * de la découper. Le 1:1 ne change pas — `groupe:` est une TROISIÈME forme,
 * jamais une réinterprétation des deux premières.
 */
export type ConversationKey = string

export function chatKey(chatId: string): ConversationKey {
	return `chat:${chatId}`
}

export function draftKey(handle: string): ConversationKey {
	return `draft:${handle}`
}

export function groupeKey(threadId: string): ConversationKey {
	return `groupe:${threadId}`
}

/** Canal commercial distinct des fils personnels et des groupes. */
export function commercialKey(threadId: string): ConversationKey { return `commerce:${threadId}` }

/** Injection de destination uniquement : le dock personnel conserve ses trois genres. */
export function parseCommercialKey(key: ConversationKey): string | null {
	return key.startsWith("commerce:") && key.length > "commerce:".length ? key.slice("commerce:".length) : null
}

/**
 * CC-5 (ADR-0025) : conversation CONTEXTUELLE (mise en relation ouverte par un objet), troisième
 * famille distincte des fils personnels, des groupes et du canal commercial. Même doctrine que
 * `commercialKey` : injection de destination seulement — `parseKey` ne la reconnaît pas, le dock
 * personnel ne l'interprète jamais, et aucun identifiant n'est converti d'une famille à l'autre.
 */
export function contextualConversationKey(threadId: string): ConversationKey { return `contexte:${threadId}` }

/** L'identifiant du fil contextuel d'une clé, ou `null` pour toute autre famille. */
export function parseContextualConversationKey(key: ConversationKey): string | null {
	return key.startsWith("contexte:") && key.length > "contexte:".length ? key.slice("contexte:".length) : null
}

/**
 * Identité exacte d'un acquittement de lecture à envoyer.
 *
 * Le résultat d'un hook TanStack Mutation change d'identité à chaque rendu :
 * il ne doit donc jamais servir seul de dépendance à l'effet qui appelle la
 * mutation. Cette clé lie l'intention au dernier message réellement affiché.
 * Tant que ce message ne change pas, un rendu, StrictMode ou une reconnexion
 * ne crée pas une nouvelle intention.
 */
export function readReceiptKey(args: {
	chatId: string | null
	latestMessageId: string | null
	open: boolean
	unreadCount: number
}): string | null {
	if (
		!args.open ||
		args.chatId === null ||
		args.latestMessageId === null ||
		args.unreadCount <= 0
	) {
		return null
	}
	return `${args.chatId}:${args.latestMessageId}`
}

export function parseKey(
	key: ConversationKey,
):
	| { kind: "chat"; chatId: string }
	| { kind: "draft"; handle: string }
	| { kind: "groupe"; threadId: string }
	| null {
	const at = key.indexOf(":")
	if (at <= 0) return null
	const kind = key.slice(0, at)
	const id = key.slice(at + 1)
	if (id.length === 0) return null
	if (kind === "chat") return { kind: "chat", chatId: id }
	if (kind === "draft") return { kind: "draft", handle: id }
	if (kind === "groupe") return { kind: "groupe", threadId: id }
	return null
}

/**
 * Ce que la carte montre. Une UNION, et non deux drapeaux : « en train de
 * composer » et « une conversation ouverte » s'excluent, et deux booléens
 * laisseraient exister l'état où les deux sont vrais.
 *
 * `composeGroupe` est une QUATRIÈME branche, pas un mode de `compose` : les
 * deux composeurs n'ont ni la même source (annuaire publié vs mes connexions)
 * ni la même sortie (un brouillon vs une création immédiate).
 */
export type DockView =
	| { kind: "list" }
	| { kind: "conversation"; key: ConversationKey }
	| { kind: "compose" }
	| { kind: "composeGroupe" }

export interface DockState {
	/** La carte est-elle dépliée ? Repliée, elle montre en-tête + navigation. */
	open: boolean
	/**
	 * La carte est-elle DÉTACHÉE en fenêtre flottante « format smartphone » ?
	 * Ancrée (false), elle vit dans le rail droit d'iRéseau ; détachée, elle
	 * flotte au-dessus de la page (portail) et c'est LÀ SEULEMENT que la
	 * rangée des Statuts s'affiche. Persisté : recharger la page ne doit pas
	 * ré-ancrer une fenêtre qu'on vient de détacher.
	 */
	floating: boolean
	/** Ce qui est affiché. */
	view: DockView
	/** Le texte en cours de frappe, par conversation. Vide = absent. */
	drafts: Record<ConversationKey, string>
	/**
	 * Les PIÈCES en cours d'ajout, par conversation — leur fiche seulement.
	 * Absente = aucune pièce (cf. `messagerie-media-draft.ts`).
	 */
	media: MediaDraftsState
}

export function initialDockState(): DockState {
	// Dépliée d'emblée : la carte occupe une cellule qui lui est RÉSERVÉE dans
	// l'en-tête d'iRéseau, elle ne recouvre rien. Le repli n'a plus de raison
	// d'être le défaut — il l'était du temps où la carte flottait sur le contenu.
	return {
		open: true,
		floating: false,
		view: { kind: "list" },
		drafts: {},
		media: initialMediaDrafts(),
	}
}

/**
 * Détache la carte en fenêtre flottante, ou la ré-ancre dans le rail.
 *
 * Détacher DÉPLIE : une fenêtre flottante repliée ne serait qu'une barre qui
 * recouvre la page pour zéro contenu. Le rail, lui, ne garde aucun talon : son
 * contenu remonte dès que la fenêtre est détachée.
 * Ré-ancrer CONSERVE `open` : on retrouve la carte comme on l'avait laissée.
 * Même-référence quand rien ne change (contrat de tout le module).
 */
export function setFloating(state: DockState, floating: boolean): DockState {
	if (state.floating === floating) return state
	if (floating) return { ...state, floating: true, open: true }
	return { ...state, floating: false }
}

/** La conversation affichée, ou `null` si l'on est ailleurs. */
export function activeKey(state: DockState): ConversationKey | null {
	return state.view.kind === "conversation" ? state.view.key : null
}

/** Ouvre une conversation dans la carte, et déplie la carte au passage. */
export function openConversation(
	state: DockState,
	key: ConversationKey,
): DockState {
	if (parseKey(key) === null) return state
	if (activeKey(state) === key && state.open) return state
	return { ...state, open: true, view: { kind: "conversation", key } }
}

/** Ouvre le choix d'un destinataire — le « nouveau message » de Messenger. */
export function openCompose(state: DockState): DockState {
	if (state.view.kind === "compose" && state.open) return state
	return { ...state, open: true, view: { kind: "compose" } }
}

/** Ouvre la composition d'un GROUPE — membres puis titre, dans la carte. */
export function openComposeGroupe(state: DockState): DockState {
	if (state.view.kind === "composeGroupe" && state.open) return state
	return { ...state, open: true, view: { kind: "composeGroupe" } }
}

/** Revient à la liste. Le texte en cours de frappe, lui, RESTE. */
export function backToList(state: DockState): DockState {
	return state.view.kind === "list" ? state : { ...state, view: { kind: "list" } }
}

export function toggleOpen(state: DockState): DockState {
	/* Se replier signifie revenir à la porte iChat. Une conversation ou un
	   composeur caché supprimerait la barre des quatre briques et laisserait
	   un état sans issue ; les textes restent conservés dans drafts. */
	if (state.open) return { ...state, open: false, view: { kind: "list" } }
	return { ...state, open: true }
}

export function setOpen(state: DockState, open: boolean): DockState {
	if (open) return state.open ? state : { ...state, open: true }
	if (!state.open && state.view.kind === "list") return state
	return { ...state, open: false, view: { kind: "list" } }
}

/** Le texte en cours de frappe d'une conversation — jamais `undefined`. */
export function draftTextFor(state: DockState, key: ConversationKey): string {
	return state.drafts[key] ?? ""
}

/**
 * Mémorise le texte en cours de frappe.
 *
 * Un texte VIDE retire l'entrée plutôt que d'en stocker une vide : sans cela,
 * ouvrir puis quitter dix conversations laisserait dix entrées mortes dans le
 * stockage de session.
 */
export function setDraftText(
	state: DockState,
	key: ConversationKey,
	text: string,
): DockState {
	const current = state.drafts[key] ?? ""
	if (current === text) return state
	const drafts = { ...state.drafts }
	if (text.length === 0) delete drafts[key]
	else drafts[key] = text
	return { ...state, drafts }
}

/** Les pièces en cours d'ajout d'une conversation — jamais `undefined`. */
export function draftMediaFor(
	state: DockState,
	key: ConversationKey,
): readonly MediaDraftItem[] {
	return mediaFor(state.media, key)
}

/**
 * Applique un geste aux pièces d'une conversation (ajout, retrait, montée,
 * échec — les gestes eux-mêmes vivent dans `messagerie-media-draft.ts`).
 *
 * ⚠️ Les OCTETS ne passent pas par ici. L'appelant confie le `File` au
 * registre runtime AVANT de notifier, sans quoi le rendu qui suit ne le
 * trouverait pas.
 */
export function updateDraftMedia(
	state: DockState,
	key: ConversationKey,
	transition: (items: readonly MediaDraftItem[]) => readonly MediaDraftItem[],
): DockState {
	const media = updateMediaFor(state.media, key, transition)
	return media === state.media ? state : { ...state, media }
}

/**
 * Le brouillon devient un vrai fil : la conversation `draft:<handle>` prend la
 * clé `chat:<chatId>`, et son texte en cours de frappe le suit.
 *
 * ⚠️ Le texte doit suivre, sinon la promotion elle-même perdrait la frappe —
 * l'invariant tomberait à l'endroit précis où il est le plus attendu.
 */
export function promoteDraft(
	state: DockState,
	handle: string,
	chatId: string,
): DockState {
	const from = draftKey(handle)
	const to = chatKey(chatId)
	const pending = state.drafts[from]
	const pieces = mediaFor(state.media, from)
	const regardeLeBrouillon = activeKey(state) === from
	if (!regardeLeBrouillon && pending === undefined && pieces.length === 0) {
		return state
	}

	const drafts = { ...state.drafts }
	delete drafts[from]
	if (pending !== undefined && pending.length > 0) drafts[to] = pending

	// ⚠️ Les pièces suivent le texte, et pour la même raison : la promotion
	// est l'instant précis où l'invariant est le plus attendu. Une pièce déjà
	// MONTÉE laissée sur l'ancienne clé serait un blob payé pour rien.
	let media = state.media
	if (pieces.length > 0) {
		media = setMediaFor(setMediaFor(media, from, []), to, pieces)
	}

	return {
		...state,
		drafts,
		media,
		view: regardeLeBrouillon ? { kind: "conversation", key: to } : state.view,
	}
}

/**
 * Retire ce qui ne correspond plus à un fil vivant — un fil archivé, un
 * correspondant bloqué entre-temps, un groupe quitté. Les BROUILLONS
 * survivent toujours : ils ne correspondent à rien côté serveur, par
 * construction.
 *
 * ⚠️ DEUX sources de vérité depuis les groupes — l'appelant ne doit
 * réconcilier que lorsque LES DEUX listes sont chargées : passer une liste de
 * groupes encore vide parce que sa query n'a pas répondu ferait passer tous
 * les fils de groupe pour morts.
 */
export function reconcile(
	state: DockState,
	known: {
		chatIds: readonly string[]
		groupeIds: readonly string[]
	},
): DockState {
	const vivants = new Set<ConversationKey>([
		...known.chatIds.map((id) => chatKey(id)),
		...known.groupeIds.map((id) => groupeKey(id)),
	])
	const lives = (key: ConversationKey): boolean => {
		const parsed = parseKey(key)
		if (parsed === null) return false
		return parsed.kind === "draft" || vivants.has(key)
	}

	const active = activeKey(state)
	const activeLives = active === null || lives(active)
	const deadDrafts = Object.keys(state.drafts).filter((key) => !lives(key))
	// Les PIÈCES d'un fil mort tombent avec lui. Leurs octets, eux, se
	// libèrent dans le magasin (`forgetRemovedMedia`) : un module pur ne
	// révoque pas d'URL.
	const media = reconcileMediaDrafts(state.media, lives)
	if (activeLives && deadDrafts.length === 0 && media === state.media) {
		return state
	}

	const drafts = { ...state.drafts }
	for (const key of deadDrafts) delete drafts[key]
	return {
		...state,
		drafts,
		media,
		view: activeLives ? state.view : { kind: "list" },
	}
}

/**
 * ⚠️ Version 6 : les PIÈCES entrent dans le brouillon (`media`). Version 5,
 * le FLOTTEMENT ; version 4, les conversations de GROUPE. Un état antérieur
 * n'est pas convertible ; la relecture le remplace par l'état initial, sans
 * bruit — on y perd au pire les fils ouverts d'une session en cours.
 * La clé de stockage (`dock-store.ts`) porte LE MÊME numéro — les deux
 * bougent ensemble, jamais l'un sans l'autre.
 */
export const SERIAL_VERSION = 6

export function serializeDock(state: DockState): string {
	return JSON.stringify({ v: SERIAL_VERSION, ...state })
}

/**
 * Relit un état persisté. TOUT échec rend l'état initial, sans jamais lever :
 * une messagerie qui refuse de s'afficher parce qu'une clé de session a mal
 * vieilli serait pire que la messagerie vide.
 */
export function parseDock(raw: string | null | undefined): DockState {
	if (raw === null || raw === undefined || raw.length === 0) {
		return initialDockState()
	}
	try {
		const parsed = JSON.parse(raw) as unknown
		if (typeof parsed !== "object" || parsed === null) return initialDockState()
		const record = parsed as Record<string, unknown>
		if (record.v !== SERIAL_VERSION) return initialDockState()

		// Une vue abîmée retombe sur la LISTE : c'est le seul état qui ne
		// dépende de rien d'autre, donc le seul qui ne puisse pas mentir.
		let view: DockView = { kind: "list" }
		const vue = record.view
		if (typeof vue === "object" && vue !== null) {
			const v = vue as Record<string, unknown>
			if (v.kind === "compose") view = { kind: "compose" }
			else if (v.kind === "composeGroupe") view = { kind: "composeGroupe" }
			else if (
				v.kind === "conversation" &&
				typeof v.key === "string" &&
				parseKey(v.key) !== null
			) {
				view = { kind: "conversation", key: v.key }
			}
		}

		const drafts: Record<ConversationKey, string> = {}
		if (typeof record.drafts === "object" && record.drafts !== null) {
			for (const [key, value] of Object.entries(
				record.drafts as Record<string, unknown>,
			)) {
				if (parseKey(key) === null) continue
				if (typeof value !== "string" || value.length === 0) continue
				drafts[key] = value
			}
		}

		// Les pièces se relisent avec la MÊME garde de clé que les textes : une
		// conversation dont la clé ne se lit plus n'a pas de brouillon.
		const media = parseMediaDrafts(
			record.media,
			(key) => parseKey(key) !== null,
		)

		// `open` par DÉFAUT vrai : une valeur absente ou abîmée ne doit pas
		// replier une carte que l'agent n'a jamais repliée. `floating` par
		// DÉFAUT faux — l'inverse détacherait la carte de qui ne l'a jamais
		// demandé.
		return {
			open: record.open !== false,
			floating: record.floating === true,
			view,
			drafts,
			media,
		}
	} catch {
		return initialDockState()
	}
}
