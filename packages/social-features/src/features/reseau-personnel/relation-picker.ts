// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/relation-picker.ts @ ad2e7fdc2 — adaptations : vivier lu au DTO du moteur (`thematicGroups.thematicGroups.listInviteCandidates` → `{ items, truncated }`, lignes `RelationPickerSourceRow` = `{ personId, displayName nullable, handle, headline, status }`) — le nom manquant retombe sur l'identifiant public ; poste retiré (la ligne sous le nom est le titre de profil, champ `position` gardé pour rester l'interface du sélecteur d'appel) ; libellés par clés i18n qualifiées (`reseau:relationPicker.*`), `t` ajouté en dernier paramètre de `relationPickerStatusLabel`, `relationPickerSelectionLabel`, `relationPickerSubmitLabel` (verbe `undefined` = verbe par défaut traduit) et `relationPickerEmptyText` ; API exportée gardée (noms, types, arbitrage local/serveur).
/**
 * relation-picker — CHOISIR des personnes parmi SES relations (R-13).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN SEUL VOCABULAIRE DE CANDIDAT, TROIS SÉLECTEURS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le sélecteur commun vit dans `features/iappel` : `AddToCallPanel` choisit
 * qui AJOUTER à un appel, à partir d'`AddToCallCandidate`
 * (`{ userId, name, position, handle }` — `userId` porte l'identifiant de la
 * PERSONNE, `position` son titre de profil). Le sélecteur d'invitation de
 * groupe arrive après lui et doit s'y rabattre plus tard, sans conversion :
 * son candidat est donc le MÊME objet, avec un champ de plus, `status`, qui
 * dit ce qui est DÉJÀ fait vis-à-vis de la destination (membre, invitation en
 * attente). Un `AddToCallCandidate` est un `RelationPickerCandidate` valide —
 * un test le vérifie, et c'est la seule garantie qui compte le jour de la
 * fusion.
 *
 * Deux sources alimentent la liste, jamais mélangées :
 *
 *  · le VIVIER, borné par le serveur
 *    (`thematicGroups.listInviteCandidates`, avec son drapeau `truncated`) —
 *    filtré LOCALEMENT par `filterRelationRecipients`, donc instantané à la
 *    frappe ;
 *  · la RECHERCHE serveur (`useRelationSearch`, `graph.connections.searchMine`),
 *    qui va au-delà du plafond. C'est la correction d'IC-05 : « aucune relation
 *    ne correspond » ne se dit qu'après avoir VRAIMENT tout regardé.
 *
 * L'arbitrage entre les deux est celui d'iCom — `deriveRecipientListState`,
 * réutilisé tel quel plutôt que réécrit : deux sélecteurs qui décideraient
 * différemment quand conclure au vide seraient deux produits.
 *
 * Module PUR, testé en `node`. Aucun import React.
 */

import type { TFunction } from "i18next"

import { toCallCandidates, type RelationLike } from "../iappel/add-to-call-candidates"
import { deriveRecipientListState } from "../messagerie/messagerie-recipients"

/** Où en est cette relation vis-à-vis de la destination. */
export type RelationPickerStatus = "eligible" | "member" | "invited"

/**
 * Le candidat du sélecteur — le contrat d'`AddToCallCandidate`, dont les deux
 * champs facultatifs restent facultatifs pour qu'une source plus pauvre s'y
 * range sans adaptateur. `status` absent vaut `eligible` : une surface qui ne
 * connaît aucun état préalable (l'appel) n'a rien à déclarer.
 */
export interface RelationPickerCandidate {
  /** La personne (`Id<"persons">`, en chaîne) — le nom du champ est celui du sélecteur d'appel. */
  userId: string
  name: string
  handle?: string | null
  /** Ce qui s'écrit sous le nom : le titre de profil publié, quand il existe. */
  position?: string | null
  status?: RelationPickerStatus
}

/**
 * Ce que ce module lit du vivier serveur — une ligne de
 * `thematicGroups.listInviteCandidates`, acceptée TELLE QUELLE (aucune
 * conversion au point d'appel).
 */
