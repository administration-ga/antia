// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-ressources.test.ts @ ad2e7fdc2 — adaptations : domaines d'exemple neutres ; cas neuf : un champ propre au moteur (`withheld`, retenue de la garde des fichiers) traverse jusqu'à la ressource, valeur et type.
import { describe, expect, it } from "vitest"
import { ressourcesDuGroupe } from "./groupe-ressources"

describe("ressourcesDuGroupe", () => {
	it("classe les pièces récentes et déduplique les liens visibles", () => {
		const result = ressourcesDuGroupe([
			{
				messageId: "ancien",
				createdAt: 10,
				text: "Voir https://reseau.example/guide.",
				attachments: [{ filename: "note.pdf", mimeType: "application/pdf", sizeBytes: 12, durationMs: null, url: "/note" }],
			},
			{
				messageId: "recent",
				createdAt: 20,
				text: "https://reseau.example/guide et https://service.example/a)",
				attachments: [{ filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 18, durationMs: null, url: "/photo" }],
			},
		])

		expect(result.attachments.map((item) => item.filename)).toEqual(["photo.jpg", "note.pdf"])
		expect(result.links).toEqual([
			{ url: "https://service.example/a", createdAt: 20 },
			{ url: "https://reseau.example/guide", createdAt: 10 },
		])
	})

	it("laisse traverser les champs propres au moteur (pièce retenue par la garde)", () => {
		const result = ressourcesDuGroupe([
			{
				messageId: "m1",
				createdAt: 5,
				text: null,
				attachments: [{ filename: "scan.pdf", mimeType: "application/pdf", sizeBytes: 3, durationMs: null, url: null, withheld: "fileScanPending" as const }],
			},
		])
		expect(result.attachments).toEqual([
			{ filename: "scan.pdf", mimeType: "application/pdf", sizeBytes: 3, durationMs: null, url: null, withheld: "fileScanPending", key: "m1:0", createdAt: 5 },
		])
		// Le type le garde aussi : l'écran peut dire « analyse en cours ».
		expect(result.attachments[0]?.withheld).toBe("fileScanPending")
	})

	it("ignore les messages sans corps ni pièce", () => {
		expect(ressourcesDuGroupe([{ messageId: "masque", createdAt: 1, text: null, attachments: [] }])).toEqual({ attachments: [], links: [] })
	})
})
