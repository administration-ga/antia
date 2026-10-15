// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-gestion.test.ts @ ad2e7fdc2 — adaptations : phrases et libellés lus par un `t` français (`createAppI18n`, `t` en dernier paramètre) ; tri par nom avec la langue passée (`locale`) ; dates dans le fuseau de l'environnement et la langue demandée (le cas « fuseau gabonais » devient « fuseau du navigateur, langue de l'écran ») ; cas neufs : places comptées sur l'effectif du serveur (`effectif`), projections `membreDuGroupe` / `convieDuGroupe` du contrat `counterpartLabel` (nom nul = libellé neutre), lignes système en anglais.
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import { GROUPE_MAX_MEMBRES } from "./groupe-composeur"
import {
	convieDuGroupe,
	dateDuGroupe,
	filtrerMembres,
	libelleDeRole,
	ligneSystemeDeGroupe,
	membreDuGroupe,
	nomAffichable,
	ordonnerMembres,
	phraseDeDepart,
	phraseDEffacement,
	phraseDeRetrait,
	phraseDeSuppression,
	vueDeGestion,
	type ConvieDuGroupe,
	type MembreDuGroupe,
} from "./groupe-gestion"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t

const membre = (
	id: string,
	role: MembreDuGroupe["role"],
	nom: string,
	isMe = false,
): MembreDuGroupe => ({
	userId: id,
	displayName: nom,
	handle: nom.toLowerCase(),
	avatarUrl: null,
	role,
	isMe,
	joinedAt: 1_700_000_000_000,
})

const convie = (id: string, nom: string, invitedAt: number): ConvieDuGroupe => ({
	userId: id,
	displayName: nom,
	handle: nom.toLowerCase(),
	avatarUrl: null,
	invitedAt,
})

describe("ordonnerMembres — l'autorité d'abord, le nom ensuite", () => {
	it("met le propriétaire en tête, puis les administrateurs, puis les membres", () => {
		const ordre = ordonnerMembres([
			membre("3", "member", "Zita"),
			membre("1", "owner", "Yann"),
			membre("2", "admin", "Xavier"),
		]).map((m) => m.displayName)
		expect(ordre).toEqual(["Yann", "Xavier", "Zita"])
	})

	it("départage par NOM à rang égal — sans quoi l'ordre est celui de la base", () => {
		const ordre = ordonnerMembres(
			[
				membre("3", "member", "Étienne"),
				membre("2", "member", "Alice"),
				membre("1", "member", "Zoé"),
			],
			"fr",
		).map((m) => m.displayName)
		// Une collation classe « Étienne » après « Alice », pas après « Zoé » :
		// un tri par point de code mettrait les accents en dernier.
		expect(ordre).toEqual(["Alice", "Étienne", "Zoé"])
	})

	it("ne mute pas le tableau reçu", () => {
		const source = [membre("2", "member", "Bob"), membre("1", "owner", "Ana")]
		ordonnerMembres(source)
		expect(source[0]!.displayName).toBe("Bob")
	})
})

