import { appearanceBootScript } from "@antsia/social-features/shell/appearance/boot-script"

import { APPEARANCE } from "@/lib/appearance"

/** Texte figé au chargement du module : il ne dépend d'aucune requête. */
export const APPEARANCE_BOOT_SCRIPT = appearanceBootScript(APPEARANCE)

/**
 * L'amorçage de l'apparence, en tête de `<head>` : thème et mode sombre posés sur
 * `<html>` avant le premier affichage (ADR-0026). Composant serveur, sans état.
 * `nonce` : celui de la requête quand la CSP à jeton est en place. Le navigateur
 * masque l'attribut une fois le script lu, d'où `suppressHydrationWarning`.
 */
export function AppearanceBootScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
}
