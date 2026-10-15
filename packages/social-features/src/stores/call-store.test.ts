// Dupliqué de socle/packages/agent-features/src/stores/call-store.test.ts @ ad2e7fdc2 — adaptations : identifiants du moteur (`Id<"calls">`, `Id<"persons">`) ; cas de la file du centre d'appels (slot `queue` évincé) et du renvoi au secrétariat (`routedFor`, deux cas) retirés avec leur branche ; l'identité de l'appelé se dit par le nom et l'adresse de réseau (plus de poste ni d'administration) ; fin « hors horaires » (horaires de poste retirés) remplacée par « ne pas déranger » ; adresse de salle factice sans schéma d'URL ; trois cas ajoutés pour la clé de stockage préfixée par le réseau (`configureCallStoreStorage`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	AUDIO_ROUTE_STORAGE_KEY,
	callStore,
	configureCallStoreStorage,
	parseStoredAudioRoute,
	type CallSlot,
} from "./call-store"
import type { Id } from "@antia/api/engine"

/**
 * Ce que ces cas gardent : l'intention média (micro coupé, caméra allumée)
 * était REMISE À ZÉRO à chaque changement de slot actif. Un appel vidéo
 * démarrait donc caméra éteinte, et revenir d'un appel en attente rallumait
 * un micro qu'on avait volontairement coupé.
 */

const A = "call-a" as Id<"calls">
const B = "call-b" as Id<"calls">
const PERSON = "person-1" as Id<"persons">
/** Adresse de salle factice : le store la recopie sans jamais la lire. */
const WS_URL = "salle-de-test"

beforeEach(() => {
	callStore.__resetForTests()
})

function slotOf(id: Id<"calls">): CallSlot | undefined {
	return callStore.getSlots().find((s) => s.meetingId === id)
}

describe("un appel vidéo démarre caméra allumée", () => {
	it("openOutgoingCall en vidéo pose l'intention caméra", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "video",
			startedAt: 1,
		})
		expect(callStore.getCameraEnabled()).toBe(true)
		expect(callStore.getMicMuted()).toBe(false)
	})

	it("…et un appel audio la laisse éteinte", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
		expect(callStore.getCameraEnabled()).toBe(false)
	})

	it("acceptIncoming en vidéo aussi", () => {
		callStore.acceptIncoming({ meetingId: A, mediaType: "video" })
		expect(callStore.getCameraEnabled()).toBe(true)
	})
})

describe("l'identité de l'appelé voyage avec la fenêtre", () => {
	it("le slot porte le nom et l'adresse de réseau de l'appelé", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
			scope: "personnel",
			callee: {
				name: "Jean Obame",
				handle: "jean.obame",
			},
		})
		const slot = slotOf(A)
		expect(slot?.peer?.name).toBe("Jean Obame")
		expect(slot?.peer?.handle).toBe("jean.obame")
		expect(slot?.scope).toBe("personnel")
		expect(slot?.direction).toBe("outgoing")
		expect(slot?.kind).toBe("direct")
	})
})

describe("la mémoire d'intention par appel", () => {
	it("basculer d'un appel à l'autre puis revenir RESTAURE micro et caméra", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "video",
			startedAt: 1,
		})
		callStore.setMicMuted(true) // je me mets en sourdine sur A
		expect(callStore.getCameraEnabled()).toBe(true)

		callStore.acceptIncoming({ meetingId: B, mediaType: "audio" })
		// B est un appel audio : caméra éteinte, micro ouvert.
		expect(callStore.getCameraEnabled()).toBe(false)
		expect(callStore.getMicMuted()).toBe(false)
		// A n'est pas perdu : il attend.
		expect(slotOf(A)?.status).toBe("held")

		callStore.resumeSlot(A)
		expect(callStore.getMicMuted()).toBe(true)
		expect(callStore.getCameraEnabled()).toBe(true)
	})

	it("hydrater un slot actif (arrivée du jeton) ne touche PAS l'intention", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "video",
			startedAt: 1,
		})
		callStore.setMicMuted(true)
		callStore.upsertSlot({
			meetingId: A,
			status: "active",
			token: "jwt",
			wsUrl: WS_URL,
		})
		expect(callStore.getMicMuted()).toBe(true)
		expect(callStore.getCameraEnabled()).toBe(true)
	})
})

