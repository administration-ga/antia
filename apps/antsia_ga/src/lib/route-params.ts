/**
 * Un segment dynamique d'adresse (identifiant public d'une personne ou d'une
 * page, identifiant d'album), décodé UNE fois — `null` s'il est vide ou mal
 * encodé : la page répond « introuvable » au lieu de lever.
 *
 * Aucune validation de forme ici : le moteur rend un refus INDISTINCT pour un
 * identifiant inconnu, un profil dépublié ou un blocage ; filtrer côté route
 * distinguerait ces cas. Module PUR : les pages serveur le lisent.
 */
export function decodeRouteSegment(segment: string): string | null {
  let value: string
  try {
    value = decodeURIComponent(segment)
  } catch {
    return null
  }
  return value.length > 0 ? value : null
}
