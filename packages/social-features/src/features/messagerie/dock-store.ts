// Dupliqué de socle/packages/agent-features/src/features/messagerie/dock-store.ts @ ad2e7fdc2 — adaptations : clés de stockage PRÉFIXÉES PAR LE RÉSEAU (`storagePrefix` de `useNetwork()`) au lieu du préfixe de l'espace agent — configurateur `configureDockStorage(prefix)` appelé par la coque ; avant configuration, l'état vit en mémoire seulement (aucune lecture ni écriture de stockage, aucune erreur) et un geste déjà fait est écrit sous la clé du réseau à la configuration ; changer de réseau relit l'état du nouveau réseau et notifie ; chaque geste lit d'abord l'état persisté (il n'écrase plus une session non encore relue) ; clé de la position flottante dérivée du préfixe (`icomFloatPlacementStorageKey(prefix)` remplace la constante `ICOM_FLOAT_PLACEMENT_STORAGE_KEY`).
"use client"

/**
 * dock-store — le singleton d'état du dock, branché à React par
 * `useSyncExternalStore`.
 *
 * Ce fichier ne DÉCIDE rien : il applique les transitions pures de
 * `messagerie-dock.ts` et notifie. Ce qui décide doit vivre là où c'est
 * testable.
 *
 * Un SINGLETON de module, et non un contexte React porteur de l'état : le dock
 * est monté une seule fois — par la coque —, mais les points d'entrée
 * « Message » sont dispersés dans des arbres qui n'en descendent pas tous (une
 * carte de publication, un panneau de relations). Passer par un état de module
 * évite de hisser un provider au-dessus de toute l'application.
 *
 * Persistance en `sessionStorage` : « jusqu'à la prochaine session ». Sans
 * elle, un rechargement perd les fils ouverts ; avec elle, `reconcile`
 * nettoie les fantômes au premier retour de la liste des fils.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN ÉTAT PAR RÉSEAU — `configureDockStorage`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les clés de stockage portent le PRÉFIXE DU RÉSEAU (`useNetwork().
 * storagePrefix`) : deux réseaux ouverts dans le même navigateur ne partagent
 * ni brouillons ni conversation ouverte. Un singleton de module ne lit pas de
 * contexte React : la coque lui donne le préfixe, une fois montée sous le
 * `NetworkProvider` :
 *
 *     configureDockStorage(useNetwork().storagePrefix)
 *
 * Avant cet appel, le magasin FONCTIONNE — en mémoire seulement : on ne sait
 * pas sous quel réseau ranger, et lire une clé au hasard montrerait les
 * brouillons d'un autre réseau. Un geste fait dans cet intervalle n'est pas
 * perdu : il est écrit sous la clé du réseau dès la configuration (il est
 * plus récent que tout ce que le stockage peut tenir).
 */

import { useSyncExternalStore } from "react"
import {
	addMediaItems,
	forgetRemovedMedia,
	markMediaFailed,
	markMediaUploaded,
	newMediaItem,
	rememberMediaFile,
	removeMediaItem,
	removeMediaItems,
	type MediaDraftItem,
} from "./messagerie-media-draft"
import {
	backToList,
	chatKey,
	draftKey,
	groupeKey,
	initialDockState,
	openCompose,
	openComposeGroupe,
	openConversation,
	parseDock,
	promoteDraft,
	reconcile,
	serializeDock,
	setDraftText,
	setFloating,
	setOpen,
	toggleOpen,
	updateDraftMedia,
	type ConversationKey,
	type DockState,
} from "./messagerie-dock"

/**
 * ⚠️ La clé suit la VERSION de la forme persistée — `v6` depuis l'entrée des
 * PIÈCES du brouillon (`media`) ; `v5` était le FLOTTEMENT (la fenêtre
 * détachée format smartphone), `v4` les conversations de GROUPE. `parseDock`
 * refuserait de toute façon un état antérieur, mais changer la clé évite de
 * faire cohabiter deux sens sous un même nom dans le stockage de session. Les
 * deux numéros doivent donc rester alignés — `SERIAL_VERSION`
 * (messagerie-dock.ts) et ce suffixe bougent ENSEMBLE.
 */
export const DOCK_STORAGE_SUFFIX = "messagerie-dock:v6"

/**
 * La position flottante a sa propre durée de vie (l'onglet) et son propre
 * format tolérant. Elle reste volontairement HORS de l'état du dock : ajouter
 * des pixels au DockState invaliderait inutilement conversations et
 * brouillons.
 */
