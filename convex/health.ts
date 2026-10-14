import { v } from "convex/values"

import { query } from "./_generated/server"

/**
 * Sonde de santé du moteur : rend une constante, sans lire aucune table. Sert
 * aux pages `/sante-fonctionnelle` des applications et au harnais de test.
 * Hors des modules sociaux : ni réseau ni adhésion (cliquet
 * `network-scoped-functions`).
 */
export const ping = query({
  args: {},
  returns: v.object({ status: v.literal("ok") }),
  handler: async () => ({ status: "ok" as const }),
})