export interface RelationPickerSourceRow {
  personId: unknown
  /** `null` : la personne n'a pas choisi de nom — son identifiant public la nomme. */
  displayName: string | null
  handle?: string | null
  headline?: string | null
  status?: RelationPickerStatus
}

export function relationPickerStatusOf(candidate: RelationPickerCandidate): RelationPickerStatus {
  return candidate.status ?? "eligible"
}

/** Cochable ? Seul l'éligible : on n'offre pas un geste qui ne peut qu'échouer. */
export function isRelationPickerSelectable(candidate: RelationPickerCandidate): boolean {
  return relationPickerStatusOf(candidate) === "eligible"
}

/** Ce que la ligne DIT de son statut — `null` quand il n'y a rien à dire. */
export function relationPickerStatusLabel(status: RelationPickerStatus, t: TFunction): string | null {
  switch (status) {
    case "eligible":
      return null
    case "member":
      return t("reseau:relationPicker.status.member")
    case "invited":
      return t("reseau:relationPicker.status.invited")
  }
}

/**
 * Le nom d'une ligne du vivier : le nom choisi, sinon l'identifiant public —
 * jamais un nom inventé. Sans l'un ni l'autre, la ligne n'a rien qui la
 * désigne : elle n'est pas proposée (le serveur ne l'aurait pas rendue).
 */
function sourceRowName(row: RelationPickerSourceRow): string | null {
  const name = row.displayName?.trim() ?? ""
  if (name.length > 0) return name
  const handle = row.handle?.trim() ?? ""
  return handle.length > 0 ? `@${handle}` : null
}

/** Le vivier serveur → le vocabulaire du sélecteur, dédoublonné par personne. */
export function toRelationPickerCandidates(rows: readonly RelationPickerSourceRow[]): RelationPickerCandidate[] {
  const out: RelationPickerCandidate[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const userId = String(row.personId)
    if (seen.has(userId)) continue
    const name = sourceRowName(row)
    if (name === null) continue
    seen.add(userId)
    out.push({
      userId,
      name,
      // Le titre de profil — même ligne que le sélecteur d'appel : deux listes
      // de personnes ne se lisent pas autrement l'une de l'autre.
      position: row.headline ?? null,
      handle: row.handle ?? null,
      status: row.status ?? "eligible",
    })
  }
  return out
}

/**
 * Les résultats de la recherche serveur → candidats, par le mapping du
 * sélecteur d'appel (`toCallCandidates`). Le statut vient du vivier déjà
 * connu ; une relation trouvée AU-DELÀ du plafond est éligible par défaut, et
 * c'est le serveur qui tranchera à l'envoi.
 */
export function searchHitsToRelationPickerCandidates(
  hits: readonly RelationLike[],
  statusOf: (userId: string) => RelationPickerStatus,
): RelationPickerCandidate[] {
  return toCallCandidates(hits).map((hit) => ({
    ...hit,
    status: statusOf(hit.userId),
  }))
}

/** L'index des statuts connus — `eligible` pour qui n'y figure pas. */
export function relationPickerStatusIndex(candidates: readonly RelationPickerCandidate[]): (userId: string) => RelationPickerStatus {
  const index = new Map<string, RelationPickerStatus>(candidates.map((row) => [row.userId, relationPickerStatusOf(row)]))
  return (userId) => index.get(userId) ?? "eligible"
}

/** Cocher / décocher — un non-éligible n'entre jamais dans la sélection. */
export function toggleRelationPickerSelection(selected: readonly string[], candidate: RelationPickerCandidate): string[] {
  if (!isRelationPickerSelectable(candidate)) return [...selected]
  return selected.includes(candidate.userId) ? selected.filter((userId) => userId !== candidate.userId) : [...selected, candidate.userId]
}

/** « 3 personnes sélectionnées » — lu à voix haute par `aria-live`. */
export function relationPickerSelectionLabel(count: number, t: TFunction): string {
  if (count === 0) return t("reseau:relationPicker.selectionNone")
  return t("reseau:relationPicker.selection", { count })
}

