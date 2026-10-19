import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "@convex": fileURLToPath(new URL("../../convex", import.meta.url)) },
  },
  // Vitest vide toute feuille importée (option `test.css` par défaut), mais Vite 8 lit la
  // configuration PostCSS AVANT de voir la feuille vide. Celle de Next (`postcss.config.mjs`,
  // greffons nommés par chaîne : forme propre à Next) est refusée par postcss-load-config dès
  // qu'un module testé atteint une feuille — `@livekit/components-styles`, importée par
  // `DirectRoomMount` via la coque membre. Une configuration en ligne évite cette lecture en
  // test seulement ; `next dev` et `next build` lisent toujours `postcss.config.mjs`.
  css: { postcss: { plugins: [] } },
  test: {
    name: "antsia-ga",
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
})
