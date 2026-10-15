// Dupliqué de socle/convex/modules/reseauPersonnel/messagerie/counterpart.ts @ ad2e7fdc2 — adaptations : compte → PERSONNE (le nom CHOISI par la personne, porté par `persons`, quand son profil n'est pas ou plus publié) ; aucun état civil, aucun e-mail (D21) ; libellé inconnu NEUTRE (`displayName: null`, l'écran traduit) au lieu de « Agent ».
/**
 * Comment NOMMER la personne à qui l'on parle.
 *
 * L'opt-in protège la TROUVABILITÉ, pas la CONVERSATION : un fil n'existe que
 * parce que quelqu'un a écrit à quelqu'un ; masquer le nom de qui m'écrit ne
 * protège personne et rend le canal inutilisable. Trois bornes :
 *  1. l'e-mail n'apparaît sur AUCUN chemin — aucune branche ne le lit ;
 *  2. le SÉLECTEUR de destinataire, lui, est un annuaire (profils publiés
 *     seulement) : l'exception ne vaut que pour un fil DÉJÀ ouvert ;
 *  3. `source` dit d'où vient le nom, pour que l'écran le signale.
 */
export type CounterpartSource = "published" | "account" | "unknown"

export interface CounterpartLabel {
  /** `null` : rien à nommer — l'écran affiche le libellé neutre traduit. */
  displayName: string | null
  handle: string | null
  headline: string | null
  avatarUrl: string | null
  source: CounterpartSource
}

/** Le profil PUBLIÉ, tel que le moteur le projette. */
export interface PublishedProfileInput {
  displayName: string | null
  handle: string | null
  headline: string | null
  avatarUrl: string | null
  hasPublishedProfile: boolean
}

/** Ce que la personne a CHOISI comme nom, profil publié ou non. ⚠️ Aucun e-mail n'y entre. */
export interface PersonNameInput {
  displayName?: string | null
}

/** Le nom du correspondant : le profil publié gagne TOUJOURS ; sinon le nom choisi ; sinon neutre. */
export function counterpartLabel(published: PublishedProfileInput | null, person: PersonNameInput | null): CounterpartLabel {
  if (published !== null && published.hasPublishedProfile && published.displayName) {
    return { displayName: published.displayName, handle: published.handle, headline: published.headline, avatarUrl: published.avatarUrl, source: "published" }
  }
  const chosen = person?.displayName?.trim()
  if (chosen) return { displayName: chosen, handle: null, headline: null, avatarUrl: null, source: "account" }
  return { displayName: null, handle: null, headline: null, avatarUrl: null, source: "unknown" }
}