/**
 * Le bouton d'envoi dit COMBIEN — un « Inviter » nu ne dit pas qui part.
 * `verb` est déjà traduit par l'appelant (« Ajouter »…) ; `undefined` prend le
 * verbe par défaut, « Inviter ».
 */
export function relationPickerSubmitLabel(count: number, verb: string | undefined, t: TFunction): string {
  const resolved = verb ?? t("reseau:relationPicker.defaultVerb")
  if (count === 0) return resolved
  return t("reseau:relationPicker.submitWithCount", { verb: resolved, count })
}

/**
 * Ce que la liste montre, et d'où viennent ses lignes — même partition que le
 * sélecteur de destinataires d'iCom, dont l'arbitrage est réutilisé.
 */
export type RelationPickerListState =
  | { kind: "liste"; items: RelationPickerCandidate[]; source: "local" | "serveur" }
  | { kind: "attente"; items: RelationPickerCandidate[] }
  | { kind: "erreur"; items: RelationPickerCandidate[] }
  | { kind: "vide"; exhaustive: boolean }

/** Ce que le sélecteur sait de la recherche serveur, sans connaître son hook. */
export interface RelationPickerSearchSnapshot {
  /** Le terme SAISI atteint le seuil serveur — avant la pause de frappe. */
  eligible: boolean
  /** Les résultats correspondent au terme saisi et plus rien n'est en route. */
  settled: boolean
  isError: boolean
  items: readonly RelationPickerCandidate[]
}

/** Le format qu'attend `deriveRecipientListState` — nom + adresse. */
interface RecipientRow {
  displayName: string
  handle: string | null
  candidate: RelationPickerCandidate
}

function toRecipientRow(candidate: RelationPickerCandidate): RecipientRow {
  return {
    displayName: candidate.name,
    handle: candidate.handle ?? null,
    candidate,
  }
}

export function relationPickerListState(input: {
  terme: string
  /** Le vivier connu (déjà borné par le serveur). */
  candidates: readonly RelationPickerCandidate[]
  /**
   * Le vivier a été TRONQUÉ au plafond serveur. C'est l'équivalent du
   * « reste-t-il des pages ? » d'iCom : tant que c'est vrai, un vide n'est
   * pas exhaustif et la recherche serveur reste la voie d'accès.
   */
  truncated: boolean
  search: RelationPickerSearchSnapshot
}): RelationPickerListState {
  const state = deriveRecipientListState<RecipientRow>({
    terme: input.terme,
    loaded: input.candidates.map(toRecipientRow),
    hasMore: input.truncated,
    search: {
      eligible: input.search.eligible,
      settled: input.search.settled,
      isError: input.search.isError,
      items: input.search.items.map(toRecipientRow),
    },
  })
  switch (state.kind) {
    case "vide":
      return state
    case "liste":
      return {
        kind: "liste",
        items: state.items.map((row) => row.candidate),
        source: state.source,
      }
    case "attente":
      return { kind: "attente", items: state.items.map((row) => row.candidate) }
    case "erreur":
      return { kind: "erreur", items: state.items.map((row) => row.candidate) }
  }
}

/** Les lignes réellement rendues, quel que soit l'état — `[]` sur un vide. */
export function relationPickerVisibleItems(state: RelationPickerListState): RelationPickerCandidate[] {
  return state.kind === "vide" ? [] : state.items
}

/**
 * Ce que dit l'écran quand aucune ligne n'est rendue — trois phrases, jamais
 * la même : « personne à proposer » (vivier vide, phrase de l'appelant), « rien
 * ne correspond » (réponse EXHAUSTIVE), « la recherche se poursuit » (on n'a
 * pas fini de regarder). Conclure trop tôt est exactement le défaut IC-05.
 */
export function relationPickerEmptyText(
  input: {
    terme: string
    state: RelationPickerListState
    /** Déjà traduit par l'appelant. */
    emptyText: string
  },
  t: TFunction,
): string {
  if (input.terme.trim().length === 0) return input.emptyText
  if (input.state.kind === "vide" && input.state.exhaustive) {
    return t("reseau:relationPicker.noMatch")
  }
  return t("reseau:relationPicker.searchContinues")
}
