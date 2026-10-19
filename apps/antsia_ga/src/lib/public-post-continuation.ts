/** Le seul retour proposé par la porte publique : une publication, jamais une URL. */
export const PUBLIC_POST_CONTINUATION_PARAM = "publication"

/**
 * Une référence opaque, bornée et sans syntaxe d'adresse. Les valeurs multiples
 * (paramètre répété), espaces, encodages, chemins, requêtes et fragments sont
 * refusés. Ce contrôle ne confère aucun accès : le moteur vérifie ensuite
 * l'identifiant de publication, son existence et les droits du membre.
 */
export function parsePublicPostContinuation(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !/[^a-zA-Z0-9_-]/.test(value) ? value : undefined
}
