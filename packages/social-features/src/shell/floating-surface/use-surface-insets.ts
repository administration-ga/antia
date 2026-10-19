// Dupliqué de socle/packages/agent-features/src/features/floating-surface/use-surface-insets.ts @ ad2e7fdc2 — adaptations : obstacles de la COQUE du moteur — barre basse `[data-mobile-nav]` et `.rm-tabbar` gardées, barre de l'espace (`.esp-mobile-bar`) retirée, rail latéral d'iAsted (`[data-iasted-avoid-left]`) remplacé par l'attribut de la coque `data-surface-avoid-left` ; contrat documenté et exporté (`SURFACE_BOTTOM_OBSTACLE_SELECTOR`, `SURFACE_LEFT_OBSTACLE_ATTRIBUTE`) ; mesure et hook inchangés ; déplacé dans la coque (`shell/floating-surface/`).
"use client"

/**
 * useSurfaceInsets — ce qu'une surface flottante ne doit pas recouvrir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE CONTRAT AVEC LA COQUE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deux obstacles, que la COQUE marque — ce module ne connaît aucun composant :
 *
 *  · en BAS, la barre de navigation du téléphone : tout élément portant
 *    `data-mobile-nav` (la barre basse de la coque), ou la barre d'onglets du
 *    réseau (`.rm-tabbar`, `shell/mobile/mobile-styles.tsx`). Le premier trouvé
 *    dans le document fait foi ; sa HAUTEUR est réservée ;
 *  · à GAUCHE, un rail latéral marqué `data-surface-avoid-left` : son BORD
 *    DROIT est réservé, tant qu'il est dans le champ (un rail replié hors champ
 *    ne réserve rien).
 *
 * Une coque qui n'en pose aucun laisse les surfaces libres sur toute la
 * fenêtre. Les deux marques sont exportées : la coque les applique sans
 * recopier une chaîne.
 *
 * ⚠️ On ne réserve délibérément AUCUNE place dans les coins. La fenêtre d'appel
 * vit en bas à droite ; lui réserver un coin la déplacerait sur toutes les
 * installations, pour une gêne que personne n'a signalée. Si le besoin
 * apparaît, ce sera une décision à part.
 */

import { useEffect, useState } from "react"

import type { DragInsets } from "./surface-drag"

const AUCUN: DragInsets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Les barres BASSES qu'une surface flottante évite — posées par la coque. */
export const SURFACE_BOTTOM_OBSTACLE_SELECTOR = "[data-mobile-nav], .rm-tabbar"

/** L'attribut qu'un rail LATÉRAL de la coque pose pour être évité. */
export const SURFACE_LEFT_OBSTACLE_ATTRIBUTE = "data-surface-avoid-left"

const SURFACE_LEFT_OBSTACLE_SELECTOR = `[${SURFACE_LEFT_OBSTACLE_ATTRIBUTE}]`

function mesurer(): DragInsets {
  if (typeof document === "undefined") return AUCUN
  const barre = document.querySelector<HTMLElement>(SURFACE_BOTTOM_OBSTACLE_SELECTOR)
  const rail = document.querySelector<HTMLElement>(SURFACE_LEFT_OBSTACLE_SELECTOR)
  // `getBoundingClientRect` plutôt qu'`offsetWidth` : un rail replié par une
  // transformation garde sa largeur de mise en page mais n'occupe plus rien.
  const bas = barre?.getBoundingClientRect().height ?? 0
  const railRect = rail?.getBoundingClientRect()
  // Un rail décalé hors champ (menu fermé) ne réserve rien.
  const gauche = railRect && railRect.right > 0 ? railRect.right : 0
  return { top: 0, right: 0, bottom: Math.round(bas), left: Math.round(gauche) }
}

export function useSurfaceInsets(active: boolean): DragInsets {
  const [insets, setInsets] = useState<DragInsets>(AUCUN)

  useEffect(() => {
    if (!active) {
      setInsets(AUCUN)
      return
    }
    if (typeof window === "undefined") return

    let annule = false
    const relire = () => {
      if (annule) return
      const suivant = mesurer()
      // Comparaison de valeur : `mesurer` rend un objet neuf à chaque
      // appel, et un `setState` inconditionnel ferait boucler tout hook
      // qui dépend de ce résultat.
      setInsets((precedent) =>
        precedent.top === suivant.top &&
        precedent.right === suivant.right &&
        precedent.bottom === suivant.bottom &&
        precedent.left === suivant.left
          ? precedent
          : suivant,
      )
    }

    relire()
    window.addEventListener("resize", relire)
    window.addEventListener("orientationchange", relire)

    // Une barre latérale qui se replie, un clavier qui s'ouvre : la mise en
    // page change sans qu'aucun évènement de fenêtre ne se produise.
    const observateur = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(relire)
    if (observateur) {
      for (const sel of [SURFACE_BOTTOM_OBSTACLE_SELECTOR, SURFACE_LEFT_OBSTACLE_SELECTOR]) {
        const el = document.querySelector<HTMLElement>(sel)
        if (el) observateur.observe(el)
      }
    }

    return () => {
      annule = true
      window.removeEventListener("resize", relire)
      window.removeEventListener("orientationchange", relire)
      observateur?.disconnect()
    }
  }, [active])

  return insets
}
