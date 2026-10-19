// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-media-draft.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	addMediaItems,
	forgetMediaFile,
	forgetRemovedMedia,
	hasMediaFile,
	initialMediaDrafts,
	markMediaFailed,
	markMediaUploaded,
	mediaFile,
	mediaFor,
	mediaPreview,
	newMediaItem,
	parseMediaDrafts,
	reconcileMediaDrafts,
	rememberMediaFile,
	removeMediaItem,
	removeMediaItems,
	resetMediaRuntimeForTests,
	setMediaFor,
	unrecoverableMedia,
	updateMediaFor,
	uploadedStorageId,
	type MediaDraftItem,
} from "./messagerie-media-draft"

/** Un « fichier » minimal : le module ne lit que nom, poids et type. */
function fichier(name: string, size = 1024, type = "image/png"): File {
	return { name, size, type } as unknown as File
}

function item(name: string): MediaDraftItem {
	return newMediaItem({ file: fichier(name), now: 1_700_000_000_000 })
}

/** La même pièce, déjà montée — l'octet est au stockage. */
function itemMonte(name: string, storageId: string): MediaDraftItem {
	const piece = item(name)
	return markMediaUploaded([piece], piece.localId, storageId, 1_234)[0]!
}

const FIL = "chat:c1"

beforeEach(() => {
	resetMediaRuntimeForTests()
})

afterEach(() => {
	resetMediaRuntimeForTests()
	vi.unstubAllGlobals()
})

describe("newMediaItem — la fiche d'une pièce", () => {
	it("naît « en attente », avec le nom, le poids et le type du fichier", () => {
		const piece = newMediaItem({ file: fichier("photo.png", 2048, "image/png") })
		expect(piece.fileName).toBe("photo.png")
		expect(piece.sizeBytes).toBe(2048)
		expect(piece.mimeType).toBe("image/png")
		expect(piece.upload).toEqual({ status: "pending" })
	})

	it("donne une identité DIFFÉRENTE à deux fichiers du même instant", () => {
		const a = newMediaItem({ file: fichier("a.png"), now: 42 })
		const b = newMediaItem({ file: fichier("b.png"), now: 42 })
		expect(a.localId).not.toBe(b.localId)
	})

	it("naît déjà « montée » quand l'octet est passé et que seul l'envoi a échoué", () => {
		const piece = newMediaItem({
			file: fichier("note.webm", 900, "audio/webm"),
			durationMs: 4_200,
			uploaded: { storageId: "st-1", uploadedAt: 7 },
		})
		expect(piece.durationMs).toBe(4_200)
		expect(uploadedStorageId(piece)).toBe("st-1")
	})
})

describe("les gestes sur UNE liste", () => {
	it("ajoute, retire, et rend LA MÊME référence quand rien ne change", () => {
		const a = item("a.png")
		const liste = addMediaItems([], [a])
		expect(liste).toHaveLength(1)
		expect(addMediaItems(liste, [])).toBe(liste)
		expect(removeMediaItem(liste, "inconnu")).toBe(liste)
		expect(removeMediaItem(liste, a.localId)).toHaveLength(0)
	})

	it("retire d'un coup les pièces d'un envoi abouti", () => {
		const a = item("a.png")
		const b = item("b.png")
		const liste = addMediaItems([], [a, b])
		expect(removeMediaItems(liste, [])).toBe(liste)
		expect(removeMediaItems(liste, [a.localId, b.localId])).toHaveLength(0)
	})

	it("marque une pièce montée avec son storageId", () => {
		const a = item("a.png")
		const liste = markMediaUploaded([a], a.localId, "st-9", 1_234)
		expect(liste[0]?.upload).toEqual({
			status: "uploaded",
			storageId: "st-9",
			uploadedAt: 1_234,
		})
	})

	it("ne fait JAMAIS retomber en échec une pièce déjà montée", () => {
		// Sans cette garde, le renvoi retéléverserait l'octet et laisserait un
		// blob orphelin que rien ne purge.
		const a = item("a.png")
		const montee = markMediaUploaded([a], a.localId, "st-9", 1)
		const apres = markMediaFailed(montee, a.localId)
		expect(uploadedStorageId(apres[0]!)).toBe("st-9")
	})

	it("marque en échec une pièce encore en attente", () => {
		const a = item("a.png")
		expect(markMediaFailed([a], a.localId)[0]?.upload).toEqual({
			status: "failed",
		})
	})
})

describe("la collection, par conversation", () => {
	it("range les pièces sous leur conversation et les relit", () => {
		const a = item("a.png")
		const state = setMediaFor(initialMediaDrafts(), FIL, [a])
		expect(mediaFor(state, FIL)).toHaveLength(1)
		expect(mediaFor(state, "chat:autre")).toHaveLength(0)
	})

	it("RETIRE l'entrée quand la liste se vide — pas d'entrée morte en session", () => {
		const a = item("a.png")
		let state = setMediaFor(initialMediaDrafts(), FIL, [a])
		state = updateMediaFor(state, FIL, (items) =>
			removeMediaItem(items, a.localId),
		)
		expect(Object.keys(state)).toHaveLength(0)
	})

	it("rend la MÊME référence quand la transition ne change rien", () => {
		const state = setMediaFor(initialMediaDrafts(), FIL, [item("a.png")])
		expect(updateMediaFor(state, FIL, (items) => items)).toBe(state)
		expect(setMediaFor(state, "chat:vide", [])).toBe(state)
	})

	it("laisse tomber les conversations mortes, et RIEN d'autre", () => {
		let state = setMediaFor(initialMediaDrafts(), FIL, [item("a.png")])
		state = setMediaFor(state, "groupe:g1", [item("b.png")])
		const apres = reconcileMediaDrafts(state, (key) => key === FIL)
		expect(Object.keys(apres)).toEqual([FIL])
		// Même référence quand tout survit : pas de re-rendu pour rien.
		expect(reconcileMediaDrafts(apres, () => true)).toBe(apres)
	})
})

