/**
 * Harnais convex-test du moteur (patron du socle, `socle/convex/test.setup.ts`).
 *
 * `testConvex()` monte un mock complet du backend câblé sur le schéma RÉEL et
 * les modules de fonctions réels. Les fichiers de test qui l'utilisent
 * déclarent en tête : `// @vitest-environment edge-runtime`.
 *
 * Fichier à deux points dans son nom : ignoré par le bundler de Convex, qui
 * refuserait `import.meta.glob` (piège payé par PRO.GA).
 */
import { convexTest } from "convex-test"

import schema from "./schema"

// `import.meta.glob` est une primitive de Vite (vitest), remplacée au transform ;
// son type est déclaré ici pour ne pas tirer `vite/client` dans le typage du
// backend (vite n'est pas une dépendance directe du moteur).
declare global {
  interface ImportMeta {
    glob: (pattern: string | string[]) => Record<string, () => Promise<unknown>>
  }
}

// Glob PARESSEUX de tous les modules de fonctions, plus les `.js` de
// `_generated/` (que convex-test exige pour situer la racine) ; tests, réglages
// et déclarations de types restent dehors — exactement ce que le bundler de
// Convex déploie. Un module n'est importé que si un test l'appelle.
// ⚠️ Forme TABLEAU avec exclusions « ! » : la négation extglob `!(…)` ne
// correspond à RIEN avec le glob de Vite (mesuré : zéro module, harnais muet).
// Référence littérale obligatoire (Vite la remplace statiquement).
export const modules = import.meta.glob([
  "./**/*.ts",
  "./_generated/*.js",
  "!./**/*.test.ts",
  "!./**/*.setup.ts",
  "!./**/*.d.ts",
  "!./vitest.config.ts",
])

/** Instancie un backend Convex mocké contre le schéma et les modules réels. */
export function testConvex() {
  return convexTest(schema, modules)
}
