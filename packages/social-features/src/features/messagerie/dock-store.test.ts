// Dupliqué de socle/packages/agent-features/src/features/messagerie/dock-store.test.ts @ ad2e7fdc2 — adaptations : le magasin est configuré avec un préfixe de réseau de test (`configureDockStorage`) et la clé lue est celle du réseau (`dockStorageKey`) ; cas ajoutés pour le préfixe par réseau — rien n'est écrit avant configuration, un geste antérieur est conservé, deux réseaux ne partagent rien, l'état persisté est relu AVANT un geste, la lecture avant configuration ne lève pas, clé de la position flottante dérivée du préfixe ; les neuf cas des pièces jointes tels quels.
// @vitest-environment jsdom
/**
 * dock-store — le magasin, là où les EFFETS vivent.
 *
 * Les transitions pures sont testées dans `messagerie-dock.test.ts` et
 * `messagerie-media-draft.test.ts`. Ici, ce que seul le magasin fait :
 * persister en session SOUS LA CLÉ DU RÉSEAU, confier les octets au registre
 * runtime, et les LIBÉRER quand la pièce quitte l'état. Environnement
 * `jsdom` : sans `window.sessionStorage`, il n'y a rien à vérifier.
 */
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	configureDockStorage,
	dockStorageKey,
	dockStore,
	icomFloatPlacementStorageKey,
} from "./dock-store"
import { chatKey, draftKey, initialDockState, serializeDock, setDraftText } from "./messagerie-dock"
import {
	hasMediaFile,
	mediaFile,
	resetMediaRuntimeForTests,
} from "./messagerie-media-draft"

/** Le préfixe du réseau de test — celui que la coque tirerait de `useNetwork()`. */
const PREFIXE = "test:"
configureDockStorage(PREFIXE)
const STORAGE_KEY = dockStorageKey(PREFIXE)

/** La forme persistée, telle qu'elle est relue au rechargement. */
interface EtatPersiste {
	drafts: Record<string, string>
	media: Record<
		string,
		{ localId: string; upload: { status: string; storageId?: string } }[]
	>
	view?: { kind: string; key?: string }
}

/**
 * L'état, LU DANS LE STOCKAGE — pas dans le module.
 *
 * C'est volontairement ce que verrait un rechargement de page : un test qui
 * lirait la variable de module prouverait la mémoire vive, pas la
 * persistance.
 */
function etat(cle: string = STORAGE_KEY): EtatPersiste {
	return JSON.parse(
		window.sessionStorage.getItem(cle) ?? '{"drafts":{},"media":{}}',
	) as EtatPersiste
}

/** Les clés de l'état du dock présentes dans le stockage de session. */
function clesDuDock(): string[] {
	return Object.keys(window.sessionStorage).filter((cle) =>
		cle.endsWith("messagerie-dock:v6"),
	)
}

/**
 * ⚠️ Le magasin est un SINGLETON de module : on ne peut pas le réinstancier
 * entre deux tests. On le ramène donc à un état neutre par ses propres gestes
 * — c'est aussi ce que fait un rechargement de page pour l'usager.
 */
function remiseAZero(): void {
	// ⚠️ On LIT AVANT d'effacer le stockage : vider la session d'abord ne
	// toucherait pas la variable de module, et le test suivant hériterait des
	// pièces du précédent (vécu — un `storageId` d'un autre test).
	const avant = etat()
	for (const [cle, pieces] of Object.entries(avant.media ?? {})) {
		dockStore.clearMedia(
			cle,
			pieces.map((piece) => piece.localId),
		)
	}
	for (const cle of Object.keys(avant.drafts ?? {})) {
		dockStore.setDraftText(cle, "")
	}
	dockStore.back()
	resetMediaRuntimeForTests()
	window.sessionStorage.removeItem(STORAGE_KEY)
}

function fichier(name: string): File {
	return { name, size: 2048, type: "image/png" } as unknown as File
}

/** Un magasin NEUF — ce que connaît une page qui vient de se charger. */
async function magasinNeuf(): Promise<typeof import("./dock-store")> {
	vi.resetModules()
	return await import("./dock-store")
}

beforeEach(() => {
	remiseAZero()
})