describe("le RECHARGEMENT — ce qui survit, et ce qu'on annonce", () => {
	it("fait l'aller-retour sur le SORT du téléversement, sans les octets", () => {
		const a = item("a.png")
		const b = itemMonte("b.png", "st-7")
		const state = setMediaFor(initialMediaDrafts(), FIL, [a, b])
		const relu = parseMediaDrafts(
			JSON.parse(JSON.stringify(state)) as unknown,
			() => true,
		)
		expect(relu).toEqual(state)
		expect(JSON.stringify(relu)).not.toContain("File")
	})

	it("garde le storageId d'une pièce déjà montée — le renvoi ne remonte rien", () => {
		const a = item("a.png")
		const state = setMediaFor(
			initialMediaDrafts(),
			FIL,
			markMediaUploaded([a], a.localId, "st-42", 5),
		)
		const relu = parseMediaDrafts(
			JSON.parse(JSON.stringify(state)) as unknown,
			() => true,
		)
		expect(uploadedStorageId(mediaFor(relu, FIL)[0]!)).toBe("st-42")
	})

	it("ANNONCE les pièces à resélectionner : montées, non ; en attente, oui", () => {
		const enAttente = item("a.png")
		const montee = itemMonte("b.png", "st-7")
		// Après un rechargement, AUCUN fichier n'est en mémoire.
		const perdues = unrecoverableMedia([enAttente, montee], () => false)
		expect(perdues.map((piece) => piece.fileName)).toEqual(["a.png"])
	})

	it("n'annonce rien tant que le fichier est là", () => {
		const a = item("a.png")
		rememberMediaFile(a.localId, fichier("a.png"))
		expect(unrecoverableMedia([a], hasMediaFile)).toHaveLength(0)
	})

	it("écarte une clé inconnue et une pièce abîmée, sans jamais lever", () => {
		const relu = parseMediaDrafts(
			{
				"chat:ok": [
					{
						localId: "m1",
						fileName: "a.png",
						mimeType: "image/png",
						sizeBytes: 10,
						upload: { status: "pending" },
					},
					{ localId: "m2" },
				],
				"n'importe quoi": [
					{
						localId: "m3",
						fileName: "b.png",
						mimeType: "image/png",
						sizeBytes: 10,
						upload: { status: "pending" },
					},
				],
			},
			(key) => key.startsWith("chat:"),
		)
		expect(Object.keys(relu)).toEqual(["chat:ok"])
		expect(mediaFor(relu, "chat:ok")).toHaveLength(1)
		expect(parseMediaDrafts("cassé", () => true)).toEqual({})
		expect(parseMediaDrafts(null, () => true)).toEqual({})
	})

	it("refuse un « uploaded » sans storageId — il promettrait un envoi impossible", () => {
		const relu = parseMediaDrafts(
			{
				"chat:ok": [
					{
						localId: "m1",
						fileName: "a.png",
						mimeType: "image/png",
						sizeBytes: 10,
						upload: { status: "uploaded" },
					},
				],
			},
			() => true,
		)
		expect(relu).toEqual({})
	})
})

describe("le registre RUNTIME — les octets, hors de l'état", () => {
	it("rend le fichier confié, puis plus rien après l'oubli", () => {
		const a = item("a.png")
		rememberMediaFile(a.localId, fichier("a.png"))
		expect(mediaFile(a.localId)?.name).toBe("a.png")
		forgetMediaFile(a.localId)
		expect(mediaFile(a.localId)).toBeNull()
		expect(hasMediaFile(a.localId)).toBe(false)
	})

	it("RÉVOQUE l'aperçu `blob:` — un objet URL non révoqué fuit", () => {
		const revoke = vi.fn()
		vi.stubGlobal("URL", { revokeObjectURL: revoke })
		const a = item("a.png")
		rememberMediaFile(a.localId, fichier("a.png"), "blob:apercu")
		expect(mediaPreview(a.localId)).toBe("blob:apercu")
		forgetMediaFile(a.localId)
		expect(revoke).toHaveBeenCalledWith("blob:apercu")
	})

	it("libère les octets des pièces DISPARUES entre deux états", () => {
		const a = item("a.png")
		const b = item("b.png")
		rememberMediaFile(a.localId, fichier("a.png"))
		rememberMediaFile(b.localId, fichier("b.png"))
		const avant = setMediaFor(initialMediaDrafts(), FIL, [a, b])
		const apres = updateMediaFor(avant, FIL, (items) =>
			removeMediaItem(items, a.localId),
		)

		forgetRemovedMedia(avant, apres)
		expect(hasMediaFile(a.localId)).toBe(false)
		// Celle qui reste garde ses octets : sinon l'envoi suivant échouerait.
		expect(hasMediaFile(b.localId)).toBe(true)
	})

	it("ne libère RIEN quand l'état n'a pas bougé", () => {
		const a = item("a.png")
		rememberMediaFile(a.localId, fichier("a.png"))
		const state = setMediaFor(initialMediaDrafts(), FIL, [a])
		forgetRemovedMedia(state, state)
		expect(hasMediaFile(a.localId)).toBe(true)
	})

	it("libère tout un fil quand la conversation meurt", () => {
		const a = item("a.png")
		rememberMediaFile(a.localId, fichier("a.png"))
		const avant = setMediaFor(initialMediaDrafts(), FIL, [a])
		forgetRemovedMedia(avant, reconcileMediaDrafts(avant, () => false))
		expect(hasMediaFile(a.localId)).toBe(false)
	})
})
