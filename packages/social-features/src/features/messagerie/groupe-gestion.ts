// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-gestion.ts @ ad2e7fdc2 — adaptations : prédicats d'autorité lus dans le domaine du moteur (`@antsia/social-domain/groupThreads`) ; dates dans le fuseau du NAVIGATEUR et la langue courante (`dateDuGroupe` reçoit `locale`, plus de fuseau gabonais ni de `fr-FR` écrits en dur) ; tri et recherche sans langue écrite en dur (`ordonnerMembres` et `vueDeGestion` reçoivent `locale`, casse rabattue par `toLowerCase`) ; libellés de rôle, phrases de confirmation et lignes système traduits (`t` en DERNIER paramètre de `libelleDeRole`, `vueDeGestion`, `phraseDeSuppression`, `phraseDeDepart`, `phraseDEffacement`, `phraseDeRetrait`, `ligneSystemeDeGroupe` ; clés qualifiées `messagerie:groupeGestion.…`) ; places restantes comptées sur l'EFFECTIF du serveur (`effectif`, la fiche ne porte plus la liste complète des membres) ; projections `membreDuGroupe` et `convieDuGroupe` des DTO à libellé du moteur (`counterpartLabel` : nom nul = libellé neutre traduit). ; PA6 : préférence de fuseau injectée, calendrier grégorien et caches langue/fuseau.
/**
 * groupe-gestion — ce qu'un membre peut FAIRE dans un groupe, et ce que le
 * panneau doit lui montrer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE MODULE NE RÉ-ÉCRIT AUCUNE RÈGLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les prédicats d'autorité vivent dans le domaine pur du moteur
 * (`@antsia/social-domain/groupThreads`), écrit pour être atteint depuis le
 * client. Ce sont EXACTEMENT ceux que les mutations appliquent. Les recopier
 * ici donnerait deux définitions de « qui peut retirer qui » — et le jour où
 * elles divergent, l'écran propose un bouton que le serveur refuse, ou cache
 * une action qui était permise.
 *
 * Ce fichier compose ces prédicats en VUE : l'ordre des membres, les libellés,
 * la phrase de confirmation, ce qui reste possible quand le groupe est plein.
 * Cette part-là est de la présentation, elle n'a pas sa place côté serveur —
 * et laissée dans le corps du composant, elle ne serait vérifiable qu'à l'œil.
 *
 * Deux imports de valeurs, tous deux purs : les prédicats du domaine et le
 * plafond déjà miroité par le composeur.
 */

import { formatViewerDate } from "@antsia/api/civil-date"
import {
	canDeleteGroupThread,
	canInviteToGroupThread,
	canRemoveGroupThreadMember,
	canRenameGroupThread,
	canSetGroupThreadRole,
	type GroupThreadRole,
} from "@antsia/social-domain/groupThreads"
import type { TFunction } from "i18next"
import { GROUPE_MAX_MEMBRES } from "./groupe-composeur"

/**
 * Un membre, tel que la fiche le montre.
 *
 * `userId` porte l'identifiant de la PERSONNE (`persons`) : le nom du champ est
 * celui du socle, gardé pour les vues qui le lisent (fiche, sélecteur d'appel).
 */
export interface MembreDuGroupe {
	userId: string
	displayName: string
	handle: string | null
	avatarUrl: string | null
	role: GroupThreadRole
	isMe: boolean
	/** Date d'entrée effective dans le groupe, pas date d'invitation. */
	joinedAt: number
}

/** Quelqu'un de convié qui n'a pas encore répondu. */
export interface ConvieDuGroupe {
	userId: string
	displayName: string
	handle: string | null
	avatarUrl: string | null
	invitedAt: number
}

/** Ce que JE peux faire sur CETTE personne. */
export interface ActionsSurMembre {
	retirer: boolean
	/** `member` → `admin`. */
	promouvoir: boolean
	/** `admin` → `member`. */
	retrograder: boolean
}

export interface LigneDeMembre extends MembreDuGroupe {
	roleLabel: string
	actions: ActionsSurMembre
}

