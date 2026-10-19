// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/suggestions-actions.ts @ ad2e7fdc2 — adaptations : libellés par clés i18n qualifiées (`reseau:suggestionsActions.*`) — `t` ajouté en dernier paramètre de `connectButtonLabel` et `relationActionLabel` (dont `busy` devient obligatoire) ; état relationnel lu sur le catalogue du moteur (`suggestions.suggestions.paginate`) ; vocabulaire « entre agents » retiré (geste réciproque entre personnes).
/**
 * suggestions-actions — l'état du geste « Se connecter » et le filtrage
 * session-only des modules de découverte, hors du composant.
 *
 * Une décision testée en `node` coûte moins qu'un rendu : elle vit ici, où
 * elle est vérifiable, plutôt que dans un ternaire au milieu de
 * `SuggestionsPanel`.
 *
 * Une demande aboutie garde la carte à l'écran avec un état explicite ; une
 * suppression individuelle, elle, masque la carte pour le reste du montage.
 * Rien n'est persisté ici : la persistance est au serveur.
 */

import type { TFunction } from "i18next"

/** idle → busy pendant l'appel → done une fois la réponse du serveur reçue —
 *  jamais recalculé depuis une donnée serveur, posé par le composant. */
export type SuggestionActionState = "idle" | "busy" | "done"

/** Un même module garde une pile verticale au bureau et devient carrousel
 *  horizontal lorsqu'il est intercalé dans le fil mobile. */
export type DiscoveryPresentation = "rail" | "carousel"

/** `done` l'emporte sur `busy` : une action déjà aboutie ne redevient pas
 *  « en cours » si son handle réapparaît par ailleurs comme occupé. */
export function suggestionActionState(handle: string, busyHandle: string | null, doneHandles: ReadonlySet<string>): SuggestionActionState {
  if (doneHandles.has(handle)) return "done"
  if (busyHandle === handle) return "busy"
  return "idle"
}

/**
 * Qui reste affiché dans un module de découverte. L'ensemble reçu représente
 * les suppressions locales de la session, jamais une donnée serveur.
 */
export function visibleSuggestions<T extends { handle: string }>(items: readonly T[], dismissedHandles: ReadonlySet<string>): T[] {
  return items.filter((item) => !dismissedHandles.has(item.handle))
}

/** Le libellé du geste réciproque entre deux personnes du réseau. */
export function connectButtonLabel(state: SuggestionActionState, t: TFunction): string {
  if (state === "done") return t("reseau:suggestionsActions.requestSent")
  if (state === "busy") return t("reseau:suggestionsActions.connecting")
  return t("reseau:suggestionsActions.connect")
}

/**
 * L'état de la relation tel que le SERVEUR le connaît
 * (`suggestions.suggestions.paginate` du moteur, champ `relationState`).
 *
 * ⚠️ Il REMPLACE le `done` local pour dire « Demande envoyée » (R-05). Le
 * `useState` d'origine était juste jusqu'au rechargement suivant, où la
 * personne se reproposait avec un bouton « Se connecter » — l'écran affirmait
 * alors le contraire de ce qui était en base.
 */
export type SuggestionRelationState = "none" | "requested_by_me" | "requested_by_them"

/**
 * Le libellé du bouton de mise en relation d'une carte de suggestion.
 *
 * Trois situations, trois phrases — et une seule source pour chacune :
 *  · `requested_by_me` → le serveur a la demande, on le DIT ;
 *  · `requested_by_them` → l'invitation est dans l'autre sens : proposer
 *    « Se connecter » ferait une seconde demande là où il faut répondre ;
 *  · `none` → le geste est ouvert, `busy` couvre l'aller-retour.
 */
export function relationActionLabel(relationState: SuggestionRelationState, busy: boolean, t: TFunction): string {
  if (relationState === "requested_by_me") return t("reseau:suggestionsActions.requestSent")
  if (relationState === "requested_by_them") return t("reseau:suggestionsActions.invitationReceived")
  return busy ? t("reseau:suggestionsActions.connecting") : t("reseau:suggestionsActions.connect")
}

/**
 * Le bouton est-il inerte ? Tout ce qui n'est pas `none` l'est : redemander
 * une connexion déjà demandée est au mieux sans effet, au pire une seconde
 * notification pour la même chose. La RÉPONSE à une invitation reçue se
 * donne dans la sous-vue Invitations, pas ici.
 */
export function relationActionDisabled(relationState: SuggestionRelationState, busy = false): boolean {
  return busy || relationState !== "none"
}

/**
 * Faut-il proposer d'aller RÉPONDRE ? Uniquement quand l'invitation vient de
 * l'autre : c'est la seule situation où la carte est un cul-de-sac sans lien.
 */
export function offersInvitationAnswer(relationState: SuggestionRelationState): boolean {
  return relationState === "requested_by_them"
}
