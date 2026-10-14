import { defineConfig, globalIgnores } from "eslint/config"
import nextTs from "eslint-config-next/typescript"

import { crossProductRestrictions } from "./next.mjs"

/**
 * Config ESLint des paquets TypeScript SANS interface (social-domain,
 * social-contracts) : règles TypeScript du preset Next, mêmes interdits
 * d'imports inter-produits que les applications.
 */
export default defineConfig([
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": ["error", crossProductRestrictions],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  globalIgnores(["dist/**", "coverage/**"]),
])
