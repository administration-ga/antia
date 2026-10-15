import { defineConfig } from "vitest/config"

// Environnement `node` par défaut, comme au socle : un test qui monte un
// composant déclare `// @vitest-environment jsdom` en tête de fichier.
export default defineConfig({
  test: {
    name: "social-features",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
})
