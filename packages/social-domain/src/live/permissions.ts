// Dupliqué de socle/convex/modules/direct/permissions.ts @ ad2e7fdc2 — adaptations : module PUR déplacé dans le domaine (`@antsia/social-domain/live/permissions`, importable par le front sans `convex/`), réexporté par `convex/modules/live/permissions.ts` ; `directDelegationKindLabel` rend un CODE de libellé (`delegationKind.cohost` | `delegationKind.moderator`, traduit par l'écran) au lieu d'une phrase française ; rien d'autre dans le code.
/**
 * Les RÔLES DE GESTION d'un direct, séparés du rôle PUBLIANT (D-11, ADR-0144).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX QUESTIONS, DEUX MODÈLES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Qui PARLE ? » se lit sur `direct_speakers` (`host` | `speaker`) : c'est un
 * rôle de plateau, il ouvre un micro. « Qui GÈRE ? » ne s'y lisait pas — la
 * tranche n'avait que le test d'identité `session.hostUserId === user`, répété
 * dans chaque mutation. Un hôte seul devant sa salle ne pouvait donc rien
 * déléguer, et rien dans le modèle ne savait dire « cette personne modère la
 * conversation sans être à l'antenne ».
 *
 * Ce module est la MATRICE, et rien d'autre : pas d'accès base, pas d'import
 * Convex, aucune fonction enregistrée (ADR-0024). Le serveur en tire ses refus
 * (`access.requireDirectPermission`), l'écran en tire ce qu'il PROPOSE
 * (`sessions.get` le sert dans le DTO). Une seule règle, deux lecteurs — le
 * patron d'`assertInvitableTarget` (D-10).
 *
 * ⚠️ Ce module ne dit RIEN de la visibilité : la question « ai-je le droit de
 * voir ce direct ? » reste celle d'`assertVisibleDirectSession`, et son refus
 * indistinct (« Direct introuvable. ») reste la réponse due à qui ne le voit
 * pas. Une permission refusée est un refus EXPLICITE
 * (`INSUFFICIENT_PERMISSIONS`) : l'appelant voit déjà la session, la lui cacher
 * ne protégerait plus rien et ne lui apprendrait pas ce qui manque.
 */

/** Les neuf gestes de gestion — un par acte, jamais un rôle fourre-tout. */
export type DirectPermissionKey =
  /** Faire monter quelqu'un à l'antenne (accepter une main, inviter). */
  | "admitToStage"
  /** L'en faire descendre — rétrograder, ce qui n'est PAS exclure. */
  | "removeFromStage"
  /** Retirer un commentaire d'autrui, couper le chat d'une personne. */
  | "moderateChat"
  /** Exclure de la conférence — le jeton est refusé, la salle se referme. */
  | "exclude"
  /** Lever une exclusion : la personne peut redemander un jeton. */
  | "reinstate"
  /** Fermer (ou rouvrir) la conversation pour tout le monde. */
  | "closeChat"
  /** Toucher à l'audience ou à la visibilité du replay. */
  | "changeAudienceOrReplay"
  /** Terminer la conférence. */
  | "endOrTransfer"
  /** Accorder ou révoquer une délégation. */
  | "delegate"

export type DirectPermissions = Record<DirectPermissionKey, boolean>

/** L'ordre de référence — sert aux écrans, aux tests et à la sérialisation. */
export const DIRECT_PERMISSION_KEYS: readonly DirectPermissionKey[] = [
  "admitToStage",
  "removeFromStage",
  "moderateChat",
  "exclude",
  "reinstate",
  "closeChat",
  "changeAudienceOrReplay",
  "endOrTransfer",
  "delegate",
] as const

/**
 * Le GENRE d'une délégation.
 *
 * ⚠️ Il ne DÉCIDE rien dans `directPermissionsFor`, et c'est délibéré : les
 * trois capacités sensibles (antenne, exclusion, fin) sont portées par les
 * trois drapeaux de la ligne, jamais par une étiquette. Le genre sert à deux
 * choses, et deux seulement : nommer la fonction à l'écran (« cohôte » /
 * « modérateur »), et fixer les DÉFAUTS proposés au moment d'accorder
 * (`delegations.grant` : un cohôte arrive avec l'antenne, un modérateur sans).
 *
 * Faire décider l'étiquette aurait créé une seconde source de vérité à côté des
 * drapeaux — et c'est exactement le défaut que ce lot corrige ailleurs.
 */
export type DirectDelegationKind = "cohost" | "moderator"

/** Ce qu'une ligne `direct_delegations` VIVANTE apporte à la matrice. */
export type DirectDelegationFacts = {
  kind: DirectDelegationKind
  canAdmitToStage: boolean
  canExclude: boolean
  canEndOrTransfer: boolean
}

