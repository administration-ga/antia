// Dupliqué de socle/packages/agent-features/src/shell/poste-breakpoint.ts @ ad2e7fdc2 — adaptations : renommé de « poste-breakpoint » (nommage du chrome de poste retiré : `POSTE_MOBILE_*` → `MOBILE_*`) ; classes du menu et de la mise en page de poste (`dash-v2`, `poste-workspace`) retirées, sans objet hors de l'espace de poste.
/** Seuil du CHROME des applications du moteur ; les conteneurs métier gardent leurs propres seuils. */
export const MOBILE_MAX_PX = 959
export const DESKTOP_MIN_PX = MOBILE_MAX_PX + 1
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_PX}px)`

// Chaînes complètes : Tailwind doit voir les classes lors de son balayage.
// Le test de `mobile-shell` vérifie leur accord avec les nombres.
export const MOBILE_ONLY_CLASS = "min-[960px]:hidden"
export const DESKTOP_ONLY_CLASS = "hidden min-[960px]:block"