describe("dock-store — les pièces jointes du brouillon", () => {
	it("PERSISTE la fiche d'une pièce, et jamais ses octets", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("photo.png") }])

		const brut = window.sessionStorage.getItem(STORAGE_KEY) ?? ""
		expect(brut).toContain("photo.png")
		// Un `File` n'est pas sérialisable : s'il partait, la relecture rendrait
		// un objet vide qu'on prendrait pour une pièce prête.
		expect(brut).not.toContain("[object File]")
		expect(etat().media[chatKey("c1")]).toHaveLength(1)
	})

	it("confie les OCTETS au registre, retrouvables par leur identité locale", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("photo.png") }])
		const localId = etat().media[chatKey("c1")]![0]!.localId
		expect(mediaFile(localId)?.name).toBe("photo.png")
	})

	it("LIBÈRE les octets quand la pièce est retirée", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("photo.png") }])
		const localId = etat().media[chatKey("c1")]![0]!.localId

		dockStore.removeMedia(chatKey("c1"), localId)
		expect(hasMediaFile(localId)).toBe(false)
		expect(etat().media[chatKey("c1")]).toBeUndefined()
	})

	it("garde le storageId d'une pièce montée — le renvoi ne remonte rien", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("photo.png") }])
		const localId = etat().media[chatKey("c1")]![0]!.localId

		dockStore.markMediaUploaded(chatKey("c1"), localId, "st-77")
		const persistee = etat().media[chatKey("c1")]![0]!
		expect(persistee.upload).toEqual(
			expect.objectContaining({ status: "uploaded", storageId: "st-77" }),
		)
	})

	it("marque l'ÉCHEC sans effacer un téléversement déjà réussi", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("photo.png") }])
		const localId = etat().media[chatKey("c1")]![0]!.localId
		dockStore.markMediaUploaded(chatKey("c1"), localId, "st-77")

		dockStore.markMediaFailed(chatKey("c1"), localId)
		expect(etat().media[chatKey("c1")]![0]!.upload.status).toBe("uploaded")
	})

	it("vide le brouillon d'une intention ABOUTIE, octets compris", () => {
		dockStore.addMedia(chatKey("c1"), [
			{ file: fichier("a.png") },
			{ file: fichier("b.png") },
		])
		const ids = etat().media[chatKey("c1")]!.map((piece) => piece.localId)

		dockStore.clearMedia(chatKey("c1"), ids)
		expect(etat().media[chatKey("c1")]).toBeUndefined()
		for (const id of ids) expect(hasMediaFile(id)).toBe(false)
	})

	it("emporte les pièces d'un fil MORT à la réconciliation", () => {
		dockStore.addMedia(chatKey("c1"), [{ file: fichier("a.png") }])
		const localId = etat().media[chatKey("c1")]![0]!.localId

		dockStore.reconcile({ chatIds: ["c2"], groupeIds: [] })
		expect(etat().media[chatKey("c1")]).toBeUndefined()
		expect(hasMediaFile(localId)).toBe(false)
	})

	it("fait SUIVRE les pièces quand le brouillon devient un fil", () => {
		dockStore.openDraft("nadia")
		dockStore.addMedia(draftKey("nadia"), [{ file: fichier("a.png") }])
		const localId = etat().media[draftKey("nadia")]![0]!.localId
		dockStore.markMediaUploaded(draftKey("nadia"), localId, "st-9")

		dockStore.promoteDraft("nadia", "c1")
		expect(etat().media[draftKey("nadia")]).toBeUndefined()
		const suivies = etat().media[chatKey("c1")]!
		expect(suivies).toHaveLength(1)
		// Les octets NE sont PAS libérés : la pièce n'a pas disparu, elle a
		// changé de conversation.
		expect(hasMediaFile(localId)).toBe(true)
		expect(suivies[0]!.upload.storageId).toBe("st-9")
	})

	it("accepte une pièce DÉJÀ montée — le vocal renvoyé après un refus", () => {
		dockStore.addMedia(chatKey("c1"), [
			{
				file: fichier("note.webm"),
				durationMs: 3_400,
				uploaded: { storageId: "st-vocal" },
			},
		])
		const piece = etat().media[chatKey("c1")]![0]!
		expect(piece.upload).toEqual(
			expect.objectContaining({ status: "uploaded", storageId: "st-vocal" }),
		)
	})
})

