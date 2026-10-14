/**
 * @antia/social-domain — source de vérité des règles du moteur social.
 *
 * TypeScript PUR : aucun import de Convex, de React ni d'un autre paquet. Le
 * backend (`convex/`) et les applications importent ces règles ; elles ne
 * dépendent de rien. Les modules purs du socle (domain, validators, searchText,
 * feedScale, handleSuggestion, counters, connectionState, contentRemoval)
 * arrivent ici au prompt PA2, avec leurs tests, aux côtés des règles propres au
 * moteur (réseaux, adhésions, visibilité network/root, badges calculés).
 */
export const SOCIAL_DOMAIN_VERSION = "0.0.0" as const
