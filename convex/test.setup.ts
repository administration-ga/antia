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
import aggregateTest from "@convex-dev/aggregate/test"
import rateLimiterTest from "@convex-dev/rate-limiter/test"
import { convexTest } from "convex-test"

import schema from "./schema"

// `import.meta.glob` est une primitive de Vite (vitest), remplacée au transform.
// Son type arrive par `@convex-dev/rate-limiter/test`, dont la référence
// `vite/client` augmente `ImportMeta` pour tout le programme : ne PAS le
// redéclarer ici (TS2717, piège déjà relevé au socle).

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

/**
 * Instancie un backend Convex mocké contre le schéma et les modules réels, avec
 * le VRAI limiteur de débit et les VRAIS agrégats (composants montés) : les
 * tests exercent les seuils et les décomptes, ils ne les neutralisent pas.
 */
export function testConvex() {
  const t = convexTest(schema, modules)
  rateLimiterTest.register(t, "rateLimiter")
  aggregateTest.register(t, "followerCounts")
  return t
}
