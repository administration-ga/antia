/**
 * @antia/social-domain — source de vérité des règles du moteur social.
 *
 * TypeScript PUR : aucun import de Convex, de React ni d'un autre paquet. Le
 * backend (`convex/`) et les applications importent ces règles ; elles ne
 * dépendent de rien. Deux familles :
 *
 *  · les règles PROPRES au moteur : réseaux, adhésions, facettes, consentements,
 *    badges calculés, visibilité `network`/`root` ;
 *  · les modules purs DUPLIQUÉS du socle (`origin/main` ad2e7fdc2, owner map
 *    `docs/02` §6.5) : contenu des publications, texte riche, groupes
 *    thématiques, évènements, stories, fils de groupe, recherche, fil, état des
 *    demandes de relation, propositions d'identifiant.
 *
 * Chaque module s'importe aussi par son chemin (`@antia/social-domain/content`).
 */
export const SOCIAL_DOMAIN_VERSION = "0.0.0" as const

export * from "./audit"
export * from "./badges"
export * from "./connectionState"
export * from "./consent"
export * from "./content"
export * from "./events"
export * from "./facets"
export * from "./feedScale"
export * from "./filePolicy"
export * from "./groupThreads"
export * from "./handleSuggestion"
export * from "./membership"
export * from "./moderation"
export * from "./network"
export * from "./notifications"
export * from "./richText"
export * from "./searchText"
export * from "./stories"
export * from "./thematicGroups"
export * from "./uploadPolicy"
export * from "./violation"
export * from "./visibility"
