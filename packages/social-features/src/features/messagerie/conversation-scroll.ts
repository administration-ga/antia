// Dupliqué de socle/packages/agent-features/src/features/messagerie/conversation-scroll.ts @ ad2e7fdc2 — adaptations : libellé de la pastille par clés i18n qualifiées (`messagerie:conversationScroll.*`, pluriel `_one`/`_other` porté par la langue), `t` en dernier paramètre de `newMessagesLabel`.
/**
 * conversation-scroll — quand le fil SUIT le bas, et quand il ne le suit plus.
 *
 * Module pur, testé en environnement `node` : ce qui reste dans le corps d'un
 * composant n'est vérifiable qu'à l'œil. Cette décision-là mérite d'en sortir,
 * parce qu'elle a exactement DEUX façons de se rater, et que les deux sont
 * odieuses :
 *
 *  · coller au bas TOUJOURS — on remonte lire un message de la veille, un
 *    message arrive, l'écran saute au bas et on perd sa place ;
 *  · ne jamais coller — on écrit, on envoie, et son propre message part hors
 *    de l'écran.
 *
 * D'où un état à deux champs : `pinned` (le fil suit-il le bas ?) et `unseen`
 * (combien de messages sont arrivés pendant qu'on lisait ailleurs). Les deux
 * évoluent par ÉVÉNEMENTS, jamais par lecture directe du DOM dans un effet.
 *
 * ⚠️ Mon propre message REPINGLE toujours. C'est la règle qui manque le plus
 * souvent : on remonte, on écrit, on envoie — si l'envoi ne repingle pas, on
 * ne voit pas ce qu'on vient d'écrire, et on l'écrit une seconde fois.
 *
 * Fonctions PURES : chacune rend un nouvel état, ou LA MÊME RÉFÉRENCE quand
 * rien ne change — ce qui permet de ne pas re-rendre pour rien.
 *
 * Un seul import, de type : la fonction de traduction de la pastille, reçue
 * en dernier paramètre (clés QUALIFIÉES, résolues par n'importe quel `t`).
 */

import type { TFunction } from "i18next"

/**
 * Marge sous laquelle on considère qu'on est « en bas ».
 *
 * Pas zéro : une bordure, un demi-pixel de mise à l'échelle ou une image qui
 * finit de charger suffisent à laisser deux pixels d'écart, et un seuil strict
 * décrocherait l'épinglage sans que personne n'ait bougé.
 */
export const NEAR_BOTTOM_PX = 80

export interface ScrollMetrics {
	scrollTop: number
	scrollHeight: number
	clientHeight: number
}

/** Le fil est-il assez près du bas pour continuer à le suivre ? */
export function isNearBottom(
	metrics: ScrollMetrics,
	tolerance: number = NEAR_BOTTOM_PX,
): boolean {
	const distance =
		metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
	if (!Number.isFinite(distance)) return true
	return distance <= tolerance
}

export interface ScrollState {
	/** Le fil suit le bas : toute arrivée le fait défiler. */
	pinned: boolean
	/** Messages arrivés pendant qu'on lisait plus haut. */
	unseen: number
}

/** Au montage, on regarde le dernier message — donc épinglé, rien en attente. */
export function initialScrollState(): ScrollState {
	return { pinned: true, unseen: 0 }
}

export type ScrollEvent =
	/** L'utilisateur a fait défiler. */
	| { kind: "scroll"; nearBottom: boolean }
	/** Des messages sont arrivés. `fromMe` : le dernier est de moi. */
	| { kind: "messages"; added: number; fromMe: boolean }
	/** On saute au bas (pastille, envoi, ouverture). */
	| { kind: "jump" }

/**
 * Applique un événement.
 *
 * ⚠️ Un `added` négatif ou non fini est ignoré : un message supprimé pour moi
 * RÉTRÉCIT la liste, et compter −1 « nouveau message » afficherait une
 * pastille à décompte négatif.
 */
