// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/empty-states.ts @ ad2e7fdc2 — adaptations : textes et libellés d'action par l'i18n (clés qualifiées `reseau:emptyStates.*`, `t` en dernier paramètre) ; adresses composées sur la BASE de la page réseau injectée (`useRoutes().home()`) au lieu de l'adresse de l'espace écrite en dur — `reseauEmptyState(id, home, t)` et `allReseauEmptyStates(home, t)` ; « agent » retiré de l'état vide des suggestions (« personne ») ; renvoi au bouton de lancement des conférences (absent du moteur tant que le lot `live` n'est pas livré) retiré des commentaires ; les trois textes empruntés restent IMPORTÉS de leur module (clés `EMPTY_MY_GROUPS_TEXT_KEY` et `EMPTY_DISCOVER_TEXT_KEY` de `groupes-thematiques`, `emptyAgendaText(t)` d'`evenements-list`).
/**
 * empty-states — ce qu'un espace VIDE dit, et le SEUL geste qu'il propose
 * (X-09).
 *
 * L'audit du 2026-09-06 relève deux défauts distincts, et il faut les traiter
 * séparément :
 *
 *  · « plusieurs états vides occupent des cartes larges successives **sans
 *    action utile** » — la carte explique une manœuvre (« depuis le menu “…”
 *    d'une publication, choisissez “Enregistrer” ») au lieu d'offrir le geste ;
 *  · « des hauteurs décoratives qui repoussent le premier contenu utile » —
 *    24 px de rembourrage et deux phrases centrées pour dire « rien ici ».
 *
 * Ce module PUR tranche les deux, une fois, pour tout le réseau : une phrase
 * COURTE, et **au plus une** action.
 *
 * ⚠️ « Au plus » et non « exactement ». Forcer un bouton là où rien n'est
 * pertinent remplacerait une carte vide par une carte vide AVEC un bouton
 * inutile — et surtout, sur trois de ces surfaces, le geste est **déjà à
 * l'écran juste au-dessus** (« Créer un groupe », « Créer un évènement ») :
 * le répéter dans la carte du vide ne donne pas une action de plus, il donne
 * une cible de plus à lire. Chaque `action: null` porte donc sa RAISON en
 * commentaire ; l'absence est un choix inscrit, jamais un oubli.
 *
 * ⚠️ **Ce module ne s'approprie aucun texte qu'un autre module possède.** Trois
 * états vides sont verrouillés par les tests montés de leur panneau
 * (`GroupsPanel.test.tsx` compare le rendu au texte de « Mes groupes » et de la
 * découverte, `EvenementsPanel.test.tsx` à celui de l'agenda) : ils sont ici
 * IMPORTÉS de leur source, jamais recopiés — une copie divergerait en silence.
 * Ils sont dispensés de la règle de longueur, avec leur raison, dans
 * `EMPTY_TEXT_LENGTH_EXEMPTIONS` : les raccourcir est une décision du lot qui
 * possède ces modules, pas de celui-ci.
 *
 * ⚠️ Quatre phrases sont, à l'inverse, verrouillées ICI parce que des tests
 * montés les comparent LITTÉRALEMENT (`PeoplePanel.test.tsx`,
 * `DiscoveryEmptyCard.test.tsx`) : « Aucune personne trouvée. », « Aucune
 * nouvelle personne à proposer pour le moment. », « Aucune demande en attente
 * de réponse. » et le début de « Vous ne suivez personne… ». Le cliquet voisin
 * les réaffirme pour qu'une reformulation ne casse pas ces suites à distance.
 *
 * AUCUNE ADRESSE N'EST ÉCRITE ICI : une action qui navigue est composée sur la
 * base de la page réseau (`home`, l'accueil de l'application), que seule
 * l'application connaît.
 *
 * Aucun import React : ce module ne connaît que du texte et des adresses.
 */

import type { TFunction } from "i18next"

import { emptyAgendaText } from "./evenements-list"
import { EMPTY_DISCOVER_TEXT_KEY, EMPTY_MY_GROUPS_TEXT_KEY } from "./groupes-thematiques"
import { peopleViewHref } from "./people-panel"

/**
 * Les gestes qu'un état vide peut proposer SANS quitter la page.
 *
 * Un geste n'est pas une adresse : il ouvre une composition (feuille, dialogue)
 * ou bascule une sous-vue locale. Ce qui a une ADRESSE reste un lien — « liens
 * pour naviguer, boutons pour agir » (X-10). Le panneau branche le geste ; ce
 * module ne connaît que son nom.
 *
 * La liste est volontairement PRÉSENTE mais vide d'emploi aujourd'hui : les
 * trois actions retenues sont toutes des adresses. La garder documente le
 * second cas de figure sans le simuler — un geste déclaré sans branchement
 * serait un bouton mort, et le cliquet voisin refuse un geste inconnu.
 */