export const ICOM_FLOAT_PLACEMENT_STORAGE_SUFFIX = "icom-floating-placement:v1"
export const ICOM_FLOAT_PLACEMENT_STORAGE = "session" as const

/** La clé de la position flottante d'iCom, dans le réseau de ce préfixe. */
export function icomFloatPlacementStorageKey(prefix: string): string {
	return `${prefix}${ICOM_FLOAT_PLACEMENT_STORAGE_SUFFIX}`
}

/** La clé de l'état du dock, dans le réseau de ce préfixe. */
export function dockStorageKey(prefix: string): string {
	return `${prefix}${DOCK_STORAGE_SUFFIX}`
}

let state: DockState = initialDockState()
/** L'état persisté du réseau courant a-t-il été relu ? */
let hydrated = false
/** Le préfixe du réseau ; `null` tant que la coque ne l'a pas donné. */
let storagePrefix: string | null = null
/** Un geste a-t-il eu lieu avant que le réseau soit connu ? */
let touchedBeforeStorage = false
const listeners = new Set<() => void>()

function currentKey(): string | null {
	return storagePrefix === null ? null : dockStorageKey(storagePrefix)
}

function persist(): void {
	const key = currentKey()
	if (key === null) return
	try {
		window.sessionStorage.setItem(key, serializeDock(state))
	} catch {
		// Stockage refusé (navigation privée, quota, rendu serveur) : le dock
		// reste utilisable, il perdra seulement ses fenêtres au rechargement.
		// Jamais une erreur à l'écran pour ça.
	}
}

function notify(): void {
	for (const listener of listeners) listener()
}

function emit(next: DockState): void {
	if (next === state) return
	const precedent = state
	state = next
	// Les OCTETS d'une pièce qui vient de quitter l'état se libèrent ici, et
	// nulle part ailleurs : un module pur ne révoque pas d'URL, et laisser
	// l'appelant soustraire les partants ferait oublier un cas un jour.
	forgetRemovedMedia(precedent.media, state.media)
	if (currentKey() === null) touchedBeforeStorage = true
	else persist()
	notify()
}

/**
 * Relit l'état persisté du réseau courant, une fois. Sans réseau connu, rien
 * n'est lu : l'état reste celui de la mémoire.
 */
function hydrate(): void {
	if (hydrated) return
	const key = currentKey()
	if (key === null) return
	hydrated = true
	if (touchedBeforeStorage) {
		// Un geste a précédé la configuration : il est plus récent que tout ce
		// que le stockage peut tenir — on l'écrit plutôt que de l'écraser.
		touchedBeforeStorage = false
		persist()
		return
	}
	try {
		state = parseDock(window.sessionStorage.getItem(key))
	} catch {
		state = initialDockState()
	}
}

/**
 * Donne au magasin le préfixe de stockage du RÉSEAU courant
 * (`useNetwork().storagePrefix`). Appelé par la coque, sous le
 * `NetworkProvider` ; sans effet quand le préfixe ne change pas.
 *
 * Changer de réseau relit l'état de l'autre réseau et notifie les vues : un
 * brouillon d'un réseau ne se montre jamais dans un autre. Les octets des
 * pièces du réseau quitté se libèrent comme au retrait d'une pièce.
 */
export function configureDockStorage(prefix: string): void {
	if (prefix === storagePrefix) return
	const etaitConfigure = storagePrefix !== null
	storagePrefix = prefix
	hydrated = false
	if (etaitConfigure) {
		// L'état en mémoire est celui de l'AUTRE réseau : il n'a rien à écrire
		// ici, on relit celui de ce réseau.
		touchedBeforeStorage = false
		const precedent = state
		state = initialDockState()
		hydrate()
		forgetRemovedMedia(precedent.media, state.media)
		notify()
		return
	}
	if (touchedBeforeStorage || listeners.size > 0) {
		// Des vues lisent déjà l'état (ou un geste l'a modifié) : on relit (ou
		// on écrit) maintenant, et on leur dit de se rafraîchir.
		const precedent = state
		hydrate()
		if (state !== precedent) forgetRemovedMedia(precedent.media, state.media)
		notify()
	}
}

/** Le préfixe configuré, ou `null` — pour la coque et les tests. */
export function dockStoragePrefix(): string | null {
	return storagePrefix
}

/**
 * Applique un geste à l'état COURANT — relu d'abord : un geste venu d'un
 * écran où le dock n'est pas encore monté ne doit pas écraser la session
 * persistée avec un état vierge.
 */
function apply(transition: (current: DockState) => DockState): void {
	hydrate()
	emit(transition(state))
}