export interface VueDeGestion {
	renommer: boolean
	inviter: boolean
	supprimer: boolean
	/**
	 * Le groupe est-il PLEIN ? Les conviés comptent : vingt invitations en
	 * attente rempliraient le groupe à la première acceptation, et le serveur
	 * refuserait la suivante au moment le plus désagréable — celui où
	 * quelqu'un accepte.
	 */
	complet: boolean
	membres: LigneDeMembre[]
	convies: ConvieDuGroupe[]
	/** Le nombre de places restantes, conviés déduits. Jamais négatif. */
	placesRestantes: number
}

/**
 * La forme d'un nom rendu par le moteur (`counterpartLabel`) : `displayName`
 * NUL quand il n'y a rien à nommer — l'écran pose alors le libellé neutre.
 */
export interface LibelleDePersonne {
	displayName: string | null
	handle: string | null
	avatarUrl: string | null
}

/** Le libellé neutre d'une personne sans nom à montrer. */
export function nomAffichable(
	displayName: string | null,
	t: TFunction,
): string {
	const nom = displayName?.trim() ?? ""
	return nom.length > 0 ? nom : t("messagerie:groupeGestion.unnamedPerson")
}

/** Un membre du serveur (`groups.threads.paginateGroupMembers`), mis en vue. */
export function membreDuGroupe(
	membre: {
		personId: string
		label: LibelleDePersonne
		role: GroupThreadRole
		isMe: boolean
		joinedAt: number
	},
	t: TFunction,
): MembreDuGroupe {
	return {
		userId: String(membre.personId),
		displayName: nomAffichable(membre.label.displayName, t),
		handle: membre.label.handle,
		avatarUrl: membre.label.avatarUrl,
		role: membre.role,
		isMe: membre.isMe,
		joinedAt: membre.joinedAt,
	}
}

/** Un convié du serveur (`groups.threads.paginateGroupPendingInvites`), mis en vue. */
export function convieDuGroupe(
	convie: { personId: string; label: LibelleDePersonne; invitedAt: number },
	t: TFunction,
): ConvieDuGroupe {
	return {
		userId: String(convie.personId),
		displayName: nomAffichable(convie.label.displayName, t),
		handle: convie.label.handle,
		avatarUrl: convie.label.avatarUrl,
		invitedAt: convie.invitedAt,
	}
}

/** Le rôle, tel qu'il s'écrit à l'écran. */
export function libelleDeRole(role: GroupThreadRole, t: TFunction): string {
	switch (role) {
		case "owner":
			return t("messagerie:groupeGestion.role.owner")
		case "admin":
			return t("messagerie:groupeGestion.role.admin")
		case "member":
			return t("messagerie:groupeGestion.role.member")
	}
}

/** Le rang d'un rôle dans la liste — le propriétaire en tête. */
function rangDeRole(role: GroupThreadRole): number {
	switch (role) {
		case "owner":
			return 0
		case "admin":
			return 1
		case "member":
			return 2
	}
}

/**
 * L'ordre des membres : par AUTORITÉ, puis par nom.
 *
 * ⚠️ Un ordre par nom seul mettrait le propriétaire au milieu de la liste, et
 * il faudrait lire chaque étiquette pour savoir à qui s'adresser. Le tri par
 * nom départage à l'intérieur d'un rang — sans lui, l'ordre serait celui de la
 * base, c'est-à-dire l'ordre d'arrivée, qui n'a aucun sens pour un lecteur.
 *
 * `locale` : la langue de l'écran (absente : celle de l'environnement). Une
 * collation, quelle que soit la langue, classe « Étienne » avec les E.
 */
export function ordonnerMembres(
	membres: readonly MembreDuGroupe[],
	locale?: string,
): MembreDuGroupe[] {
	return [...membres].sort((a, b) => {
		const rang = rangDeRole(a.role) - rangDeRole(b.role)
		if (rang !== 0) return rang
		return a.displayName.localeCompare(b.displayName, locale)
	})
}

