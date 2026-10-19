// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-liste.test.ts @ ad2e7fdc2 — adaptations : horodatage dans la langue passée en paramètre (français, et anglais pour prouver qu'aucune langue n'est écrite en dur) ; aperçu et état vide lus dans les locales (instance i18n du moteur) ; cas ajoutés pour `apercuFil` (vocal, pièces, appel, retrait — le moteur ne dénormalise que la nature du dernier message) ; correspondant sans nom (libellé neutre) toléré par le filtre ; cas « liste vide du Poste » retiré avec la source de poste (l'état vide garde la création de groupe).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	apercuFil,
	apercuThread,
	filtrerThreads,
	formatThreadTime,
	messageListeVide,
	normaliseRecherche,
} from "./messagerie-liste"

const t = createAppI18n({
	locale: "fr",
	appResources: { fr: {}, en: {} },
	defaultNS: "messagerie",
}).t

const fil = (displayName: string | null, handle?: string | null) => ({
	counterpart: { displayName, handle },
})

describe("repli de comparaison", () => {
	it("ignore accents, casse et espaces de bord", () => {
		expect(normaliseRecherche("  MENGUE MÉ NZOGHE  ")).toBe("mengue me nzoghe")
		expect(normaliseRecherche("Éric Ndong")).toBe("eric ndong")
	})
})

describe("filtrage des conversations", () => {
	const liste = [
		fil("Laurence MENGUE MÉ NZOGHE", "l.mengue"),
		fil("Directeur Général de la Fonction Publique", "dgfp"),
		fil("Éric Ndong", null),
	]

	it("rend la liste ENTIÈRE, et la même référence, sur une requête vide", () => {
		// La même référence : effacer le champ ne doit pas relancer le rendu.
		expect(filtrerThreads(liste, "")).toBe(liste)
		expect(filtrerThreads(liste, "   ")).toBe(liste)
	})

	it("trouve par le nom, SANS les accents", () => {
		// On écrit les noms avec accents et on les cherche sans : c'est le cas
		// normal, pas le cas limite.
		expect(filtrerThreads(liste, "mengue")).toHaveLength(1)
		expect(filtrerThreads(liste, "eric")).toHaveLength(1)
		expect(filtrerThreads(liste, "ÉRIC")).toHaveLength(1)
	})

	it("trouve par l'identifiant", () => {
		expect(filtrerThreads(liste, "dgfp")).toHaveLength(1)
	})

	it("supporte un correspondant sans identifiant", () => {
		expect(() => filtrerThreads(liste, "ndong")).not.toThrow()
		expect(filtrerThreads(liste, "ndong")).toHaveLength(1)
	})

	it("supporte un correspondant SANS NOM (libellé neutre), trouvable par son identifiant", () => {
		const avecInconnu = [...liste, fil(null, "inconnu.ga"), fil(null, null)]
		expect(() => filtrerThreads(avecInconnu, "inconnu")).not.toThrow()
		expect(filtrerThreads(avecInconnu, "inconnu")).toHaveLength(1)
	})

	it("rend une liste vide quand rien ne correspond", () => {
		expect(filtrerThreads(liste, "zzz")).toHaveLength(0)
	})
})

