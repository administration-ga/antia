// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-erreur.test.ts @ ad2e7fdc2 — adaptations : les refus du moteur portent un CODE (charge `{ code }` ou `{ code, rule, params }`) et le texte vient des locales (instance i18n du moteur, en français) ; la forme « dev » (trace dans `message`) et la forme « prod » (« Server Error ») restent vérifiées ; la phrase générique est lue par sa clé.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { messageErreurLisible, REFUS_GENERIQUE_KEY } from "./messagerie-erreur"

/**
 * Les DEUX formes réelles d'une même erreur, et la garantie qu'aucune trace
 * n'atteint l'écran. Le message « dev » est recopié d'un refus observé au
 * socle le 2026-08-12 ; la charge, elle, est celle du moteur (un code).
 */

const t = createAppI18n({
	locale: "fr",
	appResources: { fr: {}, en: {} },
	defaultNS: "messagerie",
}).t

const messageDeDev = `Server Error
[CONVEX M(modules/messaging/inbox:startThreadWithHandle)] [Request ID: 2699d56c68750e64] Server Error
Uncaught ConvexError: {"code":"notFound"}
    at fail (../../convex/lib/errors.ts:158:0)
    at handler (../../../convex/modules/messaging/inbox.ts:287:14)

  Called by client`

const INTROUVABLE = t("errors:notFound")
const GENERIQUE = t(REFUS_GENERIQUE_KEY)

describe("texte montrable d'un refus", () => {
	it("les traductions existent — sans quoi la clé brute s'afficherait", () => {
		expect(INTROUVABLE).not.toBe("notFound")
		expect(GENERIQUE).toBe("L'envoi a échoué. Réessayez dans un instant.")
	})

	it("traduit le CODE du moteur, PAS la trace (forme dev)", () => {
		const err = Object.assign(new Error(messageDeDev), {
			data: { code: "notFound" },
		})
		expect(messageErreurLisible(err, t)).toBe(INTROUVABLE)
	})

	it("traduit le même code quand Convex caviarde le message (forme prod)", () => {
		// En production, `message` vaut « Server Error » : seule `data` porte
		// encore ce que le serveur a voulu dire.
		const err = Object.assign(new Error("Server Error"), {
			data: { code: "notFound" },
		})
		expect(messageErreurLisible(err, t)).toBe(INTROUVABLE)
	})

	it("une règle du domaine prime sur son code, bornes interpolées", () => {
		const err = Object.assign(new Error("Server Error"), {
			data: { code: "invalidArgument", rule: "MESSAGE_TOO_LONG", params: { max: 4000 } },
		})
		const rendu = messageErreurLisible(err, t)
		expect(rendu).toBe(t("rules:MESSAGE_TOO_LONG", { max: 4000 }))
		expect(rendu).toContain("4000")
	})

	it("une règle inconnue retombe sur le code", () => {
		const err = { data: { code: "rateLimited", rule: "RÈGLE_INVENTÉE" } }
		expect(messageErreurLisible(err, t)).toBe(t("errors:rateLimited"))
	})

	it("retombe sur une phrase neutre SANS jamais montrer le message brut", () => {
		// Le `message` de Convex ne dit rien d'exploitable : la trace en dev,
		// « Server Error » en prod. Une phrase du serveur (forme du socle) n'est
		// plus une charge du moteur : elle n'est pas montrée non plus.
		for (const err of [
			new Error(messageDeDev),
			new Error("Server Error"),
			{ data: "Personne introuvable." },
			{ data: { code: "codeInconnu" } },
			{ data: { message: "Une phrase du serveur" } },
			{ data: "   " },
			{ data: 42 },
			{},
			null,
			undefined,
			"une chaîne nue",
		]) {
			const rendu = messageErreurLisible(err, t)
			expect(rendu).toBe(GENERIQUE)
			expect(rendu).not.toContain("CONVEX")
			expect(rendu).not.toContain("at ")
		}
	})
})
