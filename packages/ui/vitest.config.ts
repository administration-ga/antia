import { defineConfig } from "vitest/config"

// Environnement `node` par défaut ; un test qui monte un composant déclare
// `// @vitest-environment jsdom` en tête de fichier.
export default defineConfig({
  test: {
    name: "ui",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
})