describe("deux appels directs coexistent", () => {
	it("un second appel actif met le premier EN ATTENTE au lieu de le supprimer", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		expect(slotOf(A)?.status).toBe("held")
		expect(slotOf(A)?.heldSince).toBeTypeOf("number")
		expect(callStore.getActiveSlotId()).toBe(B)
	})

	it("raccrocher l'appel de tête reporte la surface sur celui qui attend", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		callStore.removeSlot(B)
		expect(callStore.getActiveSlotId()).toBe(A)
	})

	it("mettre le SEUL appel en attente garde un actif — sinon l'écran disparaît", () => {
		// Ce test affirmait l'inverse (`activeSlotId` à `null`) jusqu'au
		// 2026-08-22. C'était le défaut : `frontSlot` tombait à `null` dans
		// l'hôte, dont le court-circuit fait disparaître la surface d'appel
		// ENTIÈRE — alors que la conversation vit toujours dans le pool. Un
		// appel parqué doit rester pilotable, c'est à ça que sert « Reprendre ».
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.holdSlot(A, 42)
		expect(slotOf(A)?.status).toBe("held")
		expect(slotOf(A)?.heldSince).toBe(42)
		expect(callStore.getActiveSlotId()).toBe(A)
	})

	it("mettre en attente pendant qu'un autre appel vit passe la ligne à l'autre", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		// B est actif, A est parqué. On parque B à son tour.
		callStore.holdSlot(B)
		// A ne peut pas prendre la ligne : il est parqué lui aussi. L'actif
		// reste donc sur B, qui garde sa surface.
		expect(callStore.getActiveSlotId()).toBe(B)
		expect(slotOf(A)?.status).toBe("held")
		expect(slotOf(B)?.status).toBe("held")
	})

	it("raccrocher l'actif quand le seul survivant est PARQUÉ le rend audible", () => {
		// Sinon `activeSlotId` désigne un slot `held`, que `planCallSurface`
		// écarte : la surface se fige en pilule inerte dont le bouton
		// « Raccrocher » ne raccroche rien.
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		expect(slotOf(A)?.status).toBe("held")
		callStore.removeSlot(B)
		expect(callStore.getActiveSlotId()).toBe(A)
		expect(slotOf(A)?.status).toBe("active")
		expect(slotOf(A)?.heldSince).toBeNull()
	})

	it("un appel terminé cède la ligne à l'appel parqué, dé-parqué", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		callStore.markSlotEnded(B, "ended")
		expect(callStore.getActiveSlotId()).toBe(A)
		expect(slotOf(A)?.status).toBe("active")
	})
})

describe("hydrater un slot ne réécrit jamais son statut", () => {
	it("un slot PARQUÉ qui reçoit sa salle reste parqué", () => {
		// Le connecteur reconstruisait le statut depuis une closure vieille de
		// plusieurs secondes : basculer d'appel pendant la négociation du jeton
		// défaisait la bascule, sans la moindre erreur.
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		expect(slotOf(A)?.status).toBe("held")

		callStore.hydrateSlot(A, { token: "jwt", wsUrl: WS_URL, roomName: "r" })
		expect(slotOf(A)?.status).toBe("held")
		expect(slotOf(A)?.token).toBe("jwt")
		expect(callStore.getActiveSlotId()).toBe(B)
	})

	it("un appel qui SONNAIT devient en cours d'établissement", () => {
		callStore.upsertSlot({ meetingId: A, status: "incoming", kind: "direct" })
		callStore.hydrateSlot(A, { token: "jwt", wsUrl: WS_URL })
		expect(slotOf(A)?.status).toBe("connecting")
	})

	it("hydrater un slot inconnu ne crée rien", () => {
		callStore.hydrateSlot(A, { token: "jwt", wsUrl: WS_URL })
		expect(slotOf(A)).toBeUndefined()
	})
})

