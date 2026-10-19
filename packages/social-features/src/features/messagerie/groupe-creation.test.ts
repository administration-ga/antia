// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-creation.test.ts @ ad2e7fdc2 — adaptations : commentaire recadré sur la base de messagerie injectée (plus de chemin de l'espace) ; cas inchangés.
import { describe, expect, it } from "vitest"
import { suiteDeCreation } from "./groupe-creation"

describe("suiteDeCreation", () => {
	it("mène au groupe qui vient de naître", () => {
		expect(suiteDeCreation({ threadId: "t1", created: true })).toEqual({
			cle: "groupe:t1",
		})
	})

	it("mène AU MÊME ENDROIT quand la clé d'idempotence a retrouvé le groupe", () => {
		// Un rejeu doit atterrir sur le groupe. Laisser l'usager sur le
		// composeur lui ferait croire que rien ne s'est passé — et l'inviterait
		// à recommencer, ce qui est précisément ce qui fabriquait des doublons.
		expect(suiteDeCreation({ threadId: "t1", created: false })).toEqual({
			cle: "groupe:t1",
		})
	})

	it("refuse un identifiant vide plutôt que de fabriquer une adresse creuse", () => {
		// `groupe:` seul donnerait une adresse `<base>/groupe/` sans
		// identifiant : ni une conversation pour `isConversationRoute`, ni un
		// écran immersif. Un cul-de-sac.
		expect(suiteDeCreation({ threadId: "", created: true })).toBeNull()
		expect(suiteDeCreation({ threadId: "   ", created: true })).toBeNull()
	})

	it("tolère un identifiant entouré d'espaces", () => {
		expect(suiteDeCreation({ threadId: " t9 ", created: true })).toEqual({
			cle: "groupe:t9",
		})
	})
})
