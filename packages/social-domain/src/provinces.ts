/**
 * Référentiel des neuf provinces ; les slugs sont des attributions volontaires
 * du contenu, jamais déduites d'un pays, d'une identité ou d'une facette actuelle.
 * Noms : ministère de l'Intérieur, Découpage territorial, DGAT.
 */
export const PROVINCE_SLUGS = [
  "estuaire", "haut-ogooue", "moyen-ogooue", "ngounie", "nyanga",
  "ogooue-ivindo", "ogooue-lolo", "ogooue-maritime", "woleu-ntem",
] as const

export type ProvinceSlug = (typeof PROVINCE_SLUGS)[number]

export const GABON_PROVINCES: readonly { readonly slug: ProvinceSlug; readonly name: string }[] = [
  { slug: "estuaire", name: "Estuaire" },
  { slug: "haut-ogooue", name: "Haut-Ogooué" },
  { slug: "moyen-ogooue", name: "Moyen-Ogooué" },
  { slug: "ngounie", name: "Ngounié" },
  { slug: "nyanga", name: "Nyanga" },
  { slug: "ogooue-ivindo", name: "Ogooué-Ivindo" },
  { slug: "ogooue-lolo", name: "Ogooué-Lolo" },
  { slug: "ogooue-maritime", name: "Ogooué-Maritime" },
  { slug: "woleu-ntem", name: "Woleu-Ntem" },
]

/** Exact seulement : ni code pays, ni normalisation ambiguë au bord d'une API. */
export function isProvinceSlug(value: unknown): value is ProvinceSlug {
  return typeof value === "string" && (PROVINCE_SLUGS as readonly string[]).includes(value)
}