/**
 * La vue du panneau de gestion.
 *
 * ⚠️ `monRole` vient de `getGroupThread.myRole`, jamais de la ligne `isMe` de
 * la liste : un membre bloqué ou retiré entre deux rendus verrait sa ligne
 * disparaître, et l'autorité se calculerait alors sur `undefined`.
 *
 * `effectif` : le nombre de membres VIVANTS rendu par le serveur
 * (`memberCount`). La liste des membres se pagine désormais hors de la fiche :
 * tant qu'elle n'est pas entièrement chargée, sa longueur sous-compterait les
 * places prises. Absent, la longueur de la liste fait foi.
 */
export function vueDeGestion(
	input: {
		monRole: GroupThreadRole
		membres: readonly MembreDuGroupe[]
		convies: readonly ConvieDuGroupe[]
		ferme: boolean
		effectif?: number
		locale?: string
	},
	t: TFunction,
): VueDeGestion {
	// Un fil FERMÉ ne s'administre plus : il n'a plus de membres à retirer, plus
	// de titre qui serve, et rien à quoi convier. On rend la vue en lecture.
	const vivant = !input.ferme
	const effectif = Math.max(input.effectif ?? 0, input.membres.length)
	const occupees = effectif + input.convies.length
	const placesRestantes = Math.max(0, GROUPE_MAX_MEMBRES - occupees)

	const membres = ordonnerMembres(input.membres, input.locale).map(
		(membre): LigneDeMembre => {
			const commun = {
				actorRole: input.monRole,
				targetRole: membre.role,
				isSelf: membre.isMe,
			}
			return {
				...membre,
				roleLabel: libelleDeRole(membre.role, t),
				actions: {
					retirer: vivant && canRemoveGroupThreadMember(commun),
					promouvoir:
						vivant && canSetGroupThreadRole({ ...commun, nextRole: "admin" }),
					retrograder:
						vivant && canSetGroupThreadRole({ ...commun, nextRole: "member" }),
				},
			}
		},
	)

	return {
		renommer: vivant && canRenameGroupThread(input.monRole),
		inviter:
			vivant && canInviteToGroupThread(input.monRole) && placesRestantes > 0,
		supprimer: vivant && canDeleteGroupThread(input.monRole),
		complet: placesRestantes === 0,
		membres,
		convies: [...input.convies].sort((a, b) => a.invitedAt - b.invitedAt),
		placesRestantes,
	}
}

/**
 * La phrase de la double confirmation de suppression.
 *
 * Elle NOMME le nombre de personnes, parce que c'est la seule information qui
 * fait hésiter : « supprimer le groupe » se lit comme « le retirer de MA
 * liste » tant qu'on ne dit pas que dix-neuf autres perdent la conversation.
 * C'est le seul geste du module qui détruise le bien d'autrui.
 */
export function phraseDeSuppression(
	input: { titre: string; memberCount: number },
	t: TFunction,
): string {
	const autres = Math.max(0, input.memberCount - 1)
	if (autres === 0) {
		return t("messagerie:groupeGestion.deleteAlone", { titre: input.titre })
	}
	if (autres === 1) {
		return t("messagerie:groupeGestion.deleteOneOther", { titre: input.titre })
	}
	return t("messagerie:groupeGestion.deleteOthers", {
		titre: input.titre,
		autres,
	})
}

/**
 * La phrase du départ — distincte de la précédente, et pour cause.
 *
 * Quitter ne détruit rien pour les autres ; le dire évite qu'un propriétaire
 * hésitant choisisse « supprimer » en croyant qu'il n'a que ce moyen de sortir.
 */
export function phraseDeDepart(
	input: { titre: string; jeSuisProprietaire: boolean },
	t: TFunction,
): string {
	const base = t("messagerie:groupeGestion.leave", { titre: input.titre })
	return input.jeSuisProprietaire
		? `${base} ${t("messagerie:groupeGestion.leaveOwner")}`
		: base
}

/**
 * Effacer n'est ni quitter, ni supprimer le bien collectif. La phrase nomme
 * ce qui disparaît ET ce qui reste afin que le second appui soit éclairé.
 */
export function phraseDEffacement(titre: string, t: TFunction): string {
	return t("messagerie:groupeGestion.clear", { titre })
}

