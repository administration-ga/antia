/**
 * Les thèmes qu'une personne peut enregistrer sur son compte (Préférences >
 * Thème d'antsia.ga) : des identifiants seuls, contrat commun au validateur de
 * `persons.theme` et à l'interface. Les chartes qui les habillent (fichiers CSS)
 * vivent dans `@antsia/ui` (`ANTSIA_THEME_IDS`) ; les deux listes doivent
 * coïncider, ce que vérifie `apps/antsia_ga/src/components/theme-picker.test.tsx`.
 * Le premier identifiant est la charte d'origine, thème par défaut.
 */
export const MEMBER_THEME_IDS = ["antsia", "atlantique", "indigo", "hibiscus", "encre", "foret", "lagon", "mandarine"] as const
export type MemberThemeId = (typeof MEMBER_THEME_IDS)[number]

export function isMemberThemeId(value: unknown): value is MemberThemeId {
  return typeof value === "string" && (MEMBER_THEME_IDS as readonly string[]).includes(value)
}
