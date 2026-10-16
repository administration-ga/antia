// Dupliqué de socle/packages/agent-features/src/features/direct/direct-presence.ts @ ad2e7fdc2 — adaptations : domaine pur et tests portés ; aucune dépendance inter-produit.
/**
 * direct-presence — LA PRÉSENCE D'UN SPECTATEUR, côté écran (D-09).
 *
 * Module PUR (aucun React, aucun Convex) : `agent-features` tourne par défaut
 * en environnement `node`, et ce qui reste dans le corps d'un composant n'est
 * vérifiable qu'à l'œil.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX NOMBRES, ET ILS NE DISENT PAS LA MÊME CHOSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'au 2026-09-07, l'écran affichait « N spectateurs » à partir de
 * `viewerGrantCount` — le nombre de personnes distinctes ADMISES depuis le
 * début, qui ne redescend jamais. Un direct dont la salle s'était vidée
 * annonçait donc toujours son record, et sa capacité se jugeait dessus : le
 * 201ᵉ visiteur d'une salle vide était refusé. Le serveur sert maintenant
 * `counters.present` (bail de 90 s) à côté de `counters.viewers`, et l'écran
 * NOMME les deux.
 *
 * ⚠️ Les deux durées sont RECOPIÉES du serveur
 * (`convex/modules/direct/domain.ts`) et alignées par test — même patron que
 * `direct-host-presence.ts` et `DIRECT_COMMENTS_WINDOW`. Importer le domaine
 * ici embarquerait le backend dans le bundle client.
 */

import type { DirectSessionPhase } from "../../stores/direct-session-store"

/** Un battement vaut présence pendant 90 s (miroir serveur, aligné par test). */
export const DIRECT_PRESENCE_TTL_MS = 90_000
/** Cadence du battement — le TIERS du bail : deux pertes se rattrapent. */
export const DIRECT_PRESENCE_HEARTBEAT_MS = 30_000

/** La ligne d'admission, réduite à ce que la présence demande. */
export type DirectViewerPresenceFacts = {
  lastSeenAt?: number | undefined
  leftAt?: number | undefined
}

/**
 * Cette admission vaut-elle une présence MAINTENANT ? Règle recopiée de
 * `convex/modules/direct/domain.ts::isViewerPresent`, alignée par test : deux
 * règles divergentes, ce serait une salle pleine pour l'un et libre pour
 * l'autre au même instant.
 */
export function isViewerPresent(
  grant: DirectViewerPresenceFacts,
  now: number,
): boolean {
  if (grant.leftAt !== undefined) return false
  if (grant.lastSeenAt === undefined) return false
  return now - grant.lastSeenAt <= DIRECT_PRESENCE_TTL_MS
}

/**
 * Dois-je battre ?
 *
 * ⚠️ Le rôle qui compte est celui du JETON (`credentialsRole`), pas le rôle
 * métier : un hôte et un intervenant occupent une place à l'antenne (bornée à
 * 8, tenue par `direct_speakers`), pas une place de spectateur. Les faire
 * battre ici gonflerait la salle d'une personne qui n'y est pas.
 *
 * ⚠️ La phase vient du MAGASIN (06B) : elle survit au franchissement du palier
 * immersif (D-08), une variable de présentation non. `reconnecting` bat AUSSI
 * — une bascule 4G ne doit pas rendre sa place à quelqu'un qui revient dans la
 * seconde, et le TTL reste le juge s'il ne revient pas.
 */
export function shouldBeatViewerPresence(
  credentialsRole: "viewer" | "speaker" | null,
  phase: DirectSessionPhase,
): boolean {
  if (credentialsRole !== "viewer") return false
  return phase === "connected" || phase === "reconnecting"
}
