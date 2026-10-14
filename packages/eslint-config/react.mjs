import { defineConfig } from "eslint/config"

import next from "./next.mjs"

/**
 * Paquets React du moteur (ui, api, social-features) : mêmes règles que les
 * applications Next, sans la règle qui cherche un dossier `pages/` (un paquet
 * n'a pas de routes).
 */
export default defineConfig([
  ...next,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
])
