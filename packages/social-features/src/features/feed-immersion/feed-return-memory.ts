/**
 * feed-return-memory — ce que le fil retrouve au RETOUR (lot P04, 04 §4) :
 * la publication lue, son index de galerie, son décalage, et la profondeur
 * chargée — après une offre, des commentaires ou un profil.
 *
 * Mémoire de NAVIGATION DE L'ONGLET : un singleton de module, en mémoire
 * seulement. Rien n'est écrit dans un stockage durable, aucune adresse (URL)
 * n'est retenue — seulement des identifiants de publication et des nombres. Un
 * rechargement complet l'efface ; la déconnexion EN EST UN (`signOutEverywhere`
 * navigue vers un nouveau document).
 *
 * Une portée par réseau, personne et fil (`feedReturnScope`) : la coque
 * persistante ACTIVE la session de la personne courante
 * (`FeedReturnSessionBoundary`) et la purge à sa sortie ; une personne qui en
 * remplace une autre sans rechargement (session remplacée) ne lit jamais la
 * position de la précédente — tout est purgé au changement de titulaire.
 * Même patron que la mémoire de la liste iCom (P05,
 * `messagerie-list-state.ts`).
 */

/** Durée de vie d'une position : au-delà, revenir au fil ne la restaure plus. */
export const FEED_RETURN_TTL_MS = 30 * 60_000

/** Profondeur rechargée au plus pour retrouver une position (pages de vingt publications). */
export const FEED_RETURN_MAX_DEPTH = 10

/** Positions retenues au plus, toutes portées confondues. */
export const FEED_RETURN_MAX_ENTRIES = 12

/** Le décalage se lit selon le mode qui l'a mesuré. */
export type FeedOffsetKind = "slot" | "list"

export interface FeedReturnEntry {
  anchorPostId: string
  /** `slot` : défilement intérieur du créneau ; `list` : bord haut de la carte sous le haut du défilement. */
  offset: number
  offsetKind: FeedOffsetKind
  galleryIndex: number | null
  /** Pages du fil montées au moment de la lecture. */
  depth: number
  savedAt: number
}

const entries = new Map<string, FeedReturnEntry>()
let sessionOwner: string | null = null

/** Le titulaire d'une mémoire : un réseau et une personne. */
export function feedReturnOwner(networkId: string, personId: string): string {
  return JSON.stringify([networkId, personId])
}

/** La portée d'un fil — aucune recherche ni adresse n'y entre, un identifiant de fil borné. */
export function feedReturnScope(owner: string, feedId: string): string {
  return JSON.stringify([owner, feedId.slice(0, 512)])
}

function ownerOfScope(scope: string): string | null {
  try {
    const parts: unknown = JSON.parse(scope)
    return Array.isArray(parts) && parts.length === 2 && typeof parts[0] === "string" && typeof parts[1] === "string" ? parts[0] : null
  } catch {
    return null
  }
}

/** La coque persistante ouvre la session de sa personne ; un autre titulaire purge tout. */
export function activateFeedReturnSession(owner: string): void {
  if (sessionOwner === owner) return
  entries.clear()
  sessionOwner = owner
}

/** Une ancienne coque ne purge jamais la nouvelle personne. */
export function clearFeedReturnSession(owner: string): void {
  if (sessionOwner !== owner) return
  entries.clear()
  sessionOwner = null
}

/** La position retenue pour cette portée, si elle est encore fraîche et du titulaire actif. */
export function readFeedReturn(scope: string, now: number): FeedReturnEntry | null {
  const owner = ownerOfScope(scope)
  if (owner === null || owner !== sessionOwner) return null
  const entry = entries.get(scope)
  if (entry === undefined) return null
  if (!(now - entry.savedAt < FEED_RETURN_TTL_MS) || now < entry.savedAt) {
    entries.delete(scope)
    return null
  }
  return entry
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/** Retient la position d'une portée ; refusée hors de la session active. */
export function writeFeedReturn(
  scope: string,
  value: { anchorPostId: string; offset: number; offsetKind: FeedOffsetKind; galleryIndex: number | null; depth: number },
  now: number,
): void {
  const owner = ownerOfScope(scope)
  if (owner === null || owner !== sessionOwner) return
  if (value.anchorPostId.length === 0 || value.anchorPostId.length > 128) return
  const entry: FeedReturnEntry = {
    anchorPostId: value.anchorPostId,
    offset: Math.round(finiteOr(value.offset, 0)),
    offsetKind: value.offsetKind,
    galleryIndex: value.galleryIndex === null || !Number.isFinite(value.galleryIndex) ? null : Math.max(0, Math.trunc(value.galleryIndex)),
    depth: Math.min(FEED_RETURN_MAX_DEPTH, Math.max(1, Math.trunc(finiteOr(value.depth, 1)))),
    savedAt: now,
  }
  // La plus récente en dernier : la plus ancienne part la première.
  entries.delete(scope)
  entries.set(scope, entry)
  while (entries.size > FEED_RETURN_MAX_ENTRIES) {
    const oldest = entries.keys().next()
    if (oldest.done === true) break
    entries.delete(oldest.value)
  }
}

export function forgetFeedReturn(scope: string): void {
  entries.delete(scope)
}

/** Remise à zéro — RÉSERVÉE AUX TESTS. */
export function __resetFeedReturnForTests(): void {
  entries.clear()
  sessionOwner = null
}
