// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/people-panel.ts @ ad2e7fdc2 — adaptations : adresse des sous-vues composée sur la BASE de la page réseau injectée (`peopleViewHref(view, base)`, `base` = `useRoutes().home()`, via `reseauAgentHref` de la coque) au lieu de l'adresse de l'espace écrite en dur ; libellés de la chemise en clés i18n qualifiées (`PEOPLE_VIEW_LABELS` → `PEOPLE_VIEW_LABEL_KEYS` et `peopleViewLabel(view, t)`) ; ligne « fonction » réduite au titre publié (`personTitleLine({ headline })` : poste et administration retirés, le moteur ne porte ni l'un ni l'autre) ; présence lue sur l'identifiant de PERSONNE ; ajout de `relationErrorText` (refus du moteur dit par son code ou sa règle traduits, à défaut la phrase de l'écran).
/**
 * people-panel — ce que le volet Relations DÉCIDE, hors du composant.
 *
 * Le volet portait trois listes empilées dans une colonne, à côté d'une
 * recherche à qui 280 px étaient réservés en permanence (R-04, audit du
 * 2026-09-06) : le grand espace sous la recherche restait vide, et les noms
 * se tronquaient dans la colonne restante. Ce qui en sort est ici parce que
 * cela se vérifie — le paquet monte ses composants en jsdom, mais une
 * décision testée en `node` reste moins chère qu'un rendu.
 *
 *  1. les SOUS-VUES et leur adresse (`?tab=relations&vue=…`), composée sur la
 *     base de la page réseau que l'application injecte ;
 *  2. la ligne de présentation d'une carte — le titre que la personne a
 *     PUBLIÉ, et rien d'autre ;
 *  3. quand la pastille de présence a le droit d'exister ;
 *  4. ce qu'un refus du moteur dit à l'écran.
 */

import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import type { TFunction } from "i18next"

import { RESEAU_AGENT_VUE_PARAM, reseauAgentHref } from "../../shell/reseau-agent-nav"

/**
 * Les trois sous-vues du volet Relations.
 *
 * ⚠️ Ce sont des SOUS-vues, pas des volets : le volet reste `?tab=relations`,
 * et c'est lui que la barre d'onglets et le rail-menu connaissent. Ajouter ici
 * une valeur n'ajoute donc rien au menu du réseau — c'est voulu : trois
 * onglets de plus dans la navigation principale pour un même écran seraient
 * trois façons de dire la même chose.
 */
export const PEOPLE_VIEW_IDS = ["relations", "suggestions", "invitations"] as const

export type PeopleViewId = (typeof PEOPLE_VIEW_IDS)[number]

/** La sous-vue ouverte quand rien n'est demandé. */
export const PEOPLE_VIEW_DEFAULT: PeopleViewId = "relations"

/** Les libellés de la chemise — clés i18n qualifiées, jamais un sigle. */
export const PEOPLE_VIEW_LABEL_KEYS: Readonly<Record<PeopleViewId, string>> = Object.freeze({
  relations: "reseau:peoplePanel.views.relations",
  suggestions: "reseau:peoplePanel.views.suggestions",
  invitations: "reseau:peoplePanel.views.invitations",
})

/** Le libellé d'une sous-vue, dans la langue de l'écran. */
export function peopleViewLabel(view: PeopleViewId, t: TFunction): string {
  return t(PEOPLE_VIEW_LABEL_KEYS[view])
}

/**
 * La sous-vue demandée par l'URL. Insensible à la casse et aux espaces — une
 * adresse recopiée à la main ne doit pas échouer sur une majuscule — et
 * TOLÉRANTE : une valeur inconnue rend la sous-vue par défaut, sans erreur.
 * Même règle que `parseReseauAgentTab` : une page ne refuse pas de s'ouvrir.
 */
