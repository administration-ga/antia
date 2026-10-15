// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-media-draft.ts @ ad2e7fdc2 — adaptations : aucune dans le code (copie textuelle) ; en-tête de provenance.
/**
 * messagerie-media-draft — les PIÈCES d'un message en cours d'écriture.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le texte en cours de frappe vit dans le store depuis le passage à UN SEUL
 * bloc (`messagerie-dock.ts`, `drafts`) : sans lui, passer d'une conversation
 * à l'autre démontait le composeur et mangeait la frappe. Les PIÈCES, elles,
 * sont restées dans un `useState` du composeur (`MessageComposer.tsx`) — donc
 * perdues au même démontage, y compris un fichier de 20 Mo qui venait de
 * FINIR de monter.
 *
 * Deux natures, deux endroits :
 *  · ce qui SE SÉRIALISE — nom, poids, type, et le sort du téléversement
 *    (`pending` / `uploaded` / `failed`) — voyage dans l'état du dock et
 *    survit au rechargement ;
 *  · ce qui NE SE SÉRIALISE PAS — l'objet `File` et son aperçu `blob:` — vit
 *    dans un registre de MODULE, hors de l'état, et meurt avec l'onglet.
 *
 * C'est exactement le partage de `post-draft.ts` / `post-draft-store.ts`
 * (brouillons de publication, lot 04) ; on en reprend le vocabulaire plutôt
 * que d'en inventer un second.
 *
 * ⚠️ **`uploaded` est ce qui rend le RENVOI sûr.** Au second essai, l'octet
 * n'est pas retéléversé : on réutilise le `storageId` déjà obtenu. Sans lui,
 * chaque tentative laisse un blob orphelin que rien ne purge — et après un
 * rechargement, une pièce déjà montée redevient un fichier à rechoisir.
 *
 * ⚠️ **On ne prétend JAMAIS avoir gardé un fichier qu'on n'a plus.** Après un
 * rechargement, une pièce `pending` n'a plus d'octets : elle est ANNONCÉE
 * comme à resélectionner (`unrecoverableMedia`), jamais présentée comme
 * prête. Le nom et le poids qui restent servent à la nommer, pas à l'envoyer.
 *
 * Les transitions sont PURES et rendent LA MÊME RÉFÉRENCE quand rien ne
 * change — c'est ce qui évite un re-rendu pour rien.
 */

/**
 * La clé d'une conversation — `chat:<id>`, `draft:<handle>`,
 * `groupe:<threadId>`. Redite ici en `string` plutôt qu'importée de
 * `messagerie-dock.ts` : c'est ce dernier qui dépend de ce module, jamais
 * l'inverse, et un cycle d'imports entre deux modules purs ne s'explique pas.
 */
export type MediaDraftKey = string

/** Le sort d'une pièce vis-à-vis du stockage Convex. */
export type MediaDraftUpload =
	| { status: "pending" }
	| { status: "uploaded"; storageId: string; uploadedAt: number }
	| { status: "failed" }

/** Ce qui SURVIT au rechargement : la fiche d'une pièce, jamais ses octets. */
export interface MediaDraftItem {
	/** Identité LOCALE — jamais envoyée au serveur, clé du registre runtime. */
	localId: string
	fileName: string
	mimeType: string
	sizeBytes: number
	/** Durée d'un message VOCAL, en millisecondes — absente sinon. */
	durationMs?: number
	upload: MediaDraftUpload
}

/** Les pièces de chaque conversation. Absente = aucune pièce. */
export type MediaDraftsState = Readonly<
	Record<MediaDraftKey, readonly MediaDraftItem[]>
>

/**
 * ⚠️ UNE seule instance, gelée : `mediaFor` rend cette liste pour toute
 * conversation vierge, et un tableau neuf à chaque lecture ferait boucler les
 * `useMemo` qui en dépendent.
 */
const AUCUNE: readonly MediaDraftItem[] = Object.freeze([])

export function initialMediaDrafts(): MediaDraftsState {
	return {}
}

export function mediaFor(
	state: MediaDraftsState,
	key: MediaDraftKey,
): readonly MediaDraftItem[] {
	return state[key] ?? AUCUNE
}

/**
 * Une pièce neuve, `pending` — ou déjà `uploaded` quand l'octet est monté et
 * que seule la mutation a échoué (cas du message vocal renvoyé).
 *
 * L'identité locale est tirée ici : le compteur évite que deux fichiers
 * choisis dans la même milliseconde partagent une clé.
 */
let compteur = 0
export function newMediaItem(entry: {
	file: { name: string; size: number; type: string }
	durationMs?: number
	uploaded?: { storageId: string; uploadedAt?: number }
	now?: number
}): MediaDraftItem {
	compteur += 1
	const now = entry.now ?? Date.now()
	return {
		localId: `media-${String(now)}-${String(compteur)}`,
		fileName: entry.file.name,
		mimeType: entry.file.type,
		sizeBytes: entry.file.size,
		...(entry.durationMs === undefined ? {} : { durationMs: entry.durationMs }),
		upload:
			entry.uploaded === undefined
				? { status: "pending" }
				: {
						status: "uploaded",
						storageId: entry.uploaded.storageId,
						uploadedAt: entry.uploaded.uploadedAt ?? now,
					},
	}
}

