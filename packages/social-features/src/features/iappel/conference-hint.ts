// Dupliqué de socle/packages/agent-features/src/features/iappel/conference-hint.ts @ ad2e7fdc2 — adaptations : comptes exemptés retirés (`exempt` : aucun compte « illimité » dans le moteur, le plafond est constant) ; contexte d'équipe de poste retiré (`team`, « toute l'équipe ») ; conférence = le DIRECT du réseau (lot `live`) et non iRéunion ; textes traduits par i18n (`t` ajouté en dernier paramètre de `conferenceHintCopy`, clés `iappel:conferenceHint.…`).
/**
 * conference-hint — QUAND le téléphone iCom oriente vers la CONFÉRENCE, et
 * avec quels mots (ADR-0149, fiche « Appels de groupe de 2 à 11 » §6.2).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE PRODUIT DIT LA SORTIE AVANT LE REFUS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un appel de groupe s'arrête à onze personnes (appelant compris). Au-delà, on
 * ne « téléphone » plus : on se réunit, et le réseau a l'outil — la
 * conférence (un DIRECT), qui se lance tout de suite, porte un titre, se
 * REJOINT et accueille tout le monde. Le serveur refuse toujours au-delà du
 * plafond (ceinture et bretelles) ; mais un refus est un geste perdu. La carte
 * « Conférence » arrive donc AVANT, aux trois moments où le plafond se
 * rencontre :
 *
 *  · T1 — « Appeler le groupe » sur un fil plus grand que le plafond :
 *    choix BLOQUANT (dialogue) entre choisir ses interlocuteurs et réunir
 *    tout le groupe en conférence ;
 *  · T2 — la dernière case cochable du sélecteur : l'appel est complet,
 *    carte NON bloquante (statut), une seule fois par ouverture ;
 *  · T3 — en cours d'appel, le dernier siège pris : une LIGNE d'information
 *    à la place de la barre « Ajouter » — jamais un bouton inerte.
 *
 * Ce module DÉCIDE et COMPOSE ; il ne rend rien. `ConferenceHintCard.tsx` le
 * dessine, dans le téléphone (`.iappel-hosted`, le sélecteur, la grille) —
 * jamais dehors (ADR-0148). Module PUR, testé en `node` ; les textes passent
 * par la fonction de traduction REÇUE (`t`, clés `iappel:conferenceHint.…`).
 */

import type { TFunction } from "i18next"

import { maxCorrespondents } from "./group-call-capacity"

export type ConferenceHintKind = "T1" | "T2" | "T3"

/** Où en est le geste — c'est ce qui décide quelle carte peut s'afficher. */
export type ConferenceHintMoment = "before" | "picking" | "in_call"

export interface ConferenceHintInput {
	moment: ConferenceHintMoment
	/** Plafond de l'APPEL, appelant compris — lu du serveur, jamais deviné. */
	capacity: number
	/** Membres du fil (moment `before`). Inconnu ⇒ on ne conclut rien. */
	members?: number | null
	/** Correspondants cochés (moment `picking`). */
	picked?: number
	/** Places restantes dans l'appel (moment `in_call`) ; inconnu ⇒ rien. */
	seats?: number | null
	/** Cartes déjà fermées dans CE contexte (cette ouverture, ce fil). */
	dismissed?: ReadonlySet<ConferenceHintKind>
}

/**
 * Quelle carte, maintenant — ou aucune.
 *
 * Une seule carte à la fois, et jamais deux fois tant qu'elle a été fermée :
 * la mémoire de fermeture appartient à l'appelant (une ouverture du
 * sélecteur, un fil), pas à ce module.
 */
export function planConferenceHint(
	input: ConferenceHintInput,
): { kind: ConferenceHintKind } | null {
	const dismissed = input.dismissed ?? new Set<ConferenceHintKind>()
	switch (input.moment) {
		case "before": {
			if (typeof input.members !== "number") return null
			if (input.members <= input.capacity) return null
			if (dismissed.has("T1")) return null
			return { kind: "T1" }
		}
		case "picking": {
			const picked = input.picked ?? 0
			if (picked < maxCorrespondents(input.capacity)) return null
			if (dismissed.has("T2")) return null
			return { kind: "T2" }
		}
		case "in_call": {
			// Un appel plein est plein. T3 ne se ferme pas — c'est un état, pas
			// un avis.
			if (typeof input.seats !== "number") return null
			if (input.seats > 0) return null
			return { kind: "T3" }
		}
	}
}

/**
 * D'OÙ part le geste — le mot qui nomme l'audience de la conférence.
 *
 *  · `thread` : « tout le groupe » — le fil a un nom et des membres, la
 *    conférence les accueille tous.
 *
 * Le socle connaissait aussi l'équipe d'un poste (« toute l'équipe ») : elle
 * n'existe pas dans le moteur. Le type reste, à une valeur, pour les écrans
 * qui le passent déjà.
 */
export type ConferenceHintContext = "thread"

export interface ConferenceHintCopy {
	/** Sur-titre en capitales espacées : « T1 · AVANT L'APPEL ». */
	eyebrow: string
	title: string
	body: string
	/** L'action principale (T1 : choisir ; T2/T3 : lancer une conférence). */
	primary: string
	/** L'action secondaire — absente sur T3, qui n'a qu'un lien. */
	secondary: string | null
}

export function conferenceHintCopy(
	kind: ConferenceHintKind,
	input: { capacity: number; members?: number | null; context?: ConferenceHintContext },
	t: TFunction,
): ConferenceHintCopy {
	const capacity = Math.max(3, Math.floor(input.capacity))
	const others = maxCorrespondents(capacity)
	const audience = t("iappel:conferenceHint.audience.thread")
	switch (kind) {
		case "T1": {
			const members = input.members ?? 0
			return {
				eyebrow: t("iappel:conferenceHint.t1.eyebrow"),
				title: t("iappel:conferenceHint.t1.title", { members }),
				body: t("iappel:conferenceHint.t1.body", { capacity, others, audience }),
				primary: t("iappel:conferenceHint.t1.primary", { others }),
				secondary: t("iappel:conferenceHint.launch"),
			}
		}
		case "T2":
			return {
				eyebrow: t("iappel:conferenceHint.t2.eyebrow"),
				title: t("iappel:conferenceHint.t2.title", { others }),
				body: t("iappel:conferenceHint.t2.body", { audience }),
				primary: t("iappel:conferenceHint.launch"),
				secondary: t("iappel:conferenceHint.t2.secondary"),
			}
		case "T3":
			return {
				eyebrow: t("iappel:conferenceHint.t3.eyebrow"),
				title: t("iappel:conferenceHint.t3.title", { capacity }),
				body: t("iappel:conferenceHint.t3.body"),
				primary: t("iappel:conferenceHint.launch"),
				secondary: null,
			}
	}
}