export function parsePeopleView(raw: string | null | undefined): PeopleViewId {
  if (raw === null || raw === undefined) return PEOPLE_VIEW_DEFAULT
  const key = raw.trim().toLowerCase()
  if (key.length === 0) return PEOPLE_VIEW_DEFAULT
  return (PEOPLE_VIEW_IDS as readonly string[]).includes(key) ? (key as PeopleViewId) : PEOPLE_VIEW_DEFAULT
}

/**
 * Ajoute un paramètre de VUE à une adresse — après sa query, avant son ancre :
 * la table des routes de l'application reste libre de sa forme.
 */
function withViewParam(href: string, query: string): string {
  const hashAt = href.indexOf("#")
  const path = hashAt === -1 ? href : href.slice(0, hashAt)
  const hash = hashAt === -1 ? "" : href.slice(hashAt)
  return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`
}

/**
 * L'adresse d'une sous-vue, composée sur `base` — l'adresse de la page réseau
 * (`useRoutes().home()`), que seule l'application connaît.
 *
 * La sous-vue par défaut rend l'adresse du VOLET, sans `&vue=relations` : deux
 * adresses pour le même écran en feraient deux entrées d'historique et deux
 * liens à comparer (même règle que `reseauAgentHref`).
 */
export function peopleViewHref(view: PeopleViewId, base: string): string {
  const volet = reseauAgentHref("relations", base)
  return view === PEOPLE_VIEW_DEFAULT ? volet : withViewParam(volet, `${RESEAU_AGENT_VUE_PARAM}=${view}`)
}

/**
 * D'où vient la personne affichée sur une carte. Ce n'est pas un habillage :
 * c'est ce qui décide si la pastille de présence a le droit d'exister.
 */
export type PeoplePersonKind = "relation" | "invitation" | "suggestion" | "recherche"

/**
 * La ligne de présentation d'une carte de personne : le titre (`headline`)
 * que la personne a PUBLIÉ sur son profil.
 *
 * Rien d'autre ne la nourrit : le moteur ne connaît ni poste ni organisation,
 * et les déduire d'ailleurs ferait dire à la carte ce que la personne n'a pas
 * publié. Quand le titre manque, la carte n'invente rien et rend `null` — une
 * ligne vide vaut mieux qu'une mention générique.
 *
 * Les chaînes d'espaces comptent pour absentes : un titre blanc laissé par un
 * formulaire ne doit pas produire une ligne vide sous le nom.
 */
export function personTitleLine(person: { headline?: string | null }): string | null {
  return nonVide(person.headline)
}

function nonVide(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const value = raw.trim()
  return value.length === 0 ? null : value
}

/**
 * La pastille de présence se rend-elle sur cette carte ?
 *
 * ⚠️ NON par défaut. `useConnectionsPresence` ne répond que pour les personnes
 * qui ont accepté de partager leur présence AVEC UNE RELATION : la poser sur
 * une suggestion ou un résultat de recherche afficherait « on ne sait pas »
 * sous la forme d'une absence de pastille — ce qui se lit « hors ligne ».
 * L'identifiant de la personne est exigé pour la même raison : sans lui,
 * `presenceOf` répond `null` pour tout le monde, et la carte annoncerait un
 * état qu'elle n'a pas.
 */
export function showPresence(kind: PeoplePersonKind, otherPersonId: string | null | undefined): boolean {
  if (kind !== "relation") return false
  return typeof otherPersonId === "string" && otherPersonId.length > 0
}

/**
 * Le texte d'un refus du moteur, tel qu'on peut le MONTRER.
 *
 * Le moteur rend des CODES, jamais des phrases : la règle du domaine enfreinte
 * (espace `rules`, bornes en paramètres) d'abord, sinon le code (espace
 * `errors`), sinon la phrase de l'écran (`fallbackKey`, clé qualifiée). Jamais
 * `error.message` : Convex y verse la trace serveur en développement.
 */
export function relationErrorText(err: unknown, fallbackKey: string, t: TFunction): string {
  const rule = engineErrorRule(err)
  if (rule !== null) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(err)
  if (code !== null) return t(`errors:${code}`)
  return t(fallbackKey)
}
