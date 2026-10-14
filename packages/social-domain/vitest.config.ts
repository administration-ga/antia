import { defineConfig } from "vitest/config"

// Domaine pur : environnement node, aucun DOM, aucune base. Les tests portés du
// socle (vitest) y tournent sans réécriture de leurs imports (règle 5).
export default defineConfig({
  test: {
    name: "social-domain",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
