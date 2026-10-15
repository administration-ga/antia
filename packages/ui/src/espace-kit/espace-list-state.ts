// Dupliqué de socle/packages/agent-features/src/components/espace-kit/espace-list-state.ts @ ad2e7fdc2 — adaptations : aucune sur le code (copie textuelle) ; commentaire rapporté au moteur (le portail RH du socle, origine du constat, n'est pas dupliqué ; « un agent » devient « une personne »).
/**
 * État d'une LISTE, partagé par tout le kit d'espace (LOT 0).
 *
 * Trouvé à l'origine dans le portail RH du socle (D-03, recette navigateur
 * W3), qui réexportait ce symbole plutôt que d'en garder sa propre copie — un
 * seul endroit à faire évoluer.
 *
 * Le patron fautif était `(query.data ?? []).length === 0 && <p>Aucune pièce
 * au dossier.</p>` : le repli `?? []` rend une liste vide indistinguable
 * d'une lecture EN COURS et d'une lecture EN ÉCHEC. L'écran n'était pas muet,
 * il AFFIRMAIT LE FAUX — « Aucune pièce au dossier » alors que la query
 * n'avait pas répondu. C'est plus grave qu'un blanc : une personne pouvait
 * en conclure que sa liste était vide.
 *
 * `items === undefined` est le seul signal de chargement fiable : le repli
 * `?? []` doit disparaître du composant, pas être déplacé. Et l'erreur PRIME
 * sur le chargement : sans cela, une query en échec qui repasse `items` à
 * `undefined` au retry ramène le squelette et masque le problème.
 */
export function resolveListState(input: {
  hasError: boolean
  /** `undefined` tant que le serveur n'a pas répondu. */
  items: readonly unknown[] | undefined
}): "loading" | "error" | "empty" | "ready" {
  if (input.hasError) return "error"
  if (input.items === undefined) return "loading"
  return input.items.length === 0 ? "empty" : "ready"
}