describe("la fin d'un appel reste à l'écran", () => {
	it("markSlotEnded conserve le slot et sa raison", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
		callStore.markSlotEnded(A, "dnd")
		const slot = slotOf(A)
		expect(slot?.status).toBe("ended")
		expect(slot?.endKind).toBe("dnd")
		// Sans cela, l'écran « Ne pas déranger » se refermerait avant d'être lu.
		expect(slot).toBeDefined()
	})

	it("une note de refus est conservée", () => {
		callStore.upsertSlot({ meetingId: A, status: "active" })
		callStore.markSlotEnded(A, "declined", "Je vous rappelle")
		expect(slotOf(A)?.endNote).toBe("Je vous rappelle")
	})

	it("setSlotError consigne l'échec sur le bon slot", () => {
		callStore.upsertSlot({ meetingId: A, status: "connecting" })
		callStore.setSlotError(A, { roomError: "salle injoignable" })
		expect(slotOf(A)?.roomError).toBe("salle injoignable")
	})
})

describe("la pose de la surface", () => {
	it("un appel entrant décroché déplie la surface, même réduite", () => {
		callStore.setMinimized(true)
		callStore.acceptIncoming({ meetingId: B, mediaType: "audio" })
		// Un appel qu'on vient d'accepter ne reste pas caché dans une pilule.
		expect(callStore.getMinimized()).toBe(false)
	})

	it("un appel sortant aussi", () => {
		callStore.setMinimized(true)
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
		expect(callStore.getMinimized()).toBe(false)
	})

	it("le dernier appel fermé remet la surface à plat", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
		callStore.setMinimized(true)
		callStore.closeOutgoingCall()
		expect(callStore.getMinimized()).toBe(false)
	})

	it("mais réduire pendant un appel qui continue reste réduit", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		callStore.setMinimized(true)
		callStore.removeSlot(B)
		// A attendait, il reprend la main : la pilule reste, l'appel vit.
		expect(callStore.getMinimized()).toBe(true)
		expect(callStore.getActiveSlotId()).toBe(A)
	})

	it("les périphériques choisis sont mémorisés", () => {
		callStore.setAudioRoute({
			kind: "device",
			deviceId: "haut-parleur-1",
			label: "Casque",
		})
		callStore.setCameraFacing("environment")
		callStore.upsertSlot({ meetingId: A, status: "active" })
		expect(callStore.getSlots()).toHaveLength(1)
		expect(callStore.getAudioRoute()).toEqual({
			kind: "device",
			deviceId: "haut-parleur-1",
			label: "Casque",
		})
	})

	it("un choix de sortie survit au changement d'appel actif", () => {
		// La sortie audio est un réglage d'APPAREIL, pas d'appel : basculer
		// vers un second appel puis revenir ne doit pas renvoyer le son dans
		// les enceintes de l'écran.
		callStore.setAudioRoute({ kind: "speaker" })
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		callStore.setActiveSlot(B)
		expect(callStore.getAudioRoute()).toEqual({ kind: "speaker" })
		callStore.setActiveSlot(A)
		expect(callStore.getAudioRoute()).toEqual({ kind: "speaker" })
	})
})

