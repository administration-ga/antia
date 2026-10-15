/**
 * Surfaces plein écran et seuil de la coquille mobile du moteur : le portail
 * immersif (`ImmersiveOverlay`), ses deux prérequis (verrou de défilement,
 * hauteur visible clavier compris) et le seuil ≤ 959 px partagé par la barre
 * basse, la coquille mobile et le dock de messagerie.
 */
export { ImmersiveOverlay } from "./ImmersiveOverlay"
export type { ImmersiveOverlayProps } from "./ImmersiveOverlay"
export { useBodyScrollLock } from "./useBodyScrollLock"
export { useVisualViewport } from "./useVisualViewport"
export { useIsReseauMobile } from "./useIsReseauMobile"
export { RESEAU_MOBILE_MAX_PX, RESEAU_MOBILE_QUERY, isReseauMobileWidth, resolveMobileViewport } from "./mobile-shell"
export { MOBILE_MAX_PX, DESKTOP_MIN_PX, MOBILE_QUERY, MOBILE_ONLY_CLASS, DESKTOP_ONLY_CLASS } from "./breakpoint"