describe("vueDeGestion — l'autorité vient des prédicats du domaine", () => {
	const troisMembres = [
		membre("1", "owner", "Ana"),
		membre("2", "admin", "Bob"),
		membre("3", "member", "Cléa"),
	]

	it("le PROPRIÉTAIRE peut tout — renommer, inviter, supprimer", () => {
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: troisMembres.map((m) => ({ ...m, isMe: m.userId === "1" })),
				convies: [],
				ferme: false,
			},
			t,
		)
		expect(vue.renommer).toBe(true)
		expect(vue.inviter).toBe(true)
		expect(vue.supprimer).toBe(true)
	})

	it("un ADMINISTRATEUR renomme et invite, mais ne supprime pas", () => {
		const vue = vueDeGestion(
			{
				monRole: "admin",
				membres: troisMembres.map((m) => ({ ...m, isMe: m.userId === "2" })),
				convies: [],
				ferme: false,
			},
			t,
		)
		expect(vue.renommer).toBe(true)
		expect(vue.inviter).toBe(true)
		expect(vue.supprimer).toBe(false)
	})

	it("un MEMBRE simple n'a d'autorité sur personne", () => {
		const vue = vueDeGestion(
			{
				monRole: "member",
				membres: troisMembres.map((m) => ({ ...m, isMe: m.userId === "3" })),
				convies: [],
				ferme: false,
			},
			t,
		)
		expect(vue.renommer).toBe(false)
		expect(vue.inviter).toBe(false)
		expect(vue.supprimer).toBe(false)
		expect(vue.membres.every((m) => !m.actions.retirer)).toBe(true)
	})

	it("un administrateur ne retire ni le propriétaire, ni un PAIR, ni lui-même", () => {
		const vue = vueDeGestion(
			{
				monRole: "admin",
				membres: [
					membre("1", "owner", "Ana"),
					membre("2", "admin", "Bob", true),
					membre("4", "admin", "Dora"),
					membre("3", "member", "Cléa"),
				],
				convies: [],
				ferme: false,
			},
			t,
		)
		const par = Object.fromEntries(vue.membres.map((m) => [m.displayName, m]))
		expect(par.Ana!.actions.retirer).toBe(false)
		expect(par.Bob!.actions.retirer).toBe(false)
		expect(par.Dora!.actions.retirer).toBe(false)
		// Le seul qu'il puisse retirer : un membre simple.
		expect(par["Cléa"]!.actions.retirer).toBe(true)
	})

	it("seul le propriétaire distribue l'administration, et jamais à lui-même", () => {
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: [
					membre("1", "owner", "Ana", true),
					membre("2", "admin", "Bob"),
					membre("3", "member", "Cléa"),
				],
				convies: [],
				ferme: false,
			},
			t,
		)
		const par = Object.fromEntries(vue.membres.map((m) => [m.displayName, m]))
		expect(par["Cléa"]!.actions.promouvoir).toBe(true)
		expect(par["Cléa"]!.actions.retrograder).toBe(false)
		expect(par.Bob!.actions.retrograder).toBe(true)
		expect(par.Bob!.actions.promouvoir).toBe(false)
		expect(par.Ana!.actions.promouvoir).toBe(false)
		expect(par.Ana!.actions.retrograder).toBe(false)
	})

	it("les CONVIÉS occupent une place — inviter se ferme avant l'acceptation", () => {
		// Le plafond MOINS deux membres, plus deux conviés : les places sont
		// toutes prises. Une invitation de plus serait refusée par le serveur au
		// moment où quelqu'un accepte, c'est-à-dire au pire moment.
		//
		// ⚠️ Le compte se DÉRIVE du plafond du contrat, il ne se recopie
		// plus : la version en dur disait dix-neuf, et elle serait passée au
		// vert en cessant de tester quoi que ce soit le jour où le plafond a
		// bougé.
		const beaucoup = Array.from({ length: GROUPE_MAX_MEMBRES - 2 }, (_, i) =>
			membre(String(i + 10), i === 0 ? "owner" : "member", `Membre ${i}`, i === 0),
		)
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: beaucoup,
				convies: [convie("a", "Convié A", 1), convie("b", "Convié B", 2)],
				ferme: false,
			},
			t,
		)
		expect(vue.placesRestantes).toBe(0)
		expect(vue.complet).toBe(true)
		expect(vue.inviter).toBe(false)
	})

	it("les conviés sont rendus du plus ANCIEN au plus récent", () => {
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: [membre("1", "owner", "Ana", true)],
				convies: [convie("b", "Tardif", 900), convie("a", "Précoce", 100)],
				ferme: false,
			},
			t,
		)
		expect(vue.convies.map((c) => c.displayName)).toEqual([
			"Précoce",
			"Tardif",
		])
	})

	it("l'EFFECTIF du serveur compte les places, même avant que la liste soit chargée", () => {
		// La fiche pagine ses membres : tant que toutes les pages ne sont pas
		// arrivées, la longueur de la liste sous-compterait les places prises.
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: [membre("1", "owner", "Ana", true)],
				convies: [convie("a", "Convié A", 1)],
				ferme: false,
				effectif: GROUPE_MAX_MEMBRES - 1,
			},
			t,
		)
		expect(vue.placesRestantes).toBe(0)
		expect(vue.complet).toBe(true)
		expect(vue.inviter).toBe(false)
		// Une liste plus longue que l'effectif annoncé (rendu en retard) fait foi.
		const enAvance = vueDeGestion(
			{
				monRole: "owner",
				membres: [membre("1", "owner", "Ana", true), membre("2", "member", "Bob")],
				convies: [],
				ferme: false,
				effectif: 1,
			},
			t,
		)
		expect(enAvance.placesRestantes).toBe(GROUPE_MAX_MEMBRES - 2)
	})

	it("un fil FERMÉ ne s'administre plus, quel que soit le rôle", () => {
		const vue = vueDeGestion(
			{
				monRole: "owner",
				membres: troisMembres.map((m) => ({ ...m, isMe: m.userId === "1" })),
				convies: [],
				ferme: true,
			},
			t,
		)
		expect(vue.renommer).toBe(false)
		expect(vue.inviter).toBe(false)
		expect(vue.supprimer).toBe(false)
		expect(vue.membres.every((m) => !m.actions.retirer)).toBe(true)
	})
})

