/**
 * Les thèmes qu'une personne peut enregistrer sur son compte (Préférences >
 * Thème d'antsia.ga) : des identifiants seuls, contrat commun au validateur de
 * `persons.theme` et à l'interface. Les chartes qui les habillent (fichiers CSS)
 * vivent dans `@antsia/ui` (`ANTSIA_THEME_IDS`) ; les deux listes doivent
 * coïncider, ce que vérifie `apps/antsia_ga/src/components/theme-picker.test.tsx`.
 * Le premier identifiant, Gaboma, est la charte du réseau et le thème par défaut
 * (ADR-0027).
 */
export const MEMBER_THEME_IDS = ["gaboma", "soleil", "foret", "corail", "lagon", "electrique"] as const
export type MemberThemeId = (typeof MEMBER_THEME_IDS)[number]

/**
 * Identifiants retirés le 19/10/2026 (la Prune d'origine et les thèmes que la
 * série 3 remplace) : toujours ACCEPTÉS en base, car `persons.theme` est validé
 * avec `schemaValidation` et des comptes les portent encore, mais jamais proposés
 * ni écrits, et lus comme le thème par défaut (`memberThemeOf`). `foret` et
 * `lagon` restent des identifiants courants, avec le rendu de la série 3.
 */
export const LEGACY_MEMBER_THEME_IDS = ["antsia", "atlantique", "indigo", "hibiscus", "encre", "mandarine"] as const
export type LegacyMemberThemeId = (typeof LEGACY_MEMBER_THEME_IDS)[number]

/** Tout ce que `persons.theme` peut contenir : les thèmes courants, puis les anciens. */
export const STORED_MEMBER_THEME_IDS = [...MEMBER_THEME_IDS, ...LEGACY_MEMBER_THEME_IDS] as const
export type StoredMemberThemeId = (typeof STORED_MEMBER_THEME_IDS)[number]

export function isMemberThemeId(value: unknown): value is MemberThemeId {
  return typeof value === "string" && (MEMBER_THEME_IDS as readonly string[]).includes(value)
}

/**
 * Le thème à appliquer pour une valeur enregistrée : un thème courant tel quel ;
 * un ancien identifiant ou une valeur inconnue donnent `undefined`, c'est-à-dire
 * le thème par défaut (Gaboma) chez le fournisseur d'apparence.
 */
export function memberThemeOf(value: unknown): MemberThemeId | undefined {
  return isMemberThemeId(value) ? value : undefined
}
