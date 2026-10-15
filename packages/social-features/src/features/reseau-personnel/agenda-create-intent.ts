// Dupliqué de socle/packages/agent-features/src/features/iagenda/agenda-create-intent.ts @ ad2e7fdc2 — adaptations : déplacé dans le réseau personnel (le moteur n'a pas d'iAgenda) ; l'intention vise le volet Évènements de la PAGE RÉSEAU, qui compose l'évènement lui-même, au lieu d'iAgenda ; aucune adresse écrite ici — la base de la page réseau (`useRoutes().home()`) est le DERNIER paramètre de `isSafeReturnPath`, `parseAgendaCreateIntent` et `buildAgendaCreateHref`, et un retour n'est sûr que SOUS cette base (au lieu de deux préfixes écrits en dur) ; `AGENDA_URL` retiré ; ajouté `agendaCreateConsumedHref` (l'adresse nettoyée après consommation de l'intention) ; paramètres, consommation unique et refus d'open redirect inchangés.
/**
 * agenda-create-intent — l'INTENTION de composer un évènement, et le RETOUR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE (R-16, audit du 2026-09-06)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Créer un évènement » envoyait sur une page d'agenda NUE : on y atterrissait
 * sans formulaire ouvert, sans savoir d'où l'on venait ni comment y revenir. Le
 * geste était perdu deux fois — une fois par la page, une fois par le retour.
 *
 * On adresse donc une INTENTION (`?nouveau=evenement`) et une adresse de retour
 * (`?retour=…`), que la surface de composition consomme UNE fois — même
 * convention que `STORY_CREATE_ORIGIN_PARAM` des actus.
 *
 * Dans le moteur, cette surface est le volet Évènements de la PAGE RÉSEAU
 * (`useRoutes().home()` + `?tab=evenements`) : il n'y a pas d'iAgenda, et le
 * volet compose l'évènement lui-même. Une intention portée par l'ADRESSE reste
 * le bon véhicule : la commande « Créer » de n'importe quelle page y mène, et
 * un rechargement ne rejoue rien (les deux paramètres sont retirés à la
 * consommation).
 *
 * ⚠️ **`retour` est un vecteur d'open redirect.** Une valeur brute passée à
 * `router.push` enverrait la personne où l'auteur du lien veut — y compris hors
 * du domaine. `isSafeReturnPath` n'accepte qu'un chemin RELATIF INTERNE, sous
 * la base de la page réseau, et rien d'autre : ni `//evil.example`, ni
 * `https://…`, ni `javascript:`.
 *
 * Aucune adresse n'est écrite ici : la base est reçue en paramètre. Aucun
 * import React ni Convex : ce module ne connaît que des chaînes.
 */

import { reseauAgentHref } from "../../shell/reseau-agent-nav"

/** Le paramètre d'intention. Une seule valeur reconnue à ce jour. */
export const AGENDA_CREATE_PARAM = "nouveau"

/** La valeur qui ouvre le formulaire d'évènement personnel. */
export const AGENDA_CREATE_EVENT_VALUE = "evenement"

/** Le paramètre d'adresse de retour. */
export const AGENDA_RETURN_PARAM = "retour"

/**
 * Ce que la page doit retirer de l'URL une fois l'intention consommée.
 *
 * Les DEUX ensemble : garder `retour` sans `nouveau` laisserait une adresse de
 * retour orpheline, qu'un rechargement rejouerait sans intention.
 */
export const AGENDA_CREATE_CONSUMED_PARAMS: Readonly<Record<string, null>> = Object.freeze({
  [AGENDA_CREATE_PARAM]: null,
  [AGENDA_RETURN_PARAM]: null,
})

export interface AgendaCreateIntent {
  /** Le format à composer à l'arrivée, ou `null`. */
  create: typeof AGENDA_CREATE_EVENT_VALUE | null
  /** Où revenir après la création, ou `null` — déjà VALIDÉ. */
  returnTo: string | null
}