function subscribe(listener: () => void): () => void {
	hydrate()
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSnapshot(): DockState {
	hydrate()
	return state
}

/**
 * ⚠️ Instantané SERVEUR figé, et une seule instance : `useSyncExternalStore`
 * exige une référence stable, sans quoi il boucle. Le dock ne se rend de toute
 * façon pas au rendu serveur (`useIsReseauMobile` y répond `null`).
 */
const SERVER_SNAPSHOT = initialDockState()
function getServerSnapshot(): DockState {
	return SERVER_SNAPSHOT
}

export function useDockState(): DockState {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const dockStore = {
	openChat(chatId: string): void {
		apply((current) => openConversation(current, chatKey(chatId)))
	},
	/** ⚠️ Par HANDLE : c'est ce que `startThreadWithHandle` sait adresser. */
	openDraft(handle: string): void {
		apply((current) => openConversation(current, draftKey(handle)))
	},
	/** Une conversation de GROUPE — la clé opaque `groupe:<threadId>`. */
	openGroupe(threadId: string): void {
		apply((current) => openConversation(current, groupeKey(threadId)))
	},
	/** Le « nouveau message » : choisir un destinataire avant d'écrire. */
	openCompose(): void {
		apply(openCompose)
	},
	/** Le « nouveau groupe » : membres puis titre, dans la même carte. */
	openComposeGroupe(): void {
		apply(openComposeGroupe)
	},
	/** Retour à la liste — le texte en cours de frappe RESTE en mémoire. */
	back(): void {
		apply(backToList)
	},
	toggleOpen(): void {
		apply(toggleOpen)
	},
	setOpen(open: boolean): void {
		apply((current) => setOpen(current, open))
	},
	/** Détache la carte en fenêtre flottante — et la DÉPLIE (cf. `setFloating`). */
	detach(): void {
		apply((current) => setFloating(current, true))
	},
	/** Ré-ancre la fenêtre dans le rail, dans l'état de repli où on l'a laissée. */
	reattach(): void {
		apply((current) => setFloating(current, false))
	},
	setDraftText(key: ConversationKey, text: string): void {
		apply((current) => setDraftText(current, key, text))
	},

	/**
	 * Joint des fichiers au brouillon d'une conversation.
	 *
	 * ⚠️ Le `File` va au registre AVANT la notification : le rendu qui suit
	 * doit déjà le trouver, sans quoi la pièce s'afficherait une frame comme
	 * « à resélectionner ».
	 */
	addMedia(
		key: ConversationKey,
		entrees: readonly {
			file: File
			durationMs?: number
			previewUrl?: string
			uploaded?: { storageId: string }
		}[],
	): void {
		if (entrees.length === 0) return
		const pieces: MediaDraftItem[] = []
		for (const entree of entrees) {
			const piece = newMediaItem({
				file: entree.file,
				...(entree.durationMs === undefined
					? {}
					: { durationMs: entree.durationMs }),
				...(entree.uploaded === undefined ? {} : { uploaded: entree.uploaded }),
			})
			rememberMediaFile(piece.localId, entree.file, entree.previewUrl ?? null)
			pieces.push(piece)
		}
		apply((current) =>
			updateDraftMedia(current, key, (items) => addMediaItems(items, pieces)),
		)
	},

	removeMedia(key: ConversationKey, localId: string): void {
		apply((current) =>
			updateDraftMedia(current, key, (items) => removeMediaItem(items, localId)),
		)
	},

	markMediaUploaded(
		key: ConversationKey,
		localId: string,
		storageId: string,
	): void {
		apply((current) =>
			updateDraftMedia(current, key, (items) =>
				markMediaUploaded(items, localId, storageId, Date.now()),
			),
		)
	},

	markMediaFailed(key: ConversationKey, localId: string): void {
		apply((current) =>
			updateDraftMedia(current, key, (items) => markMediaFailed(items, localId)),
		)
	},

	/** Envoi ABOUTI : les pièces de CETTE intention quittent le brouillon. */
	clearMedia(key: ConversationKey, localIds: readonly string[]): void {
		apply((current) =>
			updateDraftMedia(current, key, (items) => removeMediaItems(items, localIds)),
		)
	},
	promoteDraft(handle: string, chatId: string): void {
		apply((current) => promoteDraft(current, handle, chatId))
	},
	/** ⚠️ N'appeler qu'avec les DEUX listes chargées (cf. `reconcile`). */
	reconcile(known: {
		chatIds: readonly string[]
		groupeIds: readonly string[]
	}): void {
		apply((current) => reconcile(current, known))
	},
}