export const RESEAU_EMPTY_GESTE_IDS = ["publier", "lancer-conference", "creer-evenement", "creer-groupe"] as const

export type ReseauEmptyGesteId = (typeof RESEAU_EMPTY_GESTE_IDS)[number]

/** Une action qui NAVIGUE — rendue en lien. */
export interface ReseauEmptyLien {
  readonly kind: "lien"
  readonly label: string
  readonly href: string
}

/** Une action qui AGIT sur place — rendue en bouton. */
export interface ReseauEmptyGeste {
  readonly kind: "geste"
  readonly label: string
  readonly geste: ReseauEmptyGesteId
}

export type ReseauEmptyAction = ReseauEmptyLien | ReseauEmptyGeste

export interface ReseauEmptyState {
  readonly id: ReseauEmptyStateId
  /** Une phrase, dans la langue de l'écran. Ce qui manque — jamais le mode d'emploi pour le combler. */
  readonly text: string
  /** L'action unique, ou `null` quand aucune n'est pertinente. */
  readonly action: ReseauEmptyAction | null
}

export const RESEAU_EMPTY_STATE_IDS = [
  "signets",
  "conferences-en-direct",
  "conferences-en-direct-avec-rediffusions",
  "rediffusions",
  "agenda",
  "groupes-mes-groupes",
  "groupes-decouverte",
  "relations-connexions",
  "relations-abonnements",
  "relations-invitations-recues",
  "relations-demandes-envoyees",
  "relations-recherche",
  "suggestions",
] as const

export type ReseauEmptyStateId = (typeof RESEAU_EMPTY_STATE_IDS)[number]

/**
 * Longueur maximale d'une phrase d'état vide — mesurée, pas devinée : la plus
 * longue que ce module POSSÈDE en compte 69.
 */
export const EMPTY_TEXT_MAX = 90

/** Longueur maximale d'un libellé d'action — un geste tient sur un bouton. */
export const EMPTY_ACTION_LABEL_MAX = 32

/**
 * Les textes empruntés à un module voisin, avec la raison de leur dispense.
 * Une entrée dont le texte redevient court doit SORTIR d'ici — c'est ce qui
 * force à inscrire la victoire plutôt qu'à laisser dormir la dispense.
 */
export const EMPTY_TEXT_LENGTH_EXEMPTIONS: Readonly<Partial<Record<ReseauEmptyStateId, string>>> = Object.freeze({
  "groupes-mes-groupes":
    "Texte possédé par groupes-thematiques.ts (EMPTY_MY_GROUPS_TEXT_KEY) et comparé littéralement par GroupsPanel.test.tsx : le raccourcir appartient au lot qui possède ce module.",
  "groupes-decouverte":
    "Texte possédé par groupes-thematiques.ts (EMPTY_DISCOVER_TEXT_KEY) et comparé littéralement par GroupsPanel.test.tsx : deux phrases, dont la seconde renvoie à la carte de création déjà montée.",
  agenda: "Texte possédé par evenements-list.ts (emptyAgendaText(t), clé EMPTY_AGENDA_TEXT_KEY) et comparé littéralement par EvenementsPanel.test.tsx : même raison.",
})

/** Ce qu'un état DÉCLARE : son texte et son action, avant la langue et la base. */
interface ReseauEmptyStateSpec {
  /** Le texte : une clé de ce module, ou le texte d'un module voisin (emprunté, jamais recopié). */
  readonly text: (t: TFunction) => string
  readonly action:
    | { readonly kind: "lien"; readonly labelKey: string; readonly href: (home: string) => string }
    | { readonly kind: "geste"; readonly labelKey: string; readonly geste: ReseauEmptyGesteId }
    | null
}

/** Une phrase de ce module : sa clé, sous `reseau:emptyStates.text`. */
const own =
  (key: string) =>
  (t: TFunction): string =>
    t(`reseau:emptyStates.text.${key}`)

/** Les suggestions sont une AUTRE sous-vue, adressable : le seul endroit du volet où l'on peut agir quand on n'a encore personne. */
const SEE_SUGGESTIONS = {
  kind: "lien",
  labelKey: "reseau:emptyStates.action.seeSuggestions",
  href: (home: string) => peopleViewHref("suggestions", home),
} as const

