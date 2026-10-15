// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-invitation-link.test.ts @ ad2e7fdc2 — adaptations : base de la messagerie passée en paramètre (`invitationGroupeHref(token, base, origin?)`, base de test `/messages`) au lieu de la constante de l'espace ; origine et chemins d'exemple neutres ; cas neuf : la base injectée est reprise telle quelle.
import { describe, expect, it } from "vitest"
import {
	hrefSansInvitationGroupe,
	INVITATION_GROUPE_PARAM,
	invitationGroupeHref,
	lireJetonInvitationGroupe,
	normaliserJetonInvitationGroupe,
} from "./groupe-invitation-link"

const TOKEN = "jeton-invitation-groupe-test"
/** La base de la messagerie que l'application injecte (`useRoutes().messages()`). */
const BASE = "/messages"

describe("lien d'invitation de groupe", () => {
	it("compose une adresse relative ou absolue sans exposer d'autre donnée", () => {
		expect(invitationGroupeHref(TOKEN, BASE)).toBe(
			`/messages?${INVITATION_GROUPE_PARAM}=${TOKEN}`,
		)
		expect(invitationGroupeHref(TOKEN, BASE, "https://reseau.example/fil")).toBe(
			`https://reseau.example/messages?${INVITATION_GROUPE_PARAM}=${TOKEN}`,
		)
	})

	it("reprend la base que l'application injecte, sans en écrire aucune", () => {
		expect(invitationGroupeHref(TOKEN, "/reseau/icom")).toBe(
			`/reseau/icom?${INVITATION_GROUPE_PARAM}=${TOKEN}`,
		)
	})

	it("lit le jeton depuis une query, un chemin ou une URL complète", () => {
		expect(lireJetonInvitationGroupe(`?${INVITATION_GROUPE_PARAM}=${TOKEN}`)).toBe(
			TOKEN,
		)
		expect(
			lireJetonInvitationGroupe(
				`/messages?brique=ichat&${INVITATION_GROUPE_PARAM}=${TOKEN}#groupe`,
			),
		).toBe(TOKEN)
		expect(
			lireJetonInvitationGroupe(
				`https://reseau.example/messages?${INVITATION_GROUPE_PARAM}=${TOKEN}`,
			),
		).toBe(TOKEN)
	})

	it("refuse une valeur vide, trop courte ou non URL-safe", () => {
		expect(normaliserJetonInvitationGroupe(null)).toBeNull()
		expect(normaliserJetonInvitationGroupe("court")).toBeNull()
		expect(normaliserJetonInvitationGroupe(`${TOKEN} espace`)).toBeNull()
		expect(invitationGroupeHref("<script>invalide</script>", BASE)).toBeNull()
	})

	it("retire uniquement l'invitation en conservant les autres paramètres", () => {
		expect(
			hrefSansInvitationGroupe(
				"/messages",
				`?brique=ichat&${INVITATION_GROUPE_PARAM}=${TOKEN}`,
			),
		).toBe("/messages?brique=ichat")
		expect(
			hrefSansInvitationGroupe(
				"/messages",
				`?${INVITATION_GROUPE_PARAM}=${TOKEN}`,
			),
		).toBe("/messages")
	})
})
