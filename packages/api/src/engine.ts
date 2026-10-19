/**
 * Références TYPÉES du moteur pour les surfaces (`@antsia/social-features`) et
 * les applications : `api` (fonctions publiques) et les types de documents.
 * Les surfaces n'importent jamais `convex/` directement (owner map §7.0) :
 * tout passe par ce point d'entrée, qui vise le `_generated` du moteur seul.
 */
export { api } from "../../../convex/_generated/api"
export type { Doc, Id, TableNames } from "../../../convex/_generated/dataModel"
