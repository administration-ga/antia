// Dupliqué de socle/packages/agent-features/src/features/iappel/add-to-call-candidates.test.ts @ ad2e7fdc2 — adaptations : relation = DTO de connexion du moteur (`otherPersonId`, nom neutre possible, badges) ; cas retirés : annuaire de poste (`contactGroupsToCandidates`, 3 cas) et fonction de poste prioritaire sur le titre de profil ; cas ajouté : une relation sans profil publié (nom neutre) n'est pas proposée.
import { describe, expect, it } from "vitest"

import {
	candidateSubtitle,
	shouldAutoLoadMore,
	toCallCandidates,
} from "./add-to-call-candidates"

/**
 * IC-01 — la liste du panneau « Ajouter à l'appel ».
 *
 * Elle part des connexions acceptées du réseau (`graph.connections`), pas
 * d'un annuaire : ce module en tire les candidats que le panneau peut cliquer
 * — et RIEN d'autre (aucune coordonnée privée).
 */

const relation = (extra: Record<string, unknown> = {}) => ({
	connectionId: "c1",
	otherPersonId: "p1",
	displayName: "Aline Minko" as string | null,
	handle: "aline.minko",
	headline: "Juriste",
	avatarUrl: null,
	badges: [],
	at: 1,
	email: "aline@example.ga",
	phone: "+241 01 02 03 04",
	...extra,
})

describe("toCallCandidates — relations acceptées → candidats", () => {
	it("porte le nom, l'identifiant, et le titre de profil", () => {
		expect(toCallCandidates([relation()])).toEqual([
			{ userId: "p1", name: "Aline Minko", position: "Juriste", handle: "aline.minko" },
		])
		expect(toCallCandidates([relation({ headline: null, handle: null })])[0]).toEqual({
			userId: "p1",
			name: "Aline Minko",
			position: null,
			handle: null,
		})
	})

	it("ne transporte AUCUNE coordonnée privée — quatre clés, pas une de plus", () => {
		const [candidate] = toCallCandidates([relation()])
		expect(Object.keys(candidate ?? {}).sort()).toEqual([
			"handle",
			"name",
			"position",
			"userId",
		])
	})

	it("dédoublonne par personne — deux lignes de connexion, un seul bouton", () => {
		expect(
			toCallCandidates([
				relation({ connectionId: "c1" }),
				relation({ connectionId: "c2" }),
			]),
		).toHaveLength(1)
	})

	it("préserve l'ordre reçu", () => {
		const out = toCallCandidates([
			relation({ otherPersonId: "p2", displayName: "Zoé" }),
			relation({ otherPersonId: "p1", displayName: "Aline" }),
		])
		expect(out.map((c) => c.userId)).toEqual(["p2", "p1"])
	})

	it("une relation sans profil publié (nom neutre) n'est pas proposée — le serveur la refuserait", () => {
		const out = toCallCandidates([
			relation({ otherPersonId: "p1", displayName: null }),
			relation({ otherPersonId: "p2", displayName: "   " }),
			relation({ otherPersonId: "p3", displayName: "Paul Obame" }),
		])
		expect(out.map((c) => c.userId)).toEqual(["p3"])
	})
})

describe("candidateSubtitle — la hiérarchie d'identité (titre de profil, puis @handle)", () => {
	it("préfère le titre de profil quand il existe", () => {
		expect(
			candidateSubtitle({
				userId: "p1",
				name: "Paul",
				position: "Chef de service",
				handle: "paul.obame",
			}),
		).toBe("Chef de service")
	})

	it("sans titre, nomme la personne par son adresse de réseau", () => {
		expect(
			candidateSubtitle({ userId: "p1", name: "Aline", position: null, handle: "aline.minko" }),
		).toBe("@aline.minko")
	})

	it("sans titre ni adresse, ne fabrique rien — le nom suffit", () => {
		expect(
			candidateSubtitle({ userId: "p1", name: "Aline", position: null, handle: null }),
		).toBeNull()
		expect(candidateSubtitle({ userId: "p1", name: "Aline", position: "", handle: "" })).toBeNull()
	})
})

describe("shouldAutoLoadMore — chercher la 26e relation sans bouton caché (IC-05, non reproduit)", () => {
	it("charge la suite quand un terme saisi ne trouve rien et qu'il reste des pages", () => {
		expect(
			shouldAutoLoadMore({ term: "zo", matchCount: 0, hasMore: true, isLoadingMore: false }),
		).toBe(true)
	})

	it("ne charge pas sans terme, avec des résultats, sans page suivante, ou déjà en cours", () => {
		expect(
			shouldAutoLoadMore({ term: "", matchCount: 0, hasMore: true, isLoadingMore: false }),
		).toBe(false)
		expect(
			shouldAutoLoadMore({ term: "  ", matchCount: 0, hasMore: true, isLoadingMore: false }),
		).toBe(false)
		expect(
			shouldAutoLoadMore({ term: "zo", matchCount: 1, hasMore: true, isLoadingMore: false }),
		).toBe(false)
		expect(
			shouldAutoLoadMore({ term: "zo", matchCount: 0, hasMore: false, isLoadingMore: false }),
		).toBe(false)
		expect(
			shouldAutoLoadMore({ term: "zo", matchCount: 0, hasMore: true, isLoadingMore: true }),
		).toBe(false)
	})
})
