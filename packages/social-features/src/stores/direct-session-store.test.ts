// Dupliqué de socle/packages/agent-features/src/stores/direct-session-store.test.ts @ ad2e7fdc2 — adaptations : identifiants du moteur, cas du socle conservés.
import { beforeEach, describe, expect, it } from "vitest"
import type { Id } from "@antia/api/engine"
import {
	DIRECT_TOKEN_TTL_MS,
	directSessionStore,
	directTokenExpired,
	directWantsAudio,
	directWantsVideo,
} from "./direct-session-store"

/**
 * Ce que ces cas gardent : jusqu'au 2026-09-06, credentials, rôle du jeton et
 * intention média vivaient dans `LiveArea`, une PRÉSENTATION rendue à deux
 * endroits de l'arbre selon le palier. Franchir 959 px les détruisait — la
 * salle se fermait et un second participant SFU apparaissait pour le même
 * sujet (constat D-08). Le magasin est ce qui leur survit.
 */

const A = "direct-a" as Id<"liveSessions">
const B = "direct-b" as Id<"liveSessions">

beforeEach(() => {
	directSessionStore.__resetForTests()
})

describe("le magasin tient UNE session, et refuse les jetons d'une autre", () => {
	it("prend la session en charge sans rien connecter", () => {
		directSessionStore.prepare(A)
		const state = directSessionStore.getState()
		expect(state.sessionId).toBe(A)
		expect(state.credentials).toBeNull()
		expect(state.phase).toBe("ready")
	})

	it("IGNORE des credentials qui ne sont pas ceux de la session tenue", () => {
		// Une action Convex met des centaines de millisecondes : on peut avoir
		// quitté ce direct entre la demande et la réponse.
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: B,
			token: "jeton-b",
			wsUrl: "wss://x",
			role: "viewer",
		})
		expect(directSessionStore.getState().credentials).toBeNull()
	})

	it("accepte ceux de la session tenue et mémorise leur rôle", () => {
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
			issuedAt: 1_000,
		})
		const state = directSessionStore.getState()
		expect(state.credentials).toEqual({
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
			issuedAt: 1_000,
		})
		expect(state.lastCredentialRole).toBe("speaker")
		expect(state.phase).toBe("connecting")
	})

	it("changer de session repart de zéro, y compris l'intention", () => {
		directSessionStore.prepare(A, { audioOnly: true })
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		directSessionStore.prepare(B)
		const state = directSessionStore.getState()
		expect(state.sessionId).toBe(B)
		expect(state.credentials).toBeNull()
		expect(state.lastCredentialRole).toBeNull()
		expect(state.intent.audioOnly).toBe(false)
	})

	it("re-préparer la MÊME session ne coupe pas la salle en cours", () => {
		// Le contrôleur rejoue `prepare` à chaque montage — un changement de
		// palier ne doit pas y perdre la connexion.
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		directSessionStore.setPhase("connected")
		directSessionStore.prepare(A)
		const state = directSessionStore.getState()
		expect(state.credentials?.token).toBe("jeton-a")
		expect(state.phase).toBe("connected")
	})
})

describe("l'intention média survit à ce qui coupe la salle", () => {
	it("`leave` remet à l'état d'entrée SANS perdre l'intention", () => {
		directSessionStore.prepare(A)
		directSessionStore.setIntent({ micEnabled: false, audioOnly: true })
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		directSessionStore.leave()
		const state = directSessionStore.getState()
		expect(state.sessionId).toBeNull()
		expect(state.credentials).toBeNull()
		expect(state.phase).toBe("idle")
		expect(state.intent.micEnabled).toBe(false)
		expect(state.intent.audioOnly).toBe(true)
	})

	it("micro et caméra traversent une reconnexion", () => {
		// LE défaut d'origine : `audio={isPublisher}` était ré-appliqué à chaque
		// `SignalConnected`, donc un micro coupé à la main revenait allumé.
		directSessionStore.prepare(A)
		directSessionStore.setIntent({ micEnabled: false, cameraEnabled: true })
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		directSessionStore.setPhase("connected")
		directSessionStore.setPhase("reconnecting")
		directSessionStore.setPhase("connected")
		const { intent } = directSessionStore.getState()
		expect(intent.micEnabled).toBe(false)
		expect(intent.cameraEnabled).toBe(true)
	})

	it("quitter puis re-rejoindre le MÊME direct garde l'intention", () => {
		// `leave` remet `sessionId` à null : si `prepare` prenait cela pour une
		// autre session, la promesse de `leave` ne tiendrait qu'un instant.
		directSessionStore.prepare(A)
		directSessionStore.setIntent({ cameraEnabled: false })
		directSessionStore.leave()
		directSessionStore.prepare(A)
		expect(directSessionStore.getState().intent.cameraEnabled).toBe(false)
	})

	it("`setIntent` est un correctif : les champs absents ne bougent pas", () => {
		directSessionStore.prepare(A, { audioDeviceId: "mic-1" })
		directSessionStore.setIntent({ cameraEnabled: false })
		const { intent } = directSessionStore.getState()
		expect(intent.cameraEnabled).toBe(false)
		expect(intent.micEnabled).toBe(true)
		expect(intent.audioDeviceId).toBe("mic-1")
	})
})

describe("un changement de rôle ferme la connexion et se souvient", () => {
	it("rétrogradation : vide les credentials, mémorise le rôle perdu", () => {
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		expect(directSessionStore.syncSessionRole(A, "viewer")).toBe("rejoin-viewer")
		const state = directSessionStore.getState()
		expect(state.credentials).toBeNull()
		expect(state.lastCredentialRole).toBe("speaker")
		expect(state.phase).toBe("ready")
	})

	it("promotion : le jeton spectateur ne peut pas publier, on le rend", () => {
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "viewer",
		})
		expect(directSessionStore.syncSessionRole(A, "speaker")).toBe("rejoin-speaker")
		expect(directSessionStore.getState().credentials).toBeNull()
	})

	it("l'hôte garde son jeton intervenant — ce n'est pas une transition", () => {
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		expect(directSessionStore.syncSessionRole(A, "host")).toBe("none")
		expect(directSessionStore.getState().credentials?.token).toBe("jeton-a")
	})

	it("la mémoire du rôle perdu survit à l'absence de credentials", () => {
		// La query de rôle et `onDisconnected` arrivent dans n'importe quel
		// ordre : sans cette mémoire, une expulsion SFU gagnant la course
		// perdrait le message explicite.
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "speaker",
		})
		directSessionStore.syncSessionRole(A, "viewer")
		expect(directSessionStore.syncSessionRole(A, "viewer")).toBe("rejoin-viewer")
	})
})

describe("les phases opérationnelles", () => {
	it("`error` retire les credentials — un jeton refusé le restera", () => {
		directSessionStore.prepare(A)
		directSessionStore.setCredentials({
			sessionId: A,
			token: "jeton-a",
			wsUrl: "wss://x",
			role: "viewer",
		})
		directSessionStore.setPhase("error", "Connexion impossible.")
		const state = directSessionStore.getState()
		expect(state.phase).toBe("error")
		expect(state.error).toBe("Connexion impossible.")
		expect(state.credentials).toBeNull()
	})

	it("une phase sans session tenue est ignorée", () => {
		// `leave()` peut passer entre l'événement LiveKit et son traitement.
		directSessionStore.setPhase("connected")
		expect(directSessionStore.getState().phase).toBe("idle")
	})

	it("revenir d'une erreur l'efface", () => {
		directSessionStore.prepare(A)
		directSessionStore.setPhase("error", "Panne")
		directSessionStore.setPhase("connecting")
		expect(directSessionStore.getState().error).toBeNull()
	})
})

describe("ce que la salle doit publier", () => {
	it("un spectateur ne publie JAMAIS", () => {
		const intent = { micEnabled: true, cameraEnabled: true, audioOnly: false }
		expect(directWantsAudio("viewer", intent)).toBe(false)
		expect(directWantsVideo("viewer", intent)).toBe(false)
	})

	it("un intervenant publie ce qu'il a demandé", () => {
		expect(
			directWantsAudio("speaker", {
				micEnabled: true,
				cameraEnabled: false,
				audioOnly: false,
			}),
		).toBe(true)
		expect(
			directWantsVideo("speaker", {
				micEnabled: true,
				cameraEnabled: false,
				audioOnly: false,
			}),
		).toBe(false)
	})

	it("l'audio seul l'emporte sur la caméra demandée", () => {
		expect(
			directWantsVideo("speaker", {
				micEnabled: true,
				cameraEnabled: true,
				audioOnly: true,
			}),
		).toBe(false)
	})
})

describe("le jeton vit une heure", () => {
	it("au-delà du TTL il est périmé, en deçà il ne l'est pas", () => {
		expect(directTokenExpired({ issuedAt: 0 }, DIRECT_TOKEN_TTL_MS - 1)).toBe(false)
		expect(directTokenExpired({ issuedAt: 0 }, DIRECT_TOKEN_TTL_MS)).toBe(true)
		expect(directTokenExpired(null, DIRECT_TOKEN_TTL_MS * 10)).toBe(false)
	})
})

describe("ce que le direct retient pendant un APPEL, et la pose de sa carte", () => {
	it("la retenue d'appel se pose, s'efface, et ne survit pas à `leave`", () => {
		directSessionStore.__resetForTests()
		// Sans session tenue, il n'y a rien à retenir.
		directSessionStore.setCallHold({ micWasEnabled: true })
		expect(directSessionStore.getState().callHold).toBeNull()

		directSessionStore.prepare("direct-a" as never)
		directSessionStore.setCallHold({ micWasEnabled: true })
		expect(directSessionStore.getState().callHold).toEqual({ micWasEnabled: true })
		// Même valeur : aucune émission (le snapshot ne change pas).
		const avant = directSessionStore.getState()
		directSessionStore.setCallHold({ micWasEnabled: true })
		expect(directSessionStore.getState()).toBe(avant)

		directSessionStore.setCallHold(null)
		expect(directSessionStore.getState().callHold).toBeNull()

		directSessionStore.setCallHold({ micWasEnabled: false })
		directSessionStore.leave()
		expect(directSessionStore.getState().callHold).toBeNull()
	})

	it("changer de session efface la retenue et la pose ; la même session les garde", () => {
		directSessionStore.__resetForTests()
		directSessionStore.prepare("direct-a" as never)
		directSessionStore.setCallHold({ micWasEnabled: true })
		directSessionStore.setCardMinimized(true)

		directSessionStore.prepare("direct-a" as never)
		expect(directSessionStore.getState().callHold).toEqual({ micWasEnabled: true })
		expect(directSessionStore.getState().cardMinimized).toBe(true)

		directSessionStore.prepare("direct-b" as never)
		expect(directSessionStore.getState().callHold).toBeNull()
		expect(directSessionStore.getState().cardMinimized).toBe(false)
	})
})