describe("les phrases de confirmation disent ce qui est en jeu", () => {
	it("la suppression NOMME les autres — c'est ce qui fait hésiter", () => {
		const phrase = phraseDeSuppression({ titre: "Cellule veille", memberCount: 20 }, t)
		expect(phrase).toContain("Cellule veille")
		expect(phrase).toContain("19 autres membres")
		expect(phrase).toContain("irréversible")
	})

	it("s'accorde au singulier, et ne parle de personne quand on est seul", () => {
		expect(
			phraseDeSuppression({ titre: "G", memberCount: 2 }, t),
		).toContain("l'autre membre")
		expect(phraseDeSuppression({ titre: "G", memberCount: 1 }, t)).toContain(
			"pour vous",
		)
	})

	it("quitter ne détruit rien, et le propriétaire apprend qui hérite", () => {
		expect(
			phraseDeDepart({ titre: "G", jeSuisProprietaire: false }, t),
		).not.toContain("propriété")
		expect(
			phraseDeDepart({ titre: "G", jeSuisProprietaire: true }, t),
		).toContain("membre le plus ancien")
	})

	it("distingue l'effacement personnel du départ et de la suppression", () => {
		const phrase = phraseDEffacement("Cellule veille", t)
		expect(phrase).toContain("Cellule veille")
		expect(phrase).toContain("votre vue uniquement")
		expect(phrase).toContain("resterez membre")
		expect(phrase).toContain("prochains messages")
	})

	it("nomme la personne avant son retrait", () => {
		const phrase = phraseDeRetrait("Cléa Bivigou", t)
		expect(phrase).toContain("Cléa Bivigou")
		expect(phrase).toContain("nouveaux messages")
	})
})

describe("recherche et dates de la fiche groupe", () => {
	it("recherche dans le nom et l'identifiant sans dépendre des accents", () => {
		const membres = [
			membre("1", "owner", "Étienne Mba"),
			membre("2", "member", "Alice", false),
		]
		membres[1] = { ...membres[1]!, handle: "agent.public" }

		expect(filtrerMembres(membres, "etienne")).toHaveLength(1)
		expect(filtrerMembres(membres, "agent.public")[0]?.displayName).toBe(
			"Alice",
		)
		expect(filtrerMembres(membres, "  ")).toHaveLength(2)
	})

	it("rend les dates dans le fuseau du navigateur et la langue de l'écran", () => {
		const instant = Date.UTC(2026, 7, 25, 12, 5)
		// Le jour et l'heure sont ceux de l'environnement qui affiche — plus le
		// fuseau gabonais écrit en dur — et le mois suit la langue demandée.
		const local = new Date(instant)
		expect(dateDuGroupe(instant, false, "fr")).toContain(`${local.getDate()} août 2026`)
		expect(dateDuGroupe(instant, false, "en")).toContain("Aug")
		const heure = new Intl.DateTimeFormat("fr", { timeStyle: "short" }).format(local)
		expect(dateDuGroupe(instant, true, "fr")).toContain(heure)
	})
})

describe("libelleDeRole", () => {
	it("nomme les trois rôles en français", () => {
		expect(libelleDeRole("owner", t)).toBe("Propriétaire")
		expect(libelleDeRole("admin", t)).toBe("Administrateur")
		expect(libelleDeRole("member", t)).toBe("Membre")
	})
})