export function reduceOnMessages(
	state: ScrollState,
	event: ScrollEvent,
): ScrollState {
	switch (event.kind) {
		case "scroll": {
			if (event.nearBottom) {
				// Revenir au bas vaut lecture : la pastille s'éteint.
				if (state.pinned && state.unseen === 0) return state
				return { pinned: true, unseen: 0 }
			}
			if (!state.pinned) return state
			return { pinned: false, unseen: state.unseen }
		}
		case "messages": {
			// Mon propre message repingle, où qu'on soit dans le fil.
			if (event.fromMe) {
				if (state.pinned && state.unseen === 0) return state
				return { pinned: true, unseen: 0 }
			}
			if (state.pinned) return state.unseen === 0 ? state : { ...state, unseen: 0 }
			const added =
				Number.isFinite(event.added) && event.added > 0
					? Math.trunc(event.added)
					: 0
			if (added === 0) return state
			return { pinned: false, unseen: state.unseen + added }
		}
		case "jump": {
			if (state.pinned && state.unseen === 0) return state
			return { pinned: true, unseen: 0 }
		}
	}
}

/**
 * Le libellé de la pastille « nouveaux messages ».
 *
 * Zéro rend une chaîne VIDE, et non « 0 nouveau message » : la pastille ne se
 * rend pas, et un libellé vide est ce qui le dit à l'appelant sans qu'il ait à
 * recompter. Au-delà de 99, on plafonne — le chiffre exact n'apprend plus rien
 * et déborde de la pastille. L'accord (singulier, pluriel) est celui de la
 * langue de l'écran (`count`).
 */
export function newMessagesLabel(count: number, t: TFunction): string {
	if (!Number.isFinite(count) || count <= 0) return ""
	const n = Math.trunc(count)
	if (n > 99) return t("messagerie:conversationScroll.newMessagesCapped")
	return t("messagerie:conversationScroll.newMessages", { count: n })
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * D'OÙ VIENT LA CROISSANCE DU FIL — DU BAS, OU DU HAUT ?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tant qu'un fil ne rendait que ses cinquante derniers messages, il ne pouvait
 * grandir que par le BAS : compter `total - précédent` suffisait. Charger les
 * messages plus ANCIENS le fait grandir par le HAUT — et le même comptage
 * annoncerait alors « 50 nouveaux messages » pour du passé qu'on vient
 * soi-même de demander, tout en laissant le fil dépinglé.
 *
 * Ce qui distingue les deux est le DERNIER message : une arrivée le remplace,
 * un chargement d'anciens le laisse intact. C'est l'unique signal fiable — le
 * nombre, lui, ne dit rien du côté par lequel il a bougé.
 */
export interface CroissanceDuFil {
	/** Messages arrivés APRÈS le dernier connu — de vraies arrivées. */
	enBas: number
	/** Messages révélés AVANT le premier connu — du passé chargé. */
	enHaut: number
}

export function croissanceDuFil(input: {
	totalAvant: number
	totalApres: number
	dernierIdAvant: string | null
	dernierIdApres: string | null
}): CroissanceDuFil {
	const delta = input.totalApres - input.totalAvant
	if (!Number.isFinite(delta) || delta <= 0) return { enBas: 0, enHaut: 0 }

	// Le fil n'avait rien : tout ce qui apparaît est le fil lui-même, et il
	// s'ouvre en bas. Le traiter comme du passé laisserait l'ouverture d'une
	// conversation sur son premier message.
	if (input.dernierIdAvant === null) {
		return { enBas: Math.trunc(delta), enHaut: 0 }
	}

	// Le dernier n'a pas bougé : la queue est intacte, la croissance vient du
	// haut. C'est le chargement d'anciens, et il ne fait sonner aucune cloche.
	if (input.dernierIdApres === input.dernierIdAvant) {
		return { enBas: 0, enHaut: Math.trunc(delta) }
	}

	// ⚠️ Cas mixte — des anciens chargés ET un message arrivé dans le même
	// rendu : on attribue tout au BAS. Le biais est délibéré. Sur-compter la
	// pastille d'une unité se corrige d'un regard ; MANQUER une arrivée laisse
	// quelqu'un attendre une réponse déjà écrite.
	return { enBas: Math.trunc(delta), enHaut: 0 }
}