/** Le chemin d'une adresse, sans sa query ni son ancre. */
function pathOf(value: string): string {
  const end = value.search(/[?#]/)
  return end === -1 ? value : value.slice(0, end)
}

/**
 * La base sous laquelle un retour est permis : le CHEMIN de la page réseau,
 * sans barre finale. Une application qui la sert à la racine (`/`) rend la
 * base vide — tout chemin interne est alors sous elle.
 */
function returnBaseOf(home: string): string {
  return pathOf(home).replace(/\/+$/, "")
}

/**
 * Un chemin de retour est-il sûr ?
 *
 * Fermé par défaut : tout ce qui n'est pas explicitement un chemin relatif
 * interne SOUS la page réseau (`home`, l'adresse injectée par l'application)
 * est refusé.
 */
export function isSafeReturnPath(value: string | null | undefined, home: string): boolean {
  if (typeof value !== "string" || value.length === 0) return false
  // Espaces et caractères de contrôle : un chemin n'en porte pas, et ils
  // servent à contourner les contrôles naïfs (« /\u0009javascript:… »).
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false
  // Un anti-slash est lu comme un slash par plusieurs navigateurs : `/\evil`
  // sortirait du domaine.
  if (value.includes("\\")) return false
  // `javascript:`, `https:`, `data:`… — un schéma n'est jamais un chemin.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false
  if (!value.startsWith("/")) return false
  // `//evil.example` est une URL protocol-relative, pas un chemin.
  if (value.startsWith("//")) return false

  const chemin = pathOf(value)
  const base = returnBaseOf(home)
  if (base.length === 0) return true
  // La BORNE compte : `/filx` n'est pas sous `/fil`.
  return chemin === base || chemin.startsWith(`${base}/`)
}

/** Ce que porte l'URL — les paramètres non reconnus sont ignorés, pas subis. */
export function parseAgendaCreateIntent(params: { get(name: string): string | null }, home: string): AgendaCreateIntent {
  const brut = params.get(AGENDA_CREATE_PARAM)
  const create = brut === AGENDA_CREATE_EVENT_VALUE ? brut : null
  const retour = params.get(AGENDA_RETURN_PARAM)
  return {
    create,
    // Un retour sans intention ne mène nulle part : on ne le retient pas.
    returnTo: create !== null && retour !== null && isSafeReturnPath(retour, home) ? retour : null,
  }
}

/** Ajoute une query à une adresse — après sa propre query si elle en porte une, avant son ancre. */
function appendQuery(target: string, query: string): string {
  const hashAt = target.indexOf("#")
  const path = hashAt === -1 ? target : target.slice(0, hashAt)
  const hash = hashAt === -1 ? "" : target.slice(hashAt)
  return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`
}

/**
 * L'adresse qui OUVRE la composition d'un évènement — le volet Évènements de
 * la page réseau (`home`), avec l'intention et son retour.
 *
 * Un `returnTo` refusé n'est pas une erreur : on ouvre simplement la
 * composition sans promesse de retour, plutôt que d'annuler le geste.
 */
export function buildAgendaCreateHref(returnTo: string | null | undefined, home: string): string {
  const params = new URLSearchParams({ [AGENDA_CREATE_PARAM]: AGENDA_CREATE_EVENT_VALUE })
  if (typeof returnTo === "string" && isSafeReturnPath(returnTo, home)) {
    params.set(AGENDA_RETURN_PARAM, returnTo)
  }
  return appendQuery(reseauAgentHref("evenements", home), params.toString())
}

/**
 * L'adresse à POSER (par `replace`) une fois l'intention consommée : la même
 * page, sans les deux paramètres de l'intention — les autres (le volet ouvert,
 * notamment) sont gardés.
 */
export function agendaCreateConsumedHref(pathname: string, params: { toString(): string }): string {
  const next = new URLSearchParams(params.toString())
  for (const key of Object.keys(AGENDA_CREATE_CONSUMED_PARAMS)) next.delete(key)
  const query = next.toString()
  return query.length > 0 ? `${pathname}?${query}` : pathname
}
