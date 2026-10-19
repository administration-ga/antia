/**
 * immersive-reader-model — les DÉCISIONS du lecteur immersif du fil, hors
 * composant (lot P04 de l'étude social-commerce du 18/10/2026, 04 §3–§4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI LE LECTEUR NE REPREND PAS LA MÉCANIQUE DE `VerticalPager`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `VerticalPager` (stories) translate une fenêtre de TROIS éléments sous un
 * `touch-action: none` et décide le geste en JavaScript. Pour le fil, cela
 * casserait quatre exigences de 04 : le zoom à deux doigts (bloqué par
 * `touch-none`), le lecteur d'écran (deux tiers du fil hors du DOM), un texte
 * plus haut que l'écran (rien ne défile dans un élément translaté) et la
 * sélection de texte. Le lecteur du fil défile donc NATIVEMENT, accroché
 * (`scroll-snap-type: y mandatory`, `scroll-snap-stop: always`) :
 *
 *  · l'axe d'un geste est décidé par le navigateur À SON DÉBUT (verrouillage
 *    d'axe du défilement natif) : un balayage horizontal reste à la galerie
 *    (P03, piste `overflow-x` accrochée), un vertical au fil ;
 *  · aucun geste n'est capturé : pas de `setPointerCapture`, pas de
 *    `preventDefault` sur le pointeur — un curseur (`input[type=range]`), une
 *    sélection de texte ou une feuille ouverte (portail hors du lecteur)
 *    gardent leur geste ;
 *  · un créneau plus haut que l'écran défile À L'INTÉRIEUR : la spécification
 *    de l'accrochage n'impose aucun arrêt dans un contenu plus grand que la
 *    zone visible, et le geste suivant rejoint le fil.
 *
 * Ce qui est REPRIS de ses primitives : `nextIndex` (`shell/mobile/gestures/
 * swipe.ts`, pas borné aux deux bouts) pour le clavier, et la même détection de
 * la réduction des mouvements (`useReducedMotion` de `motion/react`).
 *
 * Ce module ne connaît ni React ni le DOM : des nombres, des clés, des
 * chaînes. Le composant (`ImmersiveFeedReader.tsx`) applique.
 */

import { nextIndex } from "../../shell/mobile/gestures/swipe"

export type ReaderKeyIntent = "next" | "previous"

/**
 * La touche pilote-t-elle le lecteur ? Convention clavier des listes : bas
 * et Page suivante = publication suivante ; haut et Page précédente = la
 * précédente. Une touche modifiée appartient au navigateur ou au système.
 */
export function readerKeyIntent(event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): ReaderKeyIntent | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  switch (event.key) {
    case "ArrowDown":
    case "PageDown":
      return "next"
    case "ArrowUp":
    case "PageUp":
      return "previous"
    default:
      return null
  }
}

/**
 * Les éléments qui GARDENT leurs flèches : champs, curseurs et compteurs,
 * listes et menus composites, onglets, feuilles et dialogues, médias (leurs
 * commandes natives règlent le volume et la position avec les flèches).
 * Le lecteur ne prend jamais une touche partie de l'un d'eux.
 */
export const READER_KEY_OWNER_SELECTOR = [
  "input",
  "textarea",
  "select",
  "video",
  "audio",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='listbox']",
  "[role='menu']",
  "[role='menubar']",
  "[role='radiogroup']",
  "[role='tablist']",
  "[role='combobox']",
  "[role='grid']",
  "[role='tree']",
  "[role='dialog']",
  "[role='alertdialog']",
].join(",")

/** Le contenu d'un créneau peut-il encore défiler dans le sens demandé ? (plus haut que l'écran) */
export function canScrollWithin(box: { scrollTop: number; clientHeight: number; scrollHeight: number }, intent: ReaderKeyIntent): boolean {
  if (box.scrollHeight - box.clientHeight <= 1) return false
  return intent === "next" ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 1
}

/** Le créneau visé par une touche, dans l'ordre du document (borné aux deux bouts). */
export function slotNavigationTarget(order: readonly string[], current: string | null, intent: ReaderKeyIntent): string | null {
  if (order.length === 0) return null
  const index = current === null ? -1 : order.indexOf(current)
  if (index < 0) return order[0] ?? null
  const target = nextIndex(index, intent === "next" ? 1 : -1, order.length)
  return target === index ? null : (order[target] ?? null)
}

