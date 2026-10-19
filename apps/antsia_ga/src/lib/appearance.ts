import { MEMBER_THEME_IDS } from "@antsia/social-contracts/appearance"

/**
 * L'apparence d'antsia.ga : préfixe de stockage du réseau racine et thèmes que le
 * membre choisit (le premier par défaut). Une seule configuration pour le
 * fournisseur d'apparence (`components/providers.tsx`) et le script d'amorçage de
 * la mise en page (`components/appearance-boot-script.tsx`) : l'un relit
 * exactement ce que l'autre a posé.
 *
 * Module serveur autant que client : il ne lit que le contrat pur des thèmes,
 * jamais l'index de `@antsia/ui`, qui embarque des crochets React interdits à la
 * mise en page serveur. La charte suit la règle d'`antsiaCharteFor` (@antsia/ui) ;
 * `appearance-boot-script.test.tsx` vérifie que la liste reste `ANTSIA_THEMES`.
 */
export const APPEARANCE = {
  storagePrefix: "antsia:antsia:",
  themes: MEMBER_THEME_IDS.map((id) => ({ id, charte: id === "antsia" ? "antsia" : `antsia-${id}` })),
} as const
