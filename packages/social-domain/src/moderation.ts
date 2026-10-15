// Dupliqué de socle/convex/modules/reseauPersonnel/validators.ts (l. 347-361, motifs et statuts d'un signalement) @ ad2e7fdc2 — adaptations : règles PURES sorties du backend ; transitions d'un dossier explicites (le socle les tenait en ligne dans `decide`) ; bornes de la note du déclarant.
/**
 * Signalements — motifs, statuts, transitions d'un dossier.
 *
 * Un dossier s'ouvre (`open`), peut passer en examen (`reviewing`), et se
 * ferme une fois pour toutes : classé (`dismissed`) ou suivi d'effet
 * (`actioned`, le contenu est retiré). Une décision terminale ne se refait pas :
 * le recours est un autre chemin (PA5).
 */
export const CONTENT_REPORT_REASONS = ["harassment", "hate", "violence", "sexual_content", "misinformation", "other"] as const
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number]

export const CONTENT_REPORT_STATUSES = ["open", "reviewing", "dismissed", "actioned"] as const
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number]

/** Les décisions qu'un modérateur peut prendre sur un dossier. */
export const CONTENT_REPORT_DECISIONS = ["reviewing", "dismissed", "actioned"] as const
export type ContentReportDecision = (typeof CONTENT_REPORT_DECISIONS)[number]

/** La note facultative du déclarant. */
export const CONTENT_REPORT_NOTE_MAX = 1000

/** Un dossier fermé ne se rouvre pas par une décision. */
export function isTerminalReportStatus(status: ContentReportStatus): boolean {
  return status === "dismissed" || status === "actioned"
}

/** La décision est-elle permise depuis ce statut ? Examen : seulement depuis l'ouverture. */
export function canDecideReport(from: ContentReportStatus, to: ContentReportDecision): boolean {
  if (isTerminalReportStatus(from)) return false
  if (to === "reviewing") return from === "open"
  return true
}