// ═══════════════════════════════════════════════════════════════
// Les transitions d'UNE liste — le geste, sans la conversation
// ═══════════════════════════════════════════════════════════════

export function addMediaItems(
	items: readonly MediaDraftItem[],
	ajouts: readonly MediaDraftItem[],
): readonly MediaDraftItem[] {
	return ajouts.length === 0 ? items : [...items, ...ajouts]
}

export function removeMediaItem(
	items: readonly MediaDraftItem[],
	localId: string,
): readonly MediaDraftItem[] {
	const reste = items.filter((item) => item.localId !== localId)
	return reste.length === items.length ? items : reste
}

/** Retire d'un coup les pièces d'une intention d'envoi ABOUTIE. */
export function removeMediaItems(
	items: readonly MediaDraftItem[],
	localIds: readonly string[],
): readonly MediaDraftItem[] {
	if (localIds.length === 0) return items
	const partis = new Set(localIds)
	const reste = items.filter((item) => !partis.has(item.localId))
	return reste.length === items.length ? items : reste
}

export function markMediaUploaded(
	items: readonly MediaDraftItem[],
	localId: string,
	storageId: string,
	uploadedAt: number,
): readonly MediaDraftItem[] {
	return items.map((item) =>
		item.localId === localId
			? { ...item, upload: { status: "uploaded", storageId, uploadedAt } }
			: item,
	)
}

export function markMediaFailed(
	items: readonly MediaDraftItem[],
	localId: string,
): readonly MediaDraftItem[] {
	return items.map((item) =>
		// ⚠️ Une pièce DÉJÀ montée ne redevient jamais « en échec » : son
		// `storageId` reste bon, et l'oublier ferait retéléverser au renvoi.
		item.localId === localId && item.upload.status !== "uploaded"
			? { ...item, upload: { status: "failed" } }
			: item,
	)
}

/**
 * Les pièces qu'on ne peut PLUS envoyer : leur fichier a quitté la mémoire
 * (rechargement, onglet restauré) et elles n'ont jamais été téléversées.
 *
 * ⚠️ Une pièce `uploaded` n'en fait pas partie : son octet est au stockage,
 * l'envoi n'a plus besoin du fichier.
 */
export function unrecoverableMedia(
	items: readonly MediaDraftItem[],
	hasFile: (localId: string) => boolean,
): readonly MediaDraftItem[] {
	return items.filter(
		(item) => item.upload.status !== "uploaded" && !hasFile(item.localId),
	)
}

/** Le `storageId` d'une pièce déjà montée — `null` s'il reste à monter. */
export function uploadedStorageId(item: MediaDraftItem): string | null {
	return item.upload.status === "uploaded" ? item.upload.storageId : null
}

// ═══════════════════════════════════════════════════════════════
// Les transitions de la COLLECTION — par conversation
// ═══════════════════════════════════════════════════════════════

/**
 * Remplace la liste d'une conversation. Une liste VIDE retire l'entrée plutôt
 * que d'en stocker une vide — même doctrine que `setDraftText` : sans cela,
 * dix conversations ouvertes puis quittées laissent dix entrées mortes.
 */
export function setMediaFor(
	state: MediaDraftsState,
	key: MediaDraftKey,
	items: readonly MediaDraftItem[],
): MediaDraftsState {
	const courant = state[key] ?? AUCUNE
	if (courant === items) return state
	if (items.length === 0) {
		if (state[key] === undefined) return state
		const suite = { ...state }
		delete suite[key]
		return suite
	}
	return { ...state, [key]: items }
}

/** Applique un geste à la liste d'une conversation. */
export function updateMediaFor(
	state: MediaDraftsState,
	key: MediaDraftKey,
	transition: (items: readonly MediaDraftItem[]) => readonly MediaDraftItem[],
): MediaDraftsState {
	return setMediaFor(state, key, transition(state[key] ?? AUCUNE))
}

/**
 * Ne garde que les conversations encore VIVANTES.
 *
 * Même contrat que `reconcile` (messagerie-dock.ts) et appelé par lui : un
 * fil archivé, un groupe quitté n'ont plus de brouillon de pièces. Rend LA
 * MÊME référence quand rien ne tombe.
 */
export function reconcileMediaDrafts(
	state: MediaDraftsState,
	lives: (key: MediaDraftKey) => boolean,
): MediaDraftsState {
	const morts = Object.keys(state).filter((key) => !lives(key))
	if (morts.length === 0) return state
	const suite = { ...state }
	for (const key of morts) delete suite[key]
	return suite
}

