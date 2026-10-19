// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/contacts-rail.ts @ ad2e7fdc2 — adaptations : contact lu au DTO du graphe du moteur (`otherPersonId`, nom NULLABLE : une relation sans nom choisi reste listée, sous le libellé neutre de l'écran) ; tri dans la langue de l'écran (`sortContacts(contacts, locale)`, plus de « fr » en dur ; les sans-nom en dernier) ; textes par clés i18n qualifiées (`reseau:contactsRail.*`, `t` ajouté en dernier paramètre d'`emptyContactsText` et `contactsCountLabel`) ; « collègues » devient « personnes ».
/**
 * contacts-rail — ce que le rail des CONTACTS décide, hors de tout composant.
 *
 * Ce qui reste dans le corps d'un composant ne se vérifie qu'au rendu : le
 * filtre, l'ordre et les libellés vivent donc ici, testés en `node`.
 *
 * Le rail liste mes CONNEXIONS (`graph.connections.paginateMine`) et non « qui
 * est en ligne » : une colonne de pastilles vertes toujours grises serait pire
 * que pas de pastille du tout. Cliquer sur un contact ouvre un brouillon de
 * conversation — c'est le geste que la liste sert, et la raison de son ordre.
 */

import type { TFunction } from "i18next"

import { normalizeSearchText } from "./shared"

/** Ce que le rail a besoin de savoir d'un contact. */
export interface ContactRailPerson {
  /** La personne (`Id<"persons">`, en chaîne). */
  otherPersonId: string
  /** `null` : la personne n'a pas (ou plus) de nom publié — l'écran affiche le libellé neutre. */
  displayName: string | null
  handle: string | null
  /** Sa ligne de présentation publiée — jamais son état civil. */
  headline: string | null
  avatarUrl: string | null
}

/**
 * Le sous-titre d'un contact.
 *
 * La ligne de présentation d'abord — c'est ce que la personne a CHOISI de dire
 * d'elle. À défaut, le handle, qui est public par construction. Jamais rien
 * d'autre : ni organisation ni poste ne sont dans ce DTO, et les déduire
 * d'ailleurs ferait dire au rail ce que la personne n'a pas publié (doctrine
 * de l'opt-in du profil).
 */
export function contactSubtitle(contact: ContactRailPerson): string | null {
  const headline = contact.headline?.trim()
  if (headline !== undefined && headline.length > 0) return headline
  if (contact.handle !== null && contact.handle.length > 0) {
    return `@${contact.handle}`
  }
  return null
}

/** Le filtre du rail : sur le nom, le handle et la ligne de présentation. */
export function filterContacts(contacts: readonly ContactRailPerson[], query: string): ContactRailPerson[] {
  const needle = normalizeSearchText(query)
  if (needle.length === 0) return [...contacts]
  return contacts.filter((contact) => {
    const haystack = [contact.displayName ?? "", contact.handle ?? "", contact.headline ?? ""].map(normalizeSearchText).join(" ")
    return haystack.includes(needle)
  })
}

/**
 * L'ordre du rail : alphabétique, dans la langue de l'écran (`locale`).
 *
 * ⚠️ Et non par date de connexion, comme le rend le serveur. Une liste qu'on
 * PARCOURT pour y trouver quelqu'un se range par nom ; l'ordre d'arrivée est
 * utile là où l'on regarde ce qui est nouveau, ce que ce rail ne fait pas.
 * `localeCompare` met « Élise » à sa place — un tri brut par point de code la
 * renverrait après « Zé ». Une relation sans nom se range en dernier : elle n'a
 * rien par quoi on la chercherait des yeux.
 */
export function sortContacts(contacts: readonly ContactRailPerson[], locale: string): ContactRailPerson[] {
  return [...contacts].sort((left, right) => {
    if (left.displayName === null) return right.displayName === null ? 0 : 1
    if (right.displayName === null) return -1
    return left.displayName.localeCompare(right.displayName, locale, {
      sensitivity: "base",
    })
  })
}

/**
 * L'état vide, qui n'est pas le même dans les deux cas : une recherche sans
 * résultat n'est pas un carnet vide, et proposer « trouvez des personnes » à
 * qui vient de taper trois lettres serait à côté de la question.
 */
export function emptyContactsText(query: string, t: TFunction): string {
  if (normalizeSearchText(query).length > 0) {
    return t("reseau:contactsRail.noMatch")
  }
  return t("reseau:contactsRail.empty")
}

/** Le décompte, au pluriel juste — `0` compris. */
export function contactsCountLabel(count: number, t: TFunction): string {
  if (count <= 0) return t("reseau:contactsRail.countNone")
  return t("reseau:contactsRail.count", { count })
}
