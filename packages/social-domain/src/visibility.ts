/**
 * Visibilité d'une publication dans le moteur multi-réseaux — le prédicat
 * étendu (cahier §5 invariant 4, §12).
 *
 * Deux gardes, dans cet ordre, et jamais l'une sans l'autre :
 *
 *  1. le RÉSEAU : une publication existe dans son réseau (`network`), ou aussi à
 *     la racine (`root`). La lit un membre ACTIF de son réseau ; ou, si elle est
 *     `root`, un membre actif de la racine — donc tout membre du moteur, puisque
 *     l'adhésion à un réseau fermé crée l'adhésion dérivée à la racine ;
 *  2. l'AUDIENCE, au sein du réseau : la règle du socle, inchangée
 *     (`isPersonalPostVisibleTo`).
 *
 * L'auteur n'échappe pas à la première garde : qui a quitté un réseau n'y lit
 * plus rien, ses propres publications comprises (l'effacement est un autre
 * geste). Les faits sont relus à chaque lecture (adhésion active = ni
 * suspendue, ni partie) et calculés par l'appelant.
 */
import { isPersonalPostVisibleTo, type PersonalPostAudience, type PersonalPostStatus, type PostReadContext } from "./content"
import type { ContentVisibility } from "./network"

export type NetworkReadContext = {
  /** Adhésion active (ni suspendue, ni partie) au réseau de la publication. */
  isMemberOfPostNetwork: boolean
  /** Adhésion active à la racine. */
  isMemberOfRoot: boolean
}

/** La garde du RÉSEAU, seule. */
export function passesNetworkGate(visibility: ContentVisibility, reader: NetworkReadContext): boolean {
  if (reader.isMemberOfPostNetwork) return true
  return visibility === "root" && reader.isMemberOfRoot
}

/**
 * Une publication est-elle visible par ce lecteur ? Réseau d'abord, BLOCAGE
 * ensuite — il l'emporte sur toute audience, `public` compris (cahier §12.3),
 * l'auteur excepté —, audience enfin. Au socle, le blocage ne restreignait que
 * l'audience `group` (les murs refusaient plus haut) ; ici, le lecteur bloqué ne
 * lit rien de l'auteur, par aucun chemin.
 */
export function isVisibleTo(
  input: {
    audience: PersonalPostAudience
    status: PersonalPostStatus
    visibility: ContentVisibility
  } & PostReadContext &
    NetworkReadContext,
): boolean {
  if (!passesNetworkGate(input.visibility, input)) return false
  if (!input.isAuthor && input.isBlockedWithAuthor) return false
  return isPersonalPostVisibleTo(input)
}
