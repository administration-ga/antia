// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-recipients.test.ts @ ad2e7fdc2 — adaptations : un cas ajouté — une relation SANS NOM (nom nullable du DTO du moteur) reste trouvable par son identifiant ; le reste tel quel.
import { describe, expect, it } from "vitest"
import {
	deriveRecipientListState,
	filterRelationRecipients,
	shouldOfferMoreRecipients,
	type RelationSearchSnapshot,
} from "./messagerie-recipients"

const relations = [
	{ connectionId: "a", displayName: "Élodie Mebiame", handle: "elodie.m" },
	{ connectionId: "b", displayName: "Georges Ondo", handle: "g.ondo" },
	{ connectionId: "c", displayName: "Profil retiré", handle: null },
]

type Relation = (typeof relations)[number]
const vingtSixieme: Relation = {
	connectionId: "z",
	displayName: "Zoé Famille26",
	handle: "zoe.rel26",
}

/** Un instantané de recherche, par défaut « rien n'est parti ». */
function recherche(
	partiel: Partial<RelationSearchSnapshot<Relation>> = {},
): RelationSearchSnapshot<Relation> {
	return { eligible: false, settled: false, isError: false, items: [], ...partiel }
}

describe("état du sélecteur de destinataires (IC-05)", () => {
	it("sans terme, montre les pages chargées telles quelles", () => {
		expect(
			deriveRecipientListState({
				terme: "",
				loaded: relations,
				hasMore: true,
				search: recherche(),
			}),
		).toEqual({ kind: "liste", items: relations, source: "local" })
	})

	it("sous le seuil, pré-filtre localement sans jamais conclure tant qu'il reste des pages", () => {
		expect(
			deriveRecipientListState({
				terme: "g",
				loaded: relations,
				hasMore: true,
				search: recherche(),
			}),
		).toEqual({ kind: "liste", items: [relations[1]], source: "local" })
		// Une lettre qui ne correspond à rien de chargé : « vide », mais PAS
		// exhaustif — la 26e relation peut être dans la page suivante.
		expect(
			deriveRecipientListState({
				terme: "z",
				loaded: relations,
				hasMore: true,
				search: recherche(),
			}),
		).toEqual({ kind: "vide", exhaustive: false })
		// Toutes les pages chargées : là, le vide est exhaustif.
		expect(
			deriveRecipientListState({
				terme: "z",
				loaded: relations,
				hasMore: false,
				search: recherche(),
			}),
		).toEqual({ kind: "vide", exhaustive: true })
	})

	it("au seuil, montre le pré-filtre local en ATTENDANT le serveur — jamais « aucune »", () => {
		expect(
			deriveRecipientListState({
				terme: "zo",
				loaded: relations,
				hasMore: true,
				search: recherche({ eligible: true, settled: false }),
			}),
		).toEqual({ kind: "attente", items: [] })
		expect(
			deriveRecipientListState({
				terme: "on",
				loaded: relations,
				hasMore: true,
				search: recherche({ eligible: true, settled: false }),
			}),
		).toEqual({ kind: "attente", items: [relations[1]] })
	})

	it("une fois le serveur posé, ses résultats font foi — et son vide est exhaustif", () => {
		expect(
			deriveRecipientListState({
				terme: "Zoé",
				loaded: relations,
				hasMore: true,
				search: recherche({ eligible: true, settled: true, items: [vingtSixieme] }),
			}),
		).toEqual({ kind: "liste", items: [vingtSixieme], source: "serveur" })
		expect(
			deriveRecipientListState({
				terme: "Personne",
				loaded: relations,
				hasMore: true,
				search: recherche({ eligible: true, settled: true, items: [] }),
			}),
		).toEqual({ kind: "vide", exhaustive: true })
	})

	it("une panne du serveur n'est pas une absence : erreur, avec le pré-filtre local", () => {
		expect(
			deriveRecipientListState({
				terme: "elodie",
				loaded: relations,
				hasMore: true,
				search: recherche({ eligible: true, settled: false, isError: true }),
			}),
		).toEqual({ kind: "erreur", items: [relations[0]] })
	})
})

describe("« Voir plus de relations » reste atteignable (IC-05)", () => {
	it("sans page suivante, jamais", () => {
		expect(
			shouldOfferMoreRecipients({ kind: "vide", exhaustive: false }, false),
		).toBe(false)
	})

	it("sous un vide NON exhaustif — là où la 26e relation manque — oui", () => {
		expect(shouldOfferMoreRecipients({ kind: "vide", exhaustive: false }, true)).toBe(
			true,
		)
		expect(shouldOfferMoreRecipients({ kind: "vide", exhaustive: true }, true)).toBe(
			false,
		)
	})

	it("sous une liste locale ou une panne, oui ; sous une réponse serveur ou en attente, non", () => {
		expect(
			shouldOfferMoreRecipients({ kind: "liste", items: [], source: "local" }, true),
		).toBe(true)
		expect(
			shouldOfferMoreRecipients({ kind: "liste", items: [], source: "serveur" }, true),
		).toBe(false)
		expect(shouldOfferMoreRecipients({ kind: "erreur", items: [] }, true)).toBe(true)
		expect(shouldOfferMoreRecipients({ kind: "attente", items: [] }, true)).toBe(false)
	})
})

describe("destinataires d'un nouveau message iCom", () => {
	it("affiche toutes les relations avant toute recherche", () => {
		expect(filterRelationRecipients(relations, "")).toEqual(relations)
	})

	it("filtre par nom ou @identifiant sans dépendre des accents", () => {
		expect(filterRelationRecipients(relations, "elodie")).toEqual([relations[0]])
		expect(filterRelationRecipients(relations, "@G.ONDO")).toEqual([relations[1]])
	})

	it("ne fabrique aucun destinataire extérieur aux relations reçues", () => {
		expect(filterRelationRecipients(relations, "personne inconnue")).toEqual([])
	})

	it("retrouve une relation SANS NOM par son identifiant, sans lever", () => {
		const sansNom = { connectionId: "d", displayName: null, handle: "anonyme.ga" }
		const toutes = [...relations, sansNom]
		expect(filterRelationRecipients(toutes, "anonyme")).toEqual([sansNom])
		expect(filterRelationRecipients(toutes, "elodie")).toEqual([relations[0]])
	})
})