describe("parseStoredAudioRoute — un réglage illisible ne coupe pas le son", () => {
	it("relit les trois formes d'intention", () => {
		expect(parseStoredAudioRoute('{"kind":"speaker"}')).toEqual({ kind: "speaker" })
		expect(parseStoredAudioRoute('{"kind":"earpiece"}')).toEqual({ kind: "earpiece" })
		expect(
			parseStoredAudioRoute('{"kind":"device","deviceId":"d1","label":"Casque"}'),
		).toEqual({ kind: "device", deviceId: "d1", label: "Casque" })
	})

	it("un périphérique sans libellé reste un périphérique", () => {
		expect(parseStoredAudioRoute('{"kind":"device","deviceId":"d1"}')).toEqual({
			kind: "device",
			deviceId: "d1",
			label: null,
		})
	})

	it("rien, du JSON invalide, une forme inconnue : aucune préférence", () => {
		// Une valeur d'une version future ne doit ni lever ni router de travers.
		expect(parseStoredAudioRoute(null)).toBeNull()
		expect(parseStoredAudioRoute("")).toBeNull()
		expect(parseStoredAudioRoute("{pas du json")).toBeNull()
		expect(parseStoredAudioRoute('"speaker"')).toBeNull()
		expect(parseStoredAudioRoute('{"kind":"bluetooth"}')).toBeNull()
		expect(parseStoredAudioRoute('{"kind":"device"}')).toBeNull()
		expect(parseStoredAudioRoute('{"kind":"device","deviceId":""}')).toBeNull()
	})
})

describe("la sortie audio s'enregistre sous le préfixe du RÉSEAU (un état par réseau)", () => {
	/** Un `localStorage` en mémoire, posé sur un `window` factice (environnement node). */
	function stubStorage(initial: Record<string, string> = {}): Map<string, string> {
		const store = new Map(Object.entries(initial))
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, value: string) => {
					store.set(key, value)
				},
				removeItem: (key: string) => {
					store.delete(key)
				},
			},
		})
		return store
	}

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("sans réseau posé (ou avec un préfixe vide), rien n'est écrit : le choix vaut pour la session", () => {
		const store = stubStorage()
		callStore.setAudioRoute({ kind: "speaker" })
		configureCallStoreStorage("")
		callStore.setAudioRoute({ kind: "earpiece" })
		expect(store.size).toBe(0)
		expect(callStore.getAudioRoute()).toEqual({ kind: "earpiece" })
	})

	it("le choix s'écrit sous le préfixe du réseau, et s'efface de même", () => {
		const store = stubStorage()
		configureCallStoreStorage("antia:test:")
		callStore.setAudioRoute({ kind: "speaker" })
		expect(store.get(`antia:test:${AUDIO_ROUTE_STORAGE_KEY}`)).toBe('{"kind":"speaker"}')
		expect(store.has(AUDIO_ROUTE_STORAGE_KEY)).toBe(false)
		callStore.setAudioRoute(null)
		expect(store.size).toBe(0)
	})

	it("le choix enregistré pour CE réseau est relu au premier accès — jamais celui d'un autre", () => {
		stubStorage({
			[`antia:test:${AUDIO_ROUTE_STORAGE_KEY}`]: '{"kind":"device","deviceId":"d1","label":"Casque"}',
			[`antia:autre:${AUDIO_ROUTE_STORAGE_KEY}`]: '{"kind":"earpiece"}',
		})
		configureCallStoreStorage("antia:test:")
		expect(callStore.getAudioRoute()).toEqual({ kind: "device", deviceId: "d1", label: "Casque" })
	})
})