describe("dock-store — un état PAR RÉSEAU (configureDockStorage)", () => {
	beforeEach(() => {
		window.sessionStorage.clear()
	})

	it("les clés portent le préfixe du réseau, jamais celui de l'espace du socle", () => {
		expect(dockStorageKey("antsia:antsia:")).toBe("antsia:antsia:messagerie-dock:v6")
		expect(icomFloatPlacementStorageKey("antsia:antsia:")).toBe(
			"antsia:antsia:icom-floating-placement:v1",
		)
		expect(STORAGE_KEY.startsWith(PREFIXE)).toBe(true)
	})

	it("AVANT configuration, le magasin fonctionne en mémoire et n'écrit RIEN", async () => {
		const neuf = await magasinNeuf()
		expect(neuf.dockStoragePrefix()).toBeNull()
		expect(() => neuf.dockStore.openDraft("nadia")).not.toThrow()
		expect(() => neuf.dockStore.setDraftText(draftKey("nadia"), "bonjour")).not.toThrow()
		// On ne sait pas sous quel réseau ranger : aucune clé au hasard.
		expect(clesDuDock()).toEqual([])
	})

	it("un geste fait AVANT configuration est écrit sous la clé du réseau, pas perdu", async () => {
		const neuf = await magasinNeuf()
		neuf.dockStore.openDraft("nadia")
		neuf.dockStore.setDraftText(draftKey("nadia"), "bonjour")

		neuf.configureDockStorage("r1:")
		expect(clesDuDock()).toEqual(["r1:messagerie-dock:v6"])
		const persiste = etat("r1:messagerie-dock:v6")
		expect(persiste.drafts[draftKey("nadia")]).toBe("bonjour")
		expect(persiste.view).toEqual({ kind: "conversation", key: draftKey("nadia") })
	})

	it("deux réseaux ne partagent ni brouillon ni conversation ouverte", async () => {
		const neuf = await magasinNeuf()
		neuf.configureDockStorage("r1:")
		neuf.dockStore.openChat("c1")
		neuf.dockStore.setDraftText(chatKey("c1"), "dans r1")

		neuf.configureDockStorage("r2:")
		neuf.dockStore.openCompose()
		const r2 = etat("r2:messagerie-dock:v6")
		expect(r2.drafts).toEqual({})
		expect(r2.view).toEqual({ kind: "compose" })

		// Revenir au premier réseau retrouve SON état, intact.
		neuf.configureDockStorage("r1:")
		neuf.dockStore.setOpen(true)
		const r1 = etat("r1:messagerie-dock:v6")
		expect(r1.drafts[chatKey("c1")]).toBe("dans r1")
		expect(r1.view).toEqual({ kind: "conversation", key: chatKey("c1") })
	})

	it("relit l'état persisté AVANT un geste — un geste n'écrase pas la session", async () => {
		// Un rechargement : la session tient un brouillon de ce réseau.
		window.sessionStorage.setItem(
			"r3:messagerie-dock:v6",
			serializeDock(setDraftText(initialDockState(), chatKey("c9"), "à finir")),
		)
		const neuf = await magasinNeuf()
		neuf.configureDockStorage("r3:")
		// Un geste venu d'un écran où le dock n'est pas encore monté.
		neuf.dockStore.openCompose()
		const persiste = etat("r3:messagerie-dock:v6")
		expect(persiste.drafts[chatKey("c9")]).toBe("à finir")
		expect(persiste.view).toEqual({ kind: "compose" })
	})

	it("la lecture AVANT configuration ne lève pas et rend l'état initial", async () => {
		const neuf = await magasinNeuf()
		const { result } = renderHook(() => neuf.useDockState())
		expect(result.current.view).toEqual({ kind: "list" })
		expect(result.current.drafts).toEqual({})
	})

	it("reconfigurer avec le MÊME préfixe ne relit rien et n'efface rien", async () => {
		const neuf = await magasinNeuf()
		neuf.configureDockStorage("r4:")
		neuf.dockStore.setDraftText(chatKey("c4"), "texte")
		neuf.configureDockStorage("r4:")
		neuf.dockStore.openCompose()
		expect(etat("r4:messagerie-dock:v6").drafts[chatKey("c4")]).toBe("texte")
	})
})
