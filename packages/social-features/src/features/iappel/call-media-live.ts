// Dupliqué de socle/packages/agent-features/src/features/iappel/call-media-live.ts @ ad2e7fdc2 — adaptations : aucune sur la règle (module pur) ; chemin du pool média mis à jour dans la documentation (`features/iappel/CallRoomMount.tsx`).
/**
 * call-media-live — CET APPEL PUBLIE-T-IL, ET ENTEND-IL ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Mettre en attente » ne mettait rien en attente. Le pool média
 * (`features/iappel/CallRoomMount.tsx`) ne lisait que `activeSlotId` :
 * il coupait le micro d'un appel PARQUÉ PAR UN AUTRE — celui qu'on vient de
 * décrocher prend la place d'actif — mais, quand l'appel parqué est le SEUL
 * de la ligne, le magasin garde volontairement `activeSlotId` sur lui
 * (`holdSlot`, `stores/call-store.ts`). Résultat : micro toujours publié,
 * audio distant toujours rendu. La pause était un changement de libellé.
 *
 * La bonne question n'est donc pas « ce slot est-il celui qu'on regarde ? »
 * mais « ce slot est-il VIVANT ? ». Deux conditions, et elles sont
 * indépendantes :
 *
 *  · c'est l'appel ACTIF (l'invariant « au plus une conversation audible »
 *    reste tenu par le magasin) ;
 *  · son STATUT n'est ni `held` ni `ended`.
 *
 * ⚠️ La salle LiveKit, elle, RESTE CONNECTÉE. Couper la publication n'est pas
 * couper la connexion : reprendre doit être instantané, et une reconnexion
 * WebRTC coûte des secondes pendant lesquelles le correspondant n'entend
 * rien. C'est pourquoi cette décision ne porte que sur le média.
 *
 * Aucun import React ni LiveKit : module pur, testable en environnement
 * `node`.
 */

/** L'état du slot, réduit à ce qui décide de la publication. */
export interface CallMediaLiveInput {
	/** Le statut du slot dans le magasin d'appels. */
	status: "incoming" | "connecting" | "active" | "held" | "ended"
	/** Ce slot est-il l'appel ACTIF du magasin ? */
	isActive: boolean
}

/**
 * Faut-il publier le micro / la caméra, et rendre l'audio distant ?
 *
 * `held` est le cas neuf, et le seul qui ne se déduisait de rien : un appel
 * PARQUÉ reste l'actif quand il est le seul de la ligne.
 */
export function shouldPublishMedia(input: CallMediaLiveInput): boolean {
	return input.isActive && input.status !== "held" && input.status !== "ended"
}