/** Une personne doit être nommée avant son retrait, jamais désignée par « ce membre ». */
export function phraseDeRetrait(displayName: string, t: TFunction): string {
	return t("messagerie:groupeGestion.remove", { nom: displayName })
}

/**
 * Recherche tolérante aux accents, appliquée au nom comme à l'identifiant.
 * « etienne » trouve donc « Étienne », comportement attendu d'un annuaire.
 * La casse se rabat sans langue écrite en dur (`toLowerCase`) : après le retrait
 * des diacritiques, la même règle vaut pour le français et l'anglais.
 */
export function filtrerMembres<T extends MembreDuGroupe>(
	membres: readonly T[],
	recherche: string,
): T[] {
	const normaliser = (valeur: string) =>
		valeur
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase()
	const filtre = normaliser(recherche.trim())
	if (filtre.length === 0) return [...membres]
	return membres.filter((membre) =>
		normaliser(
			`${membre.displayName} ${membre.handle === null ? "" : membre.handle}`,
		).includes(filtre),
	)
}

/**
 * Dates du groupe, dans le fuseau du LECTEUR et la langue de l'écran
 * (`locale` ; absente : celle de l'environnement). Le socle les figeait dans
 * le fuseau gabonais et en français : une personne du réseau vit où elle vit.
 */
export function dateDuGroupe(
	timestamp: number,
	avecHeure = false,
	locale?: string,
	timeZone?: string,
): string {
	return formatViewerDate(timestamp, locale, {
		dateStyle: "medium",
		...(avecHeure ? { timeStyle: "short" as const } : {}),
	}, timeZone)
}

/**
 * Les six événements système d'un fil de groupe, en une phrase.
 *
 * ⚠️ Trois d'entre eux — `member_joined`, `member_removed`, `group_renamed` —
 * sont arrivés avec l'administration du groupe et n'avaient AUCUNE phrase : la
 * fonction du composant ne connaissait que les trois d'origine et rendait la
 * chaîne vide par défaut. Le fil affichait donc une ligne système VIDE à
 * chaque arrivée, chaque retrait, chaque renommage — et le typage ne le disait
 * qu'au prix d'une erreur que rien n'obligeait à lire.
 *
 * L'exhaustivité est désormais VÉRIFIÉE par le compilateur : le `switch` n'a
 * pas de branche par défaut, et tout événement ajouté au validateur fera
 * échouer le typage ici tant qu'il n'aura pas sa phrase.
 */
export type EvenementSystemeGroupe =
	| "group_created"
	| "member_left"
	| "call_started"
	| "member_joined"
	| "member_removed"
	| "group_renamed"

export function ligneSystemeDeGroupe(
	input: {
		event: EvenementSystemeGroupe | null
		/** Le nom de l'ÉMETTEUR — celui qui a fait le geste. */
		auteur: string
		/** La personne VISÉE, quand l'événement en désigne une autre. */
		cible?: string | null
	},
	t: TFunction,
): string {
	if (input.event === null) return ""
	const auteur = input.auteur
	switch (input.event) {
		case "group_created":
			return t("messagerie:groupeGestion.systemLine.groupCreated", { auteur })
		case "member_left":
			return t("messagerie:groupeGestion.systemLine.memberLeft", { auteur })
		case "call_started":
			return t("messagerie:groupeGestion.systemLine.callStarted", { auteur })
		case "member_joined":
			return t("messagerie:groupeGestion.systemLine.memberJoined", { auteur })
		case "member_removed":
			// Sans cible nommée, on ne prétend pas savoir qui : « un membre »
			// est vrai, « personne » serait faux, et une ligne vide serait pire.
			return input.cible === undefined || input.cible === null
				? t("messagerie:groupeGestion.systemLine.memberRemovedUnnamed", {
						auteur,
					})
				: t("messagerie:groupeGestion.systemLine.memberRemoved", {
						auteur,
						cible: input.cible,
					})
		case "group_renamed":
			return t("messagerie:groupeGestion.systemLine.groupRenamed", { auteur })
	}
}
