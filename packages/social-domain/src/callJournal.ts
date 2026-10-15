// Dupliqué de socle/convex/modules/iappel/scope.ts @ ad2e7fdc2 — adaptations : module PUR du domaine, importable par le front ; portée poste / personnel (`resolveCallScope`, l. 86-127) et environnement back-office / agent (`isCrossEnvironmentSelfCall`, `DEFAULT_CALL_ENVIRONMENT`, `BACKOFFICE_CALLER_TITLE`, l. 129-219) retirés — un appel du moteur se juge sur la seule personne qui l'a composé ; raisons d'admission réduites à celles du moteur (`outside_hours` et `secretariat_unavailable` partent avec les postes) ; listes des natures, statuts, fins d'appel et états de ticket posées ici, source unique des validateurs du backend.
/**
 * Appels — le VOCABULAIRE d'un appel, et comment il se range dans le journal
 * de celui qui le relit.
 *
 * Module PUR : aucun import Convex, aucun `ctx`. Le backend en dérive ses
 * validateurs ; l'écran y lit les mêmes listes et le même classement.
 */

/** Un tête-à-tête, ou un appel à plusieurs (≤ 11, contrat `callGroup`). Un appel de groupe n'est PAS une réunion : il sonne. */
export const CALL_KINDS = ["direct", "group"] as const
export type CallKind = (typeof CALL_KINDS)[number]

export const CALL_MEDIA_TYPES = ["audio", "video"] as const
export type CallMediaType = (typeof CALL_MEDIA_TYPES)[number]

/** Le cycle de vie du DOCUMENT : vivant, ou terminé (la ligne demeure au journal). */
export const CALL_LIFECYCLE_STATUSES = ["active", "ended"] as const
export type CallLifecycleStatus = (typeof CALL_LIFECYCLE_STATUSES)[number]

/**
 * La machine d'états de l'APPEL : composé (`initiating`), sonne (`ringing`),
 * décroché (`connected`), parqué (`on_hold`), puis l'une des trois fins.
 */
export const CALL_STATUSES = ["initiating", "ringing", "connected", "on_hold", "ended", "missed", "declined"] as const
export type CallStatus = (typeof CALL_STATUSES)[number]

/**
 * Pourquoi un appel a été écarté AVANT la première sonnerie (refus rendu comme
 * une valeur, jamais une exception).
 *
 *  · `dnd` — « ne pas déranger » posé à la main ;
 *  · `in_meeting` — silence automatique pendant un évènement accepté (opt-in) ;
 *  · `busy` — déjà en ligne, et l'appel en attente est coupé ;
 *  · `offline` — CONSTATÉ, jamais choisi : aucune présence fraîche dans le
 *    réseau de l'appel. Sémantique de journal « manqué », jamais « refusé » ;
 *  · `outside_relations` — l'appelé ne prend que les appels de ses relations.
 */
export const CALL_ADMISSION_REASONS = ["dnd", "busy", "in_meeting", "offline", "outside_relations"] as const
export type CallAdmissionReason = (typeof CALL_ADMISSION_REASONS)[number]

/** Comment un appel a fini : les fins humaines et techniques, puis les refus d'admission (qui portent leur raison). */
export const CALL_END_REASONS = ["normal", "timeout", "declined", "cancelled", "error", ...CALL_ADMISSION_REASONS] as const
export type CallEndReason = (typeof CALL_END_REASONS)[number]

/**
 * L'état d'un INVITÉ à un appel de groupe — quatre valeurs, et la quatrième
 * n'est pas une redite de la troisième : `declined` est un refus (humain, ou
 * par SES réglages — `reason` dit lequel), `missed` dit qu'il n'était pas là.
 */
export const GROUP_CALL_INVITE_STATUSES = ["ringing", "joined", "declined", "missed"] as const
export type GroupCallInviteStatus = (typeof GROUP_CALL_INVITE_STATUSES)[number]

/** Comment un appel se range dans le journal de celui qui le relit. */
export type CallCategory = "incoming" | "outgoing" | "missed" | "declined" | "auto_declined"

/**
 * Les raisons d'un refus AUTOMATIQUE — jamais un manqué, jamais un refus humain.
 *
 * ⚠️ `"offline"` n'y entre PAS, et ce n'est pas un oubli : `categorizeCall`
 * teste cette liste AVANT `callStatus === "missed"`. L'y ajouter classerait un
 * appelé simplement absent en « Refusé automatiquement » dans les DEUX
 * journaux — une accusation à la place d'une absence. Un test l'épingle.
 */
export const AUTO_DECLINE_REASONS: readonly CallAdmissionReason[] = ["dnd", "busy", "in_meeting", "outside_relations"]

export function isAutoDeclineReason(reason: string | null | undefined): reason is CallAdmissionReason {
  return reason !== null && reason !== undefined && (AUTO_DECLINE_REASONS as readonly string[]).includes(reason)
}

/** L'appel est-il ÉTABLI (décroché, parqué compris) ? C'est ce qui occupe une ligne. */
export function isLiveCallStatus(status: string | null | undefined): boolean {
  return status === "connected" || status === "on_hold"
}

/** Le téléphone de l'appelé sonne-t-il encore (ou va-t-il sonner) ? */
export function isRingingCallStatus(status: string | null | undefined): boolean {
  return status === "initiating" || status === "ringing"
}

/** L'appel est-il fini, d'une des trois fins ? */
export function isTerminalCallStatus(status: string | null | undefined): boolean {
  return status === "ended" || status === "missed" || status === "declined"
}

/** De quel côté de cet appel suis-je ? Celui qui a composé le numéro est l'appelant ; tout autre, l'appelé. */
export function callSideOf(call: { createdBy: string }, me: string): "caller" | "callee" {
  return String(call.createdBy) === me ? "caller" : "callee"
}

/**
 * Dans quelle case du journal cet appel tombe-t-il, pour MOI.
 *
 * L'ordre des tests compte : un refus automatique porte `callStatus:
 * "declined"`, et le classer « refusé » tout court laisserait croire que
 * quelqu'un a vu l'appel et l'a écarté. « Entrant » ou « sortant » se décide
 * sur un seul critère : qui a composé le numéro.
 */
export function categorizeCall(
  call: { createdBy: string; callStatus?: string | null; endReason?: string | null },
  me: string,
): { category: CallCategory; reason: CallAdmissionReason | null } {
  if (isAutoDeclineReason(call.endReason)) return { category: "auto_declined", reason: call.endReason }
  if (call.callStatus === "missed") return { category: "missed", reason: null }
  if (call.callStatus === "declined") return { category: "declined", reason: null }
  return { category: callSideOf(call, me) === "caller" ? "outgoing" : "incoming", reason: null }
}