describe("ligneSystemeDeGroupe — les SIX événements ont une phrase", () => {
	it("nomme les trois événements d'origine", () => {
		expect(
			ligneSystemeDeGroupe({ event: "group_created", auteur: "Ana" }, t),
		).toBe("Ana a créé le groupe")
		expect(ligneSystemeDeGroupe({ event: "member_left", auteur: "Ana" }, t)).toBe(
			"Ana a quitté la conversation",
		)
		expect(
			ligneSystemeDeGroupe({ event: "call_started", auteur: "Ana" }, t),
		).toBe("Ana a démarré un appel")
	})

	it("nomme les TROIS ajoutés avec l'administration — ils rendaient une ligne VIDE", () => {
		// Le défaut : la fonction du composant ne connaissait que les trois
		// premiers et retombait sur `""`. Le fil affichait une ligne système
		// sans texte à chaque arrivée, chaque retrait, chaque renommage.
		expect(
			ligneSystemeDeGroupe({ event: "member_joined", auteur: "Bob" }, t),
		).toBe("Bob a rejoint le groupe")
		expect(
			ligneSystemeDeGroupe({ event: "group_renamed", auteur: "Bob" }, t),
		).toBe("Bob a renommé le groupe")
		expect(
			ligneSystemeDeGroupe({
				event: "member_removed",
				auteur: "Ana",
				cible: "Cléa",
			}, t),
		).toBe("Ana a retiré Cléa du groupe")
	})

	it("un retrait sans cible nommée reste VRAI plutôt que vide", () => {
		expect(
			ligneSystemeDeGroupe({ event: "member_removed", auteur: "Ana" }, t),
		).toBe("Ana a retiré un membre du groupe")
		expect(
			ligneSystemeDeGroupe({
				event: "member_removed",
				auteur: "Ana",
				cible: null,
			}, t),
		).toBe("Ana a retiré un membre du groupe")
	})

	it("aucun événement ne rend la chaîne vide — sauf l'absence d'événement", () => {
		const tous = [
			"group_created",
			"member_left",
			"call_started",
			"member_joined",
			"member_removed",
			"group_renamed",
		] as const
		for (const event of tous) {
			expect(
				ligneSystemeDeGroupe({ event, auteur: "Ana", cible: "Bob" }, t),
				event,
			).not.toBe("")
		}
		expect(ligneSystemeDeGroupe({ event: null, auteur: "Ana" }, t)).toBe("")
	})
})

describe("ligneSystemeDeGroupe — dans la langue de l'écran", () => {
	it("nomme l'auteur et la cible en anglais aussi", () => {
		expect(ligneSystemeDeGroupe({ event: "group_created", auteur: "Ana" }, tEn)).toBe(
			"Ana created the group",
		)
		expect(
			ligneSystemeDeGroupe({ event: "member_removed", auteur: "Ana", cible: "Cléa" }, tEn),
		).toBe("Ana removed Cléa from the group")
	})
})

describe("projections du serveur — le nom vient du contrat counterpartLabel", () => {
	it("met en vue un membre et un convié, l'identifiant de la personne gardé", () => {
		const membreVu = membreDuGroupe(
			{
				personId: "persons_1",
				label: { displayName: "Ana Mba", handle: "ana", avatarUrl: null },
				role: "admin",
				isMe: false,
				joinedAt: 5,
			},
			t,
		)
		expect(membreVu).toEqual({
			userId: "persons_1",
			displayName: "Ana Mba",
			handle: "ana",
			avatarUrl: null,
			role: "admin",
			isMe: false,
			joinedAt: 5,
		})
		const convieVu = convieDuGroupe(
			{ personId: "persons_2", label: { displayName: "Bob", handle: null, avatarUrl: null }, invitedAt: 9 },
			t,
		)
		expect(convieVu).toEqual({ userId: "persons_2", displayName: "Bob", handle: null, avatarUrl: null, invitedAt: 9 })
	})

	it("un nom NUL (rien à nommer) devient le libellé neutre, jamais une chaîne vide", () => {
		const anonyme = membreDuGroupe(
			{
				personId: "persons_3",
				label: { displayName: null, handle: null, avatarUrl: null },
				role: "member",
				isMe: false,
				joinedAt: 1,
			},
			t,
		)
		expect(anonyme.displayName).toBe("Personne du réseau")
		expect(nomAffichable("   ", tEn)).toBe("Network member")
		expect(nomAffichable("Cléa", t)).toBe("Cléa")
	})
})