export type DirectPermissionsInput = {
  /** Titulaire du direct — il peut tout, y compris déléguer. */
  isHost: boolean
  /** Délégation VIVANTE (jamais une ligne révoquée), ou `null`. */
  delegation: DirectDelegationFacts | null
  /**
   * À l'antenne ?
   *
   * ⚠️ Présent exprès, et SANS EFFET : publier n'est pas gérer. Un intervenant
   * promu pour dix minutes ne devient pas modérateur, et la seule façon de
   * s'en assurer est de nommer le fait puis de ne pas s'en servir — un test le
   * verrouille.
   *
   * ⚠️ FACULTATIF, et c'est la conséquence directe : un appelant n'a pas à
   * payer une lecture de `direct_speakers` pour renseigner un fait dont la
   * matrice ne se sert pas. `directPermissionsOf` est appelée sur le chemin
   * chaud de `comments.list` — deux lectures inutiles par abonné, à chaque
   * commentaire.
   */
  isSpeaker?: boolean
}

/** Aucune permission — le socle de tout le monde. */
export function noDirectPermissions(): DirectPermissions {
  return {
    admitToStage: false,
    removeFromStage: false,
    moderateChat: false,
    exclude: false,
    reinstate: false,
    closeChat: false,
    changeAudienceOrReplay: false,
    endOrTransfer: false,
    delegate: false,
  }
}

/**
 * LA matrice.
 *
 *  · **hôte** — tout. Il est le seul à pouvoir déléguer, et le seul à toucher
 *    l'audience ou la visibilité du replay : ces deux-là engagent la portée de
 *    la conférence, pas sa police.
 *  · **délégué** (cohôte ou modérateur) — la conversation TOUJOURS (modérer,
 *    fermer, rouvrir) ; l'antenne, l'exclusion et la fin SEULEMENT si le
 *    drapeau correspondant est posé sur sa ligne.
 *  · **intervenant, spectateur** — rien.
 *
 * ⚠️ `reinstate` suit `canExclude`, et ce n'est pas un raccourci : qui peut
 * fermer la porte doit pouvoir la rouvrir. L'inverse — exclure sans pouvoir
 * réintégrer — transformerait chaque erreur de modération en peine définitive
 * que seul l'hôte pourrait lever.
 */
export function directPermissionsFor(
  input: DirectPermissionsInput,
): DirectPermissions {
  if (input.isHost) {
    return {
      admitToStage: true,
      removeFromStage: true,
      moderateChat: true,
      exclude: true,
      reinstate: true,
      closeChat: true,
      changeAudienceOrReplay: true,
      endOrTransfer: true,
      delegate: true,
    }
  }

  const delegation = input.delegation
  if (delegation === null) return noDirectPermissions()

  return {
    admitToStage: delegation.canAdmitToStage,
    removeFromStage: delegation.canAdmitToStage,
    moderateChat: true,
    exclude: delegation.canExclude,
    reinstate: delegation.canExclude,
    closeChat: true,
    // Jamais délégué : la portée d'une conférence appartient à qui la tient.
    changeAudienceOrReplay: false,
    endOrTransfer: delegation.canEndOrTransfer,
    // Jamais délégué : une délégation qui se re-délègue n'a plus de fond.
    delegate: false,
  }
}

/** Les drapeaux proposés par DÉFAUT pour un genre donné (cf. `grant`). */
export function defaultDelegationFlags(kind: DirectDelegationKind): {
  canAdmitToStage: boolean
  canExclude: boolean
  canEndOrTransfer: boolean
} {
  return kind === "cohost"
    ? { canAdmitToStage: true, canExclude: false, canEndOrTransfer: false }
    : { canAdmitToStage: false, canExclude: false, canEndOrTransfer: false }
}

/** Y a-t-il quoi que ce soit à gérer ? Sert à monter (ou non) une console. */
export function hasAnyDirectManagement(
  permissions: DirectPermissions | null | undefined,
): boolean {
  if (!permissions) return false
  return DIRECT_PERMISSION_KEYS.some((key) => permissions[key])
}

/**
 * Plafond de délégations VIVANTES par session.
 *
 * Même esprit que `DIRECT_MAX_SPEAKERS` : une console de gestion se lit d'un
 * coup d'œil, et une liste non bornée est une lecture non bornée. Huit suffit
 * largement — au-delà, ce n'est plus une délégation, c'est une équipe.
 */
export const DIRECT_MAX_DELEGATIONS = 8

/**
 * Le libellé d'un genre de délégation — un CODE, une seule source : la clé que
 * l'écran traduit dans l'espace de noms de sa tranche du direct (fr « Cohôte »,
 * « Modérateur »). Le domaine ne parle pas : aucune phrase ici.
 */
export function directDelegationKindLabel(kind: DirectDelegationKind): `delegationKind.${DirectDelegationKind}` {
  return kind === "cohost" ? "delegationKind.cohost" : "delegationKind.moderator"
}