describe("horodatage d'une ligne", () => {
	// 12 août 2026, 18:02 — l'heure des captures de référence.
	const maintenant = new Date(2026, 7, 12, 18, 2).getTime()

	it("donne l'HEURE le jour même", () => {
		const tantot = new Date(2026, 7, 12, 9, 30).getTime()
		expect(formatThreadTime(tantot, maintenant, "fr")).toMatch(/09.30/)
	})

	it("dit « hier » la veille, quel que soit le mois", () => {
		expect(formatThreadTime(new Date(2026, 7, 11, 23, 59).getTime(), maintenant, "fr")).toBe("hier")
		// Bascule de mois : le 31 juillet est bien la veille du 1er août.
		const premierAout = new Date(2026, 7, 1, 8, 0).getTime()
		expect(formatThreadTime(new Date(2026, 6, 31, 20, 0).getTime(), premierAout, "fr")).toBe("hier")
	})

	it("donne le jour et le mois dans l'année courante", () => {
		const enJuillet = new Date(2026, 6, 24, 12, 0).getTime()
		const rendu = formatThreadTime(enJuillet, maintenant, "fr")
		expect(rendu).toContain("24")
		expect(rendu).not.toContain("2026")
	})

	it("ajoute l'ANNÉE au-delà — sans quoi « 26 déc. » serait ambigu", () => {
		const noelDernier = new Date(2025, 11, 26, 12, 0).getTime()
		expect(formatThreadTime(noelDernier, maintenant, "fr")).toContain("2025")
	})

	it("rend une chaîne VIDE pour un fil sans message", () => {
		expect(formatThreadTime(null, maintenant, "fr")).toBe("")
		expect(formatThreadTime(Number.NaN, maintenant, "fr")).toBe("")
	})

	it("suit la langue de l'écran — aucune langue écrite en dur", () => {
		const veille = new Date(2026, 7, 11, 12, 0).getTime()
		expect(formatThreadTime(veille, maintenant, "en")).toBe("yesterday")
		const enJuillet = new Date(2026, 6, 24, 12, 0).getTime()
		expect(formatThreadTime(enJuillet, maintenant, "en")).toBe("Jul 24")
		expect(formatThreadTime(enJuillet, maintenant, "fr")).toBe("24 juil.")
	})
})

describe("aperçu d'une ligne", () => {
	it("préfixe ce que J'AI écrit", () => {
		expect(apercuThread("Bonjour", true, t)).toBe("Vous : Bonjour")
		expect(apercuThread("Bonjour", false, t)).toBe("Bonjour")
	})

	it("n'échappe pas le texte de l'utilisateur — React s'en charge", () => {
		expect(apercuThread("A & B <i>", true, t)).toBe("Vous : A & B <i>")
	})

	it("annonce un fil sans message plutôt qu'un vide", () => {
		expect(apercuThread(null, false, t)).toBe("Aucun message pour l'instant")
		expect(apercuThread("   ", true, t)).toBe("Aucun message pour l'instant")
	})
})

describe("aperçu d'une ligne selon la NATURE du dernier message", () => {
	const ligne = (partiel: Partial<Parameters<typeof apercuFil>[0]>) => ({
		lastMessageText: null,
		lastMessageByMe: false,
		lastMessageKind: null,
		lastMessageAttachmentCount: null,
		lastMessageDeleted: false,
		...partiel,
	})

	it("un texte reste un texte, préfixé s'il est de moi", () => {
		expect(apercuFil(ligne({ lastMessageText: "Salut", lastMessageKind: "text" }), t)).toBe("Salut")
		expect(
			apercuFil(ligne({ lastMessageText: "Salut", lastMessageKind: "text", lastMessageByMe: true }), t),
		).toBe("Vous : Salut")
	})

	it("un vocal se dit vocal — jamais « aucun message »", () => {
		expect(apercuFil(ligne({ lastMessageKind: "voice", lastMessageAttachmentCount: 1 }), t)).toBe("Message vocal")
		expect(
			apercuFil(ligne({ lastMessageKind: "voice", lastMessageByMe: true }), t),
		).toBe("Vous : Message vocal")
	})

	it("des pièces se comptent, au pluriel juste", () => {
		expect(apercuFil(ligne({ lastMessageKind: "attachments", lastMessageAttachmentCount: 1 }), t)).toBe("1 pièce jointe")
		expect(apercuFil(ligne({ lastMessageKind: "attachments", lastMessageAttachmentCount: 3 }), t)).toBe("3 pièces jointes")
	})

	it("un appel se dit appel", () => {
		expect(apercuFil(ligne({ lastMessageKind: "call" }), t)).toBe("Appel")
	})

	it("une dernière ligne retirée se dit retirée", () => {
		expect(apercuFil(ligne({ lastMessageKind: "text", lastMessageDeleted: true }), t)).toBe("Message supprimé")
	})

	it("un fil vide garde son invite", () => {
		expect(apercuFil(ligne({}), t)).toBe("Aucun message pour l'instant")
	})
})

describe("liste vide", () => {
	it("conserve la création de groupe à côté du nouveau message", () => {
		const texte = messageListeVide(t)
		expect(texte).toContain("Nouveau message")
		expect(texte).toContain("Nouveau groupe")
	})
})
