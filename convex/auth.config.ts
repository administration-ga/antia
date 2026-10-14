import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config"
import type { AuthConfig } from "convex/server"

/**
 * Émetteur UNIQUE des jetons acceptés par le moteur : Better Auth (composant
 * `betterAuth`), qui signe un JWT de 30 minutes portant la session.
 *
 * IDN (identite.ga) n'est PAS déclaré ici comme second fournisseur : il entre
 * PAR Better Auth (`genericOAuth` + `@idn-ga/better-auth`, prompt PA4), lu dans
 * les variables du déploiement (`IDN_CLIENT_ID`, `IDN_CLIENT_SECRET`,
 * `IDN_ISSUER` ou `IDN_DISCOVERY_URL`) — jamais en dur. Deux émetteurs
 * donneraient deux `tokenIdentifier` pour la même personne, ce que l'invariant
 * « une personne, un handle, une fois » interdit.
 */
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig
