// Dupliqué de socle/packages/agent-features/src/features/iappel/participant-identity.test.ts @ ad2e7fdc2 — adaptations : le jeton du moteur porte `personId` (attribut et métadonnée) au lieu de `userId` ; identifiants de personnes du moteur — mêmes cas, mêmes règles.
import { describe, expect, it } from "vitest"

import { participantKey, participantUserId } from "./participant-identity"

/**
 * Le pont entre l'identité LiveKit (`{subject}::{nonce}`, unique par
 * connexion) et la personne sur laquelle la grille de groupe se construit.
 * Sans lui, aucune vignette ne retrouvait sa vidéo.
 */
describe("participantUserId — le jeton dit qui est là", () => {
	it("lit l'attribut `personId` — le chemin nominal", () => {
		expect(
			participantUserId({
				identity: "subject-a::1a2b3c4d",
				attributes: { personId: "persons:abc" },
			}),
		).toBe("persons:abc")
	})

	it("replie sur la métadonnée JSON quand l'attribut manque (serveur ancien)", () => {
		expect(
			participantUserId({
				identity: "subject-a::1a2b3c4d",
				attributes: {},
				metadata: JSON.stringify({ personId: "persons:abc" }),
			}),
		).toBe("persons:abc")
	})

	it("l'attribut prime sur la métadonnée", () => {
		expect(
			participantUserId({
				identity: "x",
				attributes: { personId: "persons:attr" },
				metadata: JSON.stringify({ personId: "persons:meta" }),
			}),
		).toBe("persons:attr")
	})

	it("ne nomme personne sur un jeton muet — jamais une valeur inventée", () => {
		expect(participantUserId({ identity: "subject-a::1a2b3c4d" })).toBeNull()
		expect(participantUserId({ identity: "x", attributes: null, metadata: null })).toBeNull()
		expect(participantUserId({ identity: "x", attributes: { personId: "" } })).toBeNull()
	})

	it("une métadonnée étrangère n'est pas une erreur", () => {
		expect(participantUserId({ identity: "x", metadata: "texte libre" })).toBeNull()
		expect(participantUserId({ identity: "x", metadata: "[1,2]" })).toBeNull()
		expect(participantUserId({ identity: "x", metadata: JSON.stringify({ personId: 42 }) })).toBeNull()
	})
})

describe("participantKey — la clé de la vignette", () => {
	it("est la personne quand le jeton la porte", () => {
		expect(
			participantKey({ identity: "subject-a::nonce", attributes: { personId: "persons:abc" } }),
		).toBe("persons:abc")
	})

	it("retombe sur l'identité brute sinon — la vignette reste un avatar, jamais un cadre noir", () => {
		expect(participantKey({ identity: "subject-a::nonce" })).toBe("subject-a::nonce")
	})
})
