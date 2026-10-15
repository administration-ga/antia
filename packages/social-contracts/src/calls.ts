// Dupliqué de socle/convex/modules/iappel/validators.ts (l. 158-177, bornes de saisie) @ ad2e7fdc2 — adaptations : constantes PURES partagées par le backend et l'écran (les validateurs Convex restent dans `convex/modules/calls/validators.ts`) ; bornes des postes, des horaires et des appels prioritaires retirées ; fenêtres de temps du socle (sonnerie 120 s répétée quatre fois — `calls.ts`, `ringExpiry.ts`, `meetings.ts` ×2 —, composition 30 s, appel fantôme 4 h, fraîcheur de présence 90 s, battement 30 s) réunies ici en une seule source ; nettoyage des réponses rapides (`preferences.update`) sorti en règle pure.
/**
 * APPELS — les bornes et les fenêtres de temps, en UN seul endroit.
 *
 * L'écran les lit pour refuser AVANT d'envoyer (même borne que le serveur) et
 * pour compter ce qu'il affiche (sonnerie, présence) ; le serveur les applique.
 */

/** Réponses rapides proposées au refus d'un appel. */
export const MAX_QUICK_REPLIES = 6
export const MAX_QUICK_REPLY_LENGTH = 120

/** Mot laissé par l'appelé en refusant — lu par l'appelant. */
export const MAX_DECLINE_NOTE_LENGTH = 200

/** Un « ne pas déranger » de plus d'une semaine est un oubli de réglage, pas une intention. */
export const MAX_DND_DURATION_MS = 7 * 24 * 60 * 60 * 1000

/** Durée maximale d'un message vocal laissé à un correspondant absent. */
export const MAX_VOICEMAIL_DURATION_MS = 120_000

/** La fenêtre de sonnerie d'un appel (tête-à-tête comme ticket de groupe) : au-delà, il est manqué. */
export const CALL_RING_WINDOW_MS = 120_000

/** Le délai laissé à l'APPELANT pour rejoindre sa propre salle (`initiating`) avant que l'appel ne soit manqué. */
export const CALL_INITIATING_TIMEOUT_MS = 30_000

/**
 * Au-delà, un appel « en cours » est un FANTÔME : un onglet fermé ou un réseau
 * coupé n'écrit jamais son départ. C'est un filet, pas la vraie solution (le
 * signal de départ de la salle elle-même n'est pas branché).
 */
export const CALL_CONNECTED_MAX_DURATION_MS = 4 * 60 * 60_000

/** Tous les combien l'écran signale sa présence dans un réseau. */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000

/** Une présence plus ancienne ne compte plus — trois battements manqués. */
export const PRESENCE_FRESHNESS_MS = 90_000

/** Ce que mes relations voient de moi (si je le partage) : la pastille. */
export const RELATION_PRESENCE_STATUSES = ["available", "in_call", "dnd"] as const
export type RelationPresenceStatus = (typeof RELATION_PRESENCE_STATUSES)[number]

/**
 * Les réponses rapides telles qu'on les enregistre : `trim` → vides retirés →
 * dédoublonnage → coupe en NOMBRE → coupe en LONGUEUR de chaque entrée. Dans
 * cet ordre précisément : dédoublonner AVANT de tronquer évite que deux
 * réponses distinctes ne deviennent identiques après troncature sans que l'une
 * des deux ne soit retirée.
 */
export function normalizeQuickReplies(raw: readonly string[]): string[] {
  return [...new Set(raw.map((reply) => reply.trim()).filter((reply) => reply.length > 0))]
    .slice(0, MAX_QUICK_REPLIES)
    .map((reply) => reply.slice(0, MAX_QUICK_REPLY_LENGTH))
}
