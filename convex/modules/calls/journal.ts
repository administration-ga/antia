// Dupliqué de socle/convex/modules/iappel/scope.ts @ ad2e7fdc2 — adaptations : RÉEXPORT du module pur `@antsia/social-domain/callJournal` (le classement du journal vit dans le domaine, que l'écran importe aussi) ; portée et environnement retirés.
/**
 * Le journal des appels, côté backend : les mêmes règles que l'écran, depuis
 * le domaine pur — une seule définition de « entrant », « manqué », « refusé
 * automatiquement ».
 */
export {
  AUTO_DECLINE_REASONS,
  type CallAdmissionReason,
  type CallCategory,
  callSideOf,
  categorizeCall,
  isAutoDeclineReason,
  isLiveCallStatus,
  isRingingCallStatus,
  isTerminalCallStatus,
} from "@antsia/social-domain/callJournal"