/**
 * Le créneau LU : le plus visible ; à égalité, le premier dans l'ordre du
 * document. Aucun créneau visible : `null` (on garde le précédent).
 */
export function pickActiveSlot(order: readonly string[], ratios: ReadonlyMap<string, number>): string | null {
  let best: string | null = null
  let bestRatio = 0
  for (const key of order) {
    const ratio = ratios.get(key) ?? 0
    if (ratio > bestRatio + 0.001) {
      best = key
      bestRatio = ratio
    }
  }
  return best
}

/** La voisine préchargée : la SEULE publication qui suit la publication lue. */
export function neighborOf(postOrder: readonly string[], active: string | null): string | null {
  if (active === null) return postOrder[0] ?? null
  const index = postOrder.indexOf(active)
  if (index < 0) return null
  return postOrder[index + 1] ?? null
}

/**
 * Le décalage à appliquer au défilement pour que le créneau lu reste où il
 * était (une insertion ou un retrait AU-DESSUS ne déplace pas la lecture).
 * `top` : la position du créneau dans le défilement, `scrollTop` : le
 * défilement, `anchorTop` : la position visible retenue (créneau − défilement).
 */
export function anchorCorrection(input: { slotTop: number; scrollTop: number; anchorTop: number }): number {
  const delta = input.slotTop - input.scrollTop - input.anchorTop
  return Math.abs(delta) < 1 ? 0 : delta
}

export type EndSlotState = "more" | "emptyWindow" | "end" | "waiting"

/**
 * Le dernier créneau du lecteur :
 *  · `more` : la dernière page a répondu avec une suite — « Charger la suite » ;
 *  · `emptyWindow` : la dernière page est VIDE mais a une suite (filtre,
 *    fenêtre lacunaire) — ce n'est pas la fin du fil, la suite reste offerte ;
 *  · `end` : la chaîne est close (aucune suite) ;
 *  · `waiting` : la dernière page n'a pas encore répondu — on ne conclut pas
 *    d'un silence.
 */
export function endSlotState(input: { canLoadMore: boolean; exhausted: boolean; lastPageEmpty: boolean }): EndSlotState {
  if (input.canLoadMore) return input.lastPageEmpty ? "emptyWindow" : "more"
  if (input.exhausted) return "end"
  return "waiting"
}

/** Pages chargées d'elles-mêmes, au plus, en approchant de la fin (la commande reste offerte). */
export const IMMERSIVE_AUTO_LOAD_PAGES = 3

/** Approche de la fin : la publication lue est l'avant-dernière ou la dernière. */
export function approachingEnd(activeIndex: number, postCount: number): boolean {
  return postCount > 0 && activeIndex >= 0 && activeIndex >= postCount - 2
}

export type RestoreStep = "found" | "append" | "wait" | "missing"

/**
 * Retrouver la publication lue : elle est là (`found`) ; sinon charger la page
 * suivante tant que la profondeur retenue n'est pas atteinte et qu'une suite
 * existe (`append`) ; attendre la réponse d'une page (`wait`) ; abandonner
 * (`missing`) — la publication a quitté le fil ou dépasse la profondeur.
 */
export function restoreStep(input: { present: boolean; canLoadMore: boolean; exhausted: boolean; appended: number; maxAppends: number }): RestoreStep {
  if (input.present) return "found"
  if (input.canLoadMore) return input.appended < input.maxAppends ? "append" : "missing"
  if (input.exhausted) return "missing"
  return "wait"
}

/**
 * Les NOUVELLES publications reçues en tête pendant la lecture : celles qui
 * précèdent la tête figée. Elles ne s'insèrent pas sous la lecture (04 §4) ;
 * une commande dédiée les montre. Une tête figée disparue (retirée, poussée
 * hors de la première fenêtre) ne cache rien.
 */
export function frozenHeadCount(ids: readonly string[], frozen: string | null): number {
  if (frozen === null) return 0
  const index = ids.indexOf(frozen)
  return index > 0 ? index : 0
}

/** La hauteur que le lecteur peut occuper : la place restante, jamais moins qu'un plancher. */
export function fillHeight(input: { available: number; min: number }): number {
  if (!Number.isFinite(input.available)) return input.min
  return Math.max(input.min, Math.floor(input.available))
}
