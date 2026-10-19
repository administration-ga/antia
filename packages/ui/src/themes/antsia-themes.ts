/**
 * Les chartes qu'un membre d'antsia.ga choisit dans ses réglages (Préférences >
 * Thème) : la charte d'origine (`antsia.css`, premier élément, choix par défaut)
 * puis sept thèmes, chacun dans `antsia-<thème>.css`. Chaque thème garde une seule
 * couleur d'identité et des fonds neutres ; `antsia-themes.test.ts` vérifie que
 * cette liste et les fichiers du dossier coïncident.
 */
export const ANTSIA_THEME_IDS = ["antsia", "atlantique", "indigo", "hibiscus", "encre", "foret", "lagon", "mandarine"] as const
export type AntsiaThemeId = (typeof ANTSIA_THEME_IDS)[number]

/** La valeur de `data-charte` d'un thème : `antsia` pour la charte d'origine, `antsia-<thème>` sinon. */
export function antsiaCharteFor(id: AntsiaThemeId): string {
  return id === "antsia" ? "antsia" : `antsia-${id}`
}

/** Les thèmes au format attendu par le fournisseur d'apparence du moteur. */
export const ANTSIA_THEMES: readonly { id: AntsiaThemeId; charte: string }[] = ANTSIA_THEME_IDS.map((id) => ({ id, charte: antsiaCharteFor(id) }))