const SPECS: Readonly<Record<ReseauEmptyStateId, ReseauEmptyStateSpec>> = Object.freeze({
  signets: {
    /* L'ancienne phrase décrivait le chemin de souris — « depuis le menu
       “…” d'une publication du fil, choisissez “Enregistrer” » — pour un
       geste qui se fait AILLEURS. L'action y mène ; la phrase constate. */
    text: own("signets"),
    action: { kind: "lien", labelKey: "reseau:emptyStates.action.openFeed", href: (home: string) => home },
  },
  "conferences-en-direct": {
    text: own("conferencesEnDirect"),
    /* Pas d'action : « Lancer une conférence » vit dans les commandes
       permanentes du lieu (en-tête du réseau et barre de création mobile).
       Une seconde porte ici ferait deux chemins vers le même dialogue à
       quinze centimètres d'écart. */
    action: null,
  },
  "conferences-en-direct-avec-rediffusions": {
    /* Pas d'action : les rediffusions sont rendues JUSTE EN DESSOUS, dans la
       même colonne. Un bouton « voir les rediffusions » ne ferait que
       défiler de deux cents pixels. */
    text: own("conferencesEnDirectAvecRediffusions"),
    action: null,
  },
  rediffusions: {
    text: own("rediffusions"),
    action: null,
  },
  agenda: {
    text: (t) => emptyAgendaText(t),
    /* Pas d'action : « Créer un évènement » est rendu par le panneau
       LUI-MÊME, juste au-dessus de cette carte. */
    action: null,
  },
  "groupes-mes-groupes": {
    text: (t) => t(EMPTY_MY_GROUPS_TEXT_KEY),
    /* Pas d'action : la carte de création est rendue au-dessus des deux
       sections, et la découverte est la section suivante. */
    action: null,
  },
  "groupes-decouverte": {
    text: (t) => t(EMPTY_DISCOVER_TEXT_KEY),
    /* Même raison : le texte lui-même renvoie à la carte de création qui est
       déjà montée plus haut. */
    action: null,
  },
  "relations-connexions": {
    /* La phrase portait en plus l'explication de ce qu'OUVRE une connexion.
       C'est de la doctrine de confidentialité (X-07) : elle appartient aux
       réglages du réseau, pas à la carte qui constate un vide. */
    text: own("relationsConnexions"),
    action: SEE_SUGGESTIONS,
  },
  "relations-abonnements": {
    /* ⚠️ Le début « Vous ne suivez personne » est comparé par
       PeoplePanel.test.tsx (expression régulière) : ne pas le reformuler. */
    text: own("relationsAbonnements"),
    action: SEE_SUGGESTIONS,
  },
  "relations-invitations-recues": {
    text: own("relationsInvitationsRecues"),
    /* Pas d'action : recevoir une invitation ne dépend pas de soi. */
    action: null,
  },
  "relations-demandes-envoyees": {
    /* ⚠️ Texte comparé par PeoplePanel.test.tsx. */
    text: own("relationsDemandesEnvoyees"),
    action: null,
  },
  "relations-recherche": {
    /* ⚠️ Texte comparé par PeoplePanel.test.tsx. Pas d'action : le champ
       de recherche est à l'écran, juste au-dessus. */
    text: own("relationsRecherche"),
    action: null,
  },
  suggestions: {
    /* ⚠️ Texte comparé par PeoplePanel.test.tsx et
       DiscoveryEmptyCard.test.tsx. */
    text: own("suggestions"),
    action: null,
  },
})

/**
 * L'état vide désigné, dans la langue de `t`, ses liens composés sur `home`
 * (l'adresse de la page réseau, `useRoutes().home()`) — jamais une valeur muette.
 */
export function reseauEmptyState(id: ReseauEmptyStateId, home: string, t: TFunction): ReseauEmptyState {
  // `Object.hasOwn` : un identifiant forcé par transtypage ne trouve rien d'hérité.
  const spec = Object.hasOwn(SPECS, id) ? SPECS[id] : undefined
  if (spec === undefined) {
    throw new Error(`État vide inconnu : ${id}`)
  }
  const action = spec.action
  return {
    id,
    text: spec.text(t),
    action:
      action === null
        ? null
        : action.kind === "lien"
          ? { kind: "lien", label: t(action.labelKey), href: action.href(home) }
          : { kind: "geste", label: t(action.labelKey), geste: action.geste },
  }
}

/** Tous les états, dans l'ordre déclaré — pour le cliquet et l'inventaire. */
export function allReseauEmptyStates(home: string, t: TFunction): readonly ReseauEmptyState[] {
  return RESEAU_EMPTY_STATE_IDS.map((id) => reseauEmptyState(id, home, t))
}

/**
 * Un texte d'état vide est-il « court » au sens de X-09 ?
 *
 * Deux critères, tous deux mesurables : UNE phrase (aucun point suivi d'un
 * espace — une seconde phrase est toujours le mode d'emploi qu'on remplace par
 * l'action) et une longueur bornée.
 */
export function isShortEmptyText(text: string): boolean {
  if (text.length > EMPTY_TEXT_MAX) return false
  return !text.slice(0, -1).includes(". ")
}
