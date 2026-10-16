/**
 * @antsia/api — tout ce qu'une application du moteur sait du backend passe ici :
 * client Convex + TanStack Query, session Better Auth (IDN, codes à usage
 * unique), réseau courant (`NetworkProvider` / `useNetwork`), adaptateur de
 * routage (`useRoutes` : aucune URL codée en dur dans les paquets), passage de
 * session entre applications (`useSsoNavigate`), `signOutEverywhere`.
 * Rempli à partir des prompts PA2 (réseau courant) et PA4 (identité).
 */
export const API_PACKAGE = "@antsia/api" as const
