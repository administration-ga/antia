/**
 * Jeton de marque UNIQUE du réseau racine (cahier §0 : « Nom à confirmer —
 * dans le code, le nom est un jeton de marque unique »). Changer de nom
 * (ANTIA / ANTSA, arbitrage A1) se fait ici, en un commit. Les textes
 * d'interface l'insèrent par interpolation i18n (`{{brand}}`), jamais en dur.
 */
export const BRAND_NAME = "ANTIA" as const
