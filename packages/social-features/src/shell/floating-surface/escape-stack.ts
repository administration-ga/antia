// Dupliqué de socle/packages/agent-features/src/features/floating-surface/escape-stack.ts @ ad2e7fdc2 — adaptations : code inchangé (pile Échap unique) ; déplacé dans la coque (`shell/floating-surface/`).
/**
 * escape-stack — QUI RÉPOND À ÉCHAP QUAND PLUSIEURS SURFACES SE SUPERPOSENT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT GARDÉ ICI (IC-12) : UNE FRAPPE, DEUX SURFACES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le sélecteur « Ajouter une personne » se fermait sur Échap
 * (`AddToCallPanel`) pendant que l'hôte de la couche d'appel réduisait la
 * fenêtre sur LA MÊME frappe (`global-call-surface-host`). Deux abonnements
 * indépendants à `window`, sans aucun contrat entre eux : l'ordre d'exécution
 * était l'ordre de MONTAGE — l'hôte d'abord, donc la surface du DESSOUS
 * réagissait avant celle du DESSUS. On perdait l'appel de vue en voulant
 * fermer un panneau.
 *
 * Une pile ordonnée par PRIORITÉ, puis par récence, remplace les abonnements
 * dispersés : la surface supérieure consomme d'abord, et le second Échap
 * atteint celle d'en dessous.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ PHASE BULLE, ET C'EST UNE DÉCISION — PAS UN OUBLI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'esquisse de la cartographie proposait un écouteur en phase CAPTURE. Le
 * code réel tranche autrement, parce que la capture sur `window` court AVANT
 * le conteneur racine de React — donc avant TOUS les `onKeyDown` de
 * composants. Trois surfaces en vivent et seraient cassées en silence :
 *
 *  · `MessageComposer` prévient l'évènement pour revenir à la liste sans
 *    quitter le fil ;
 *  · `ReseauMobileHeader` prévient pour refermer sa recherche ;
 *  · `IcomPosteWindow` arrête la propagation NATIVE (ADR-0094/0095) pour que
 *    la page derrière ne reçoive rien.
 *
 * En capture, la pile aurait réduit l'appel avant que l'un des trois ne
 * puisse se prononcer. En BULLE, l'ordre naturel du DOM est conservé : les
 * gestionnaires React parlent d'abord, la pile ne voit que ce qu'ils ont
 * laissé passer. `use-surface-drag`, lui, écoute en capture pendant le geste
 * et prévient à l'annulation : la pile le respecte par `defaultPrevented`,
 * quel que soit l'ordre d'installation. C'est LE contrat de ce module.
 *
 * Module PUR : aucune dépendance React, aucun accès à `window` — l'écouteur
 * est posé par `use-escape-layer.ts`, qui appelle `dispatch`. C'est ce qui
 * rend la priorité testable en environnement `node`.
 */

/**
 * Les priorités NOMMÉES — quatre paliers, pas un nombre libre.
 *
 * Un nombre choisi au cas par cas produit exactement le défaut qu'on ferme :
 * deux surfaces à `50` et un ordre qui redevient celui du montage.
 */
export const ESCAPE_PRIORITY = {
	/**
	 * RÉSERVÉ à `use-surface-drag`, qui n'utilise PAS cette pile : il écoute en
	 * capture pendant le geste et prévient l'évènement. Le palier existe pour
	 * que personne ne s'inscrive au-dessus d'un déplacement en cours.
	 */
	DRAG: 100,
	/** Sélecteurs, feuilles, lanceurs — ce qui est posé SUR une surface. */
	OVERLAY: 80,
	/** Fenêtres flottantes (iCom, iAppel) : Échap les range. */
	WINDOW: 50,
	/** La surface d'appel elle-même : Échap la réduit, jamais ne raccroche. */
	SURFACE: 10,
} as const

export type EscapePriority =
	(typeof ESCAPE_PRIORITY)[keyof typeof ESCAPE_PRIORITY]

export interface EscapeLayer {
	/** Identifiant lisible — n'entre dans aucune décision, sert au diagnostic. */
	id: string
	priority: number
	/**
	 * Ce que fait la couche. `false` = « je décline » : la frappe passe à la
	 * couche suivante (l'hôte décline quand aucun appel n'est actif). Tout
	 * autre retour vaut « consommé ».
	 */
	onEscape: () => boolean | void
}

/** Ce qu'une frappe a produit — rendu par `dispatch`, utile aux tests. */
export interface EscapeDispatchResult {
	handled: boolean
	/** L'identifiant de la couche qui a consommé, `null` si personne. */
	by: string | null
}

/** Le minimum de l'évènement dont la pile a besoin. */
export interface EscapeStackEvent {
	key?: string
	defaultPrevented?: boolean
	preventDefault?: () => void
}

export interface EscapeStack {
	/** Empile une couche ; le retour la retire (idempotent). */
	push: (layer: EscapeLayer) => () => void
	/** Traite une frappe. Rend ce qui s'est passé. */
	dispatch: (event: EscapeStackEvent) => EscapeDispatchResult
	/** Combien de couches sont empilées — l'écouteur s'en sert pour se retirer. */
	size: () => number
}

export function createEscapeStack(): EscapeStack {
	/** Ordre d'INSERTION : la récence se lit en fin de tableau. */
	const layers: Array<{ layer: EscapeLayer; seq: number }> = []
	let sequence = 0

	function push(layer: EscapeLayer): () => void {
		const entry = { layer, seq: sequence++ }
		layers.push(entry)
		return () => {
			const index = layers.indexOf(entry)
			if (index >= 0) layers.splice(index, 1)
		}
	}

	function dispatch(event: EscapeStackEvent): EscapeDispatchResult {
		if (event.key !== undefined && event.key !== "Escape") {
			return { handled: false, by: null }
		}
		// ⚠️ Déjà consommé plus bas (composeur, recherche mobile, annulation de
		// déplacement) : la pile ne double JAMAIS un geste que quelqu'un a
		// revendiqué. C'est ce qui laisse les `onKeyDown` locaux exister.
		if (event.defaultPrevented === true) return { handled: false, by: null }

		// Priorité d'abord, récence ensuite. Trier une COPIE : la pile garde son
		// ordre d'insertion, seule lecture qui survive à un retrait en plein vol.
		const ordered = [...layers].sort((a, b) =>
			a.layer.priority !== b.layer.priority
				? b.layer.priority - a.layer.priority
				: b.seq - a.seq,
		)

		for (const entry of ordered) {
			const outcome = entry.layer.onEscape()
			// Une couche qui DÉCLINE cède la frappe : l'hôte le fait quand aucun
			// appel n'est actif. Sans cela, la couche du dessus mangerait un
			// Échap sans rien faire, et la surface du dessous ne l'aurait jamais.
			if (outcome === false) continue
			event.preventDefault?.()
			return { handled: true, by: entry.layer.id }
		}
		return { handled: false, by: null }
	}

	return { push, dispatch, size: () => layers.length }
}

/**
 * LA pile de l'application — une seule, partagée par toutes les surfaces.
 *
 * Un singleton de module : deux piles rendraient exactement le défaut d'IC-12,
 * chacune ignorant les couches de l'autre.
 */
export const escapeStack: EscapeStack = createEscapeStack()
