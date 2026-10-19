// Dupliqué de socle/convex/lib/egressRouting.ts @ ad2e7fdc2 — adaptations : branche `directs/` SEULE — les enregistrements d'appel (`recordings/`), la messagerie vocale (`voicemails/`) et les pistes iRéunion (`meetings/`) n'existent pas dans le moteur : leurs préfixes tombent dans `unknown`, comme tout préfixe hors contrat ; `buildMeetingTrackEgressFilepath` retiré (iRéunion exclu).
/**
 * Routage des fichiers d'Egress LiveKit — module PUR, extrait du webhook
 * `/webhooks/livekit-egress` (convex/http.ts).
 *
 * Le FILEPATH encode la destination : c'est le contrat passé entre celui qui
 * DÉMARRE un egress (il choisit le préfixe) et le webhook qui le TERMINE (il
 * route sur ce préfixe). Ce module est la SEULE définition de ce contrat —
 * il était implicite dans un `startsWith` du webhook, et la branche
 * « directs/ » l'aurait fait silencieusement tomber dans le else attrape-tout
 * historique.
 *
 *  · `directs/{liveSessionId}.mp4` → rediffusion d'un direct (`modules/live/replay`)
 *
 * Tout AUTRE préfixe est `unknown` — jamais un repli sur une branche
 * existante. Le webhook ABSORBE la branche inconnue (200) — LiveKit
 * re-essaierait un 500 en boucle.
 */

export type EgressFileKind = "direct" | "unknown"

/** Route un filepath d'egress vers son traitement. */
export function routeEgressFilepath(filepath: string): EgressFileKind {
  if (filepath.startsWith("directs/")) return "direct"
  return "unknown"
}

/** Le filepath d'un replay de direct — l'AUTRE moitié du contrat ci-dessus. */
export function buildDirectEgressFilepath(directSessionId: string): string {
  return `directs/${directSessionId}.mp4`
}