// ═══════════════════════════════════════════════════════════════
// Sérialisation — le SORT d'une pièce, jamais ses octets
// ═══════════════════════════════════════════════════════════════

function parseUpload(value: unknown): MediaDraftUpload | null {
	if (typeof value !== "object" || value === null) return null
	const record = value as Record<string, unknown>
	if (record.status === "pending") return { status: "pending" }
	if (record.status === "failed") return { status: "failed" }
	if (
		record.status === "uploaded" &&
		typeof record.storageId === "string" &&
		record.storageId.length > 0 &&
		typeof record.uploadedAt === "number"
	) {
		return {
			status: "uploaded",
			storageId: record.storageId,
			uploadedAt: record.uploadedAt,
		}
	}
	return null
}

function parseItem(value: unknown): MediaDraftItem | null {
	if (typeof value !== "object" || value === null) return null
	const record = value as Record<string, unknown>
	const upload = parseUpload(record.upload)
	if (
		upload === null ||
		typeof record.localId !== "string" ||
		record.localId.length === 0 ||
		typeof record.fileName !== "string" ||
		typeof record.mimeType !== "string" ||
		typeof record.sizeBytes !== "number"
	) {
		return null
	}
	return {
		localId: record.localId,
		fileName: record.fileName,
		mimeType: record.mimeType,
		sizeBytes: record.sizeBytes,
		...(typeof record.durationMs === "number"
			? { durationMs: record.durationMs }
			: {}),
		upload,
	}
}

/**
 * Relit les pièces persistées. TOUT échec rend une collection vide, jamais
 * une exception : une messagerie qui refuse de s'afficher parce qu'une clé de
 * session a mal vieilli serait pire que la messagerie sans ses pièces.
 *
 * `isKey` vient de l'appelant (`parseKey` du dock) : ce module ne sait pas ce
 * qu'est une conversation valide, et ne doit pas l'apprendre.
 */
export function parseMediaDrafts(
	value: unknown,
	isKey: (key: string) => boolean,
): MediaDraftsState {
	if (typeof value !== "object" || value === null) return {}
	const out: Record<MediaDraftKey, readonly MediaDraftItem[]> = {}
	for (const [key, brut] of Object.entries(value as Record<string, unknown>)) {
		if (!isKey(key)) continue
		if (!Array.isArray(brut)) continue
		const items = brut
			.map((entry) => parseItem(entry))
			.filter((entry): entry is MediaDraftItem => entry !== null)
		if (items.length > 0) out[key] = items
	}
	return out
}

// ═══════════════════════════════════════════════════════════════
// Le registre RUNTIME — `File` et `blob:`, jamais persistés
// ═══════════════════════════════════════════════════════════════

interface RuntimeMedia {
	file: File
	previewUrl: string | null
}

const runtime = new Map<string, RuntimeMedia>()

/** Confie le fichier au registre. À appeler AVANT de notifier le rendu. */
export function rememberMediaFile(
	localId: string,
	file: File,
	previewUrl: string | null = null,
): void {
	runtime.set(localId, { file, previewUrl })
}

export function mediaFile(localId: string): File | null {
	return runtime.get(localId)?.file ?? null
}

export function mediaPreview(localId: string): string | null {
	return runtime.get(localId)?.previewUrl ?? null
}

export function hasMediaFile(localId: string): boolean {
	return runtime.has(localId)
}

/** Libère un fichier ET son aperçu — un `blob:` non révoqué fuit. */
export function forgetMediaFile(localId: string): void {
	const entree = runtime.get(localId)
	if (entree === undefined) return
	runtime.delete(localId)
	if (entree.previewUrl === null) return
	try {
		URL.revokeObjectURL(entree.previewUrl)
	} catch {
		// `URL.revokeObjectURL` absent (rendu serveur, environnement de test) :
		// rien à libérer, rien à signaler.
	}
}

/**
 * Libère ce qui a disparu entre DEUX états — le seul chemin de nettoyage des
 * pièces d'une conversation morte (`reconcile`) ou d'un envoi abouti.
 *
 * Comparer les deux états plutôt que d'exiger la liste des partants : c'est
 * l'appelant qui appliquerait la soustraction, et il l'oublierait un jour.
 */
export function forgetRemovedMedia(
	avant: MediaDraftsState,
	apres: MediaDraftsState,
): void {
	if (avant === apres) return
	const vivants = new Set<string>()
	for (const items of Object.values(apres)) {
		for (const item of items) vivants.add(item.localId)
	}
	for (const items of Object.values(avant)) {
		for (const item of items) {
			if (!vivants.has(item.localId)) forgetMediaFile(item.localId)
		}
	}
}

/** Remise à zéro complète — tests seulement. */
export function resetMediaRuntimeForTests(): void {
	for (const localId of [...runtime.keys()]) forgetMediaFile(localId)
	compteur = 0
}
