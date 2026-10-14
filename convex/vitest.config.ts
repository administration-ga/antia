import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Racine épinglée sur convex/ : les globs ne dépendent pas du dossier d'appel.
// Fichier à deux points dans son nom : ignoré par le bundler de Convex (comme
// `test.setup.ts` et tous les `*.test.ts`).
const convexRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  test: {
    name: "convex",
    root: convexRoot,
    include: ["tests/**/*.test.ts", "**/*.test.ts"],
    exclude: ["**/node_modules/**", "_generated/**"],
    // Les tests convex-test déclarent `// @vitest-environment edge-runtime`
    // (environnement proche du sandbox Convex) ; `node` par défaut pour les
    // tests de modules purs, comme au socle (ADR-0003 du socle).
    environment: "node",
    server: { deps: { inline: ["convex-test"] } },
    env: {
      // convex-test ne monte pas les composants : les limiteurs de débit
      // passent en mode neutre dans la suite (patron PRO.GA, PA2).
      ANTIA_TEST_DISABLE_RATE_LIMITS: "1",
    },
  },
})
