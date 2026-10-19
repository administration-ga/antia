// Dupliqué de socle/packages/agent-features/src/components/identity/post-identity.ts @ ad2e7fdc2 — adaptations : identité SANS fonction ni administration (portée « poste », `positionTitle`, `orgName` et le type `CommunicationScope` retirés) ; le sur-titre dit les badges CALCULÉS par le serveur (`Badge` de `@antsia/social-domain/badges`), « Communauté » seul n'en fait pas un ; badges répétés dédoublonnés ; libellés par l'i18n (`t` en dernier paramètre de `postEyebrow` et `postIdentityAnnouncement`, clés qualifiées `social:badges.*` et `reseau:postIdentity.*`) ; ajout de `signalBadges` et `badgeLabelKey`.
/**
 * post-identity — comment se compose le SUR-TITRE de l'identité d'une personne.
 *
 * Module PUR : laisser cette composition dans un composant la rendrait
 * invérifiable — et c'est exactement le genre de détail (un badge répété, un
 * séparateur orphelin) qui ne se voit qu'à l'œil, sur un écran qu'on n'ouvre
 * pas tous les jours.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dans le réseau, deux personnes se parlent en leur nom propre : aucune
 * fonction, aucune administration ne se pose au-dessus d'un nom. Ce qui
 * distingue une identité d'une autre, ce sont ses BADGES DE CONFIANCE —
 * Officiel, Vérifié, Agent public — CALCULÉS par le serveur à chaque
 * projection, jamais déclarés par la personne ni stockés comme vérité.
 *
 * ⚠️ « Communauté » n'est PAS un signal : c'est l'absence de tout autre badge.
 * Le poser au-dessus de chaque nom n'apprendrait rien et occuperait la ligne
 * qui sert à distinguer une identité vérifiée d'une autre — le sur-titre
 * disparaît plutôt que d'afficher une phrase de remplissage.
 */

import type { Badge } from "@antsia/social-domain/badges"
import type { TFunction } from "i18next"

export interface PostIdentityInput {
  /** Les badges CALCULÉS par le serveur (DTO de personne), dans l'ordre rendu. */
  badges?: readonly Badge[] | null
}

/** Le séparateur du sur-titre — un point médian, jamais un tiret (qui se lit
 *  comme une coupure de mot). */
const SEP = " · "

/** Le libellé de chaque badge vit dans l'espace `social`, partagé avec les applications. */
const BADGE_LABEL_KEYS: Readonly<Record<Badge, string>> = Object.freeze({
  official: "social:badges.official",
  verified: "social:badges.verified",
  public_agent: "social:badges.publicAgent",
  community: "social:badges.community",
})

/** La clé i18n QUALIFIÉE du libellé d'un badge. */
export function badgeLabelKey(badge: Badge): string {
  return BADGE_LABEL_KEYS[badge]
}

/**
 * Les badges qui DISENT quelque chose, dédoublonnés, dans l'ordre du serveur.
 * « Communauté » en est retiré : seul, il ne distingue personne.
 */
export function signalBadges(input: PostIdentityInput): Badge[] {
  const kept = new Set<Badge>()
  for (const badge of input.badges ?? []) {
    if (badge !== "community") kept.add(badge)
  }
  return [...kept]
}

/**
 * Le sur-titre à poser au-dessus du nom — `null` quand il n'y a rien d'honnête
 * à écrire.
 *
 * ⚠️ Rendre `null` plutôt qu'une phrase de remplissage : un badge générique
 * au-dessus de chaque nom n'apprend rien et occupe la ligne qui servirait à
 * distinguer une identité vérifiée.
 */
export function postEyebrow(input: PostIdentityInput, t: TFunction): string | null {
  const badges = signalBadges(input)
  if (badges.length === 0) return null
  return badges.map((badge) => t(badgeLabelKey(badge))).join(SEP)
}

/**
 * Y a-t-il quelque chose à montrer au-dessus du nom ? Sert aux surfaces qui
 * réservent la place (hauteur de ligne, grille) avant de rendre.
 */
export function hasPostEyebrow(input: PostIdentityInput): boolean {
  return signalBadges(input).length > 0
}

/**
 * La version LUE À VOIX HAUTE, pour les lecteurs d'écran.
 *
 * Un sur-titre suivi d'un nom s'annonce comme deux fragments sans lien ; cette
 * phrase les rattache. Elle n'est jamais affichée.
 */
export function postIdentityAnnouncement(name: string, input: PostIdentityInput, t: TFunction): string {
  const eyebrow = postEyebrow(input, t)
  return eyebrow === null ? name : t("reseau:postIdentity.announcement", { name, badges: eyebrow })
}
