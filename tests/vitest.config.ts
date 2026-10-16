import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Cliquets du moteur : des tests qui RELISENT le code du dépôt (node, sans
// backend). Ils échouent en nommant fichier et ligne.
export default defineConfig({
  test: {
    name: "ratchets",
    root: fileURLToPath(new URL(".", import.meta.url)),
    environment: "node",
    // Mac 16 Go, arbre partagé : les scans simultanés de tous les cliquets
    // provoquaient du swap et des délais dépassés, sans violation détectée.
    maxWorkers: 2,
    include: ["ratchets/**/*.test.ts"],
  },
})
