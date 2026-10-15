// Dupliqué de socle/convex/lib/livekitIdentity.ts @ ad2e7fdc2 — adaptations : identité `call` SEULE (les variantes `eau`, `citizen`, `supervisor` et `pnpe` du socle n'ont pas d'émetteur dans le moteur) ; le direct (lot 16) aura ses identités à lui, construites ici.
/**
 * Fabrique d'identité LiveKit — SOURCE UNIQUE.
 *
 * LiveKit n'admet qu'UN participant par `identity` dans une salle : une seconde
 * connexion de même identité ÉJECTE la première. Deux connexions d'un même
 * compte (deux onglets, deux appareils, un double montage) partageraient la
 * même identité et s'éjecteraient l'une l'autre — un défaut qui se voit en
 * démonstration, jamais en test tant que le test n'ouvre qu'une connexion.
 * D'où le NONCE, propre à chaque jeton.
 *
 * Fonction PURE : le nonce est REÇU (l'aléa reste à la charge de l'action),
 * ce qui garde la fabrique testable de façon déterministe.
 *
 * ⚠️ N'accepte QUE des identifiants et un nonce — jamais une donnée métier :
 * la chaîne produite est visible de tout autre participant de la salle.
 */
export type LiveKitIdentityInput =
  /** `requestToken` — appel en tête-à-tête ou de groupe. */
  { kind: "call"; subject: string; nonce: string }

/** L'identité LiveKit d'un participant : `{subject}::{nonce}` (le sujet d'authentification en préfixe, pour la corrélation). */
export function buildLiveKitIdentity(input: LiveKitIdentityInput): string {
  switch (input.kind) {
    case "call":
      return `${input.subject}::${input.nonce}`
  }
}