describe("la promotion distante est réconciliée (IC-02)", () => {
	// LE défaut : `callKind` était une photographie prise à la création du
	// slot. Quand A ajoutait C, l'appel devenait un groupe côté serveur,
	// mais A et B — dont les slots disaient « direct » — restaient en vue 1:1
	// pendant que C entrait dans une salle de groupe.
	const group = { title: "Appel de groupe — Bob, Carla", memberCount: 3 }

	it("un slot direct réconcilié devient un groupe — statut et actif intacts", () => {
		callStore.openOutgoingCall({
			meetingId: A,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
		callStore.upsertSlot({ meetingId: A, status: "active", token: "jwt", wsUrl: WS_URL })
		callStore.setMicMuted(true)

		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group })

		const slot = slotOf(A)
		expect(slot?.callKind).toBe("group")
		expect(slot?.group).toEqual(group)
		expect(slot?.status).toBe("active")
		expect(slot?.token).toBe("jwt")
		expect(callStore.getActiveSlotId()).toBe(A)
		// Aucun remontage, aucune intention média touchée.
		expect(callStore.getMicMuted()).toBe(true)
	})

	it("réconcilier à l'identique n'émet PAS — un snapshot de l'appel arrive à chaque tick", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group })
		const before = callStore.getSlots()
		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group: { ...group } })
		// `emit()` reconstruit TOUJOURS le snapshot : la même référence prouve
		// qu'aucune émission n'a eu lieu — `useSyncExternalStore` ne re-rend
		// donc rien.
		expect(callStore.getSlots()).toBe(before)
	})

	it("un slot PARQUÉ réconcilié reste parqué, et ne redevient pas actif", () => {
		callStore.upsertSlot({ meetingId: A, status: "active", kind: "direct" })
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		expect(slotOf(A)?.status).toBe("held")

		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group })
		expect(slotOf(A)?.status).toBe("held")
		expect(slotOf(A)?.callKind).toBe("group")
		expect(callStore.getActiveSlotId()).toBe(B)
	})

	it("ne rétrograde JAMAIS un groupe en tête-à-tête", () => {
		callStore.openGroupCall({ meetingId: A, mediaType: "audio", group })
		callStore.reconcileSlotFromMeeting(A, { callKind: "direct", group: null })
		expect(slotOf(A)?.callKind).toBe("group")
		expect(slotOf(A)?.group).toEqual(group)
	})

	it("une promotion sans identité (réponse `promoted` de l'ajout) garde le titre connu", () => {
		callStore.openGroupCall({ meetingId: A, mediaType: "audio", group })
		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group: null })
		expect(slotOf(A)?.group).toEqual(group)

		// …et sur un slot direct, la promotion prend sans identité : le titre
		// serveur arrive par la query, la grille s'ouvre tout de suite.
		callStore.upsertSlot({ meetingId: B, status: "active", kind: "direct" })
		callStore.reconcileSlotFromMeeting(B, { callKind: "group", group: null })
		expect(slotOf(B)?.callKind).toBe("group")
		expect(slotOf(B)?.group ?? null).toBeNull()
	})

	it("réconcilier un slot inconnu ne crée rien", () => {
		callStore.reconcileSlotFromMeeting(A, { callKind: "group", group })
		expect(slotOf(A)).toBeUndefined()
	})
})

describe("micro bloqué : retenu pendant l'appel, oublié quand la ligne se vide (22/09)", () => {
	function ouvrir(id: Id<"calls">) {
		callStore.openOutgoingCall({
			meetingId: id,
			participantUserId: PERSON,
			mediaType: "audio",
			startedAt: 1,
		})
	}

	it("l'état se pose et se lève", () => {
		ouvrir(A)
		callStore.setMicBlocked("bloqué")
		expect(callStore.getMicBlocked()).toBe("bloqué")
		callStore.setMicBlocked(null)
		expect(callStore.getMicBlocked()).toBeNull()
	})

	it("la ligne vidée l'oublie : le prochain appel redemande le micro", () => {
		ouvrir(A)
		callStore.setMicBlocked("bloqué")
		callStore.removeSlot(A)
		expect(callStore.getMicBlocked()).toBeNull()
	})

	it("un appel qui reste le garde : la permission appartient à l'origine, pas à l'appel", () => {
		ouvrir(A)
		callStore.upsertSlot({ meetingId: B, status: "held" })
		callStore.setMicBlocked("bloqué")
		callStore.removeSlot(A)
		expect(callStore.getMicBlocked()).toBe("bloqué")
	})
})
