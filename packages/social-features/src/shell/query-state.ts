// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/query-state.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; aucune chaîne d'interface (des états, pas des libellés) ; code inchangé.
/**
 * query-state — le CONTRAT d'état d'une liste chargée depuis Convex (IC-07,
 * audit de l'espace agent du 2026-09-06).
 *
 * Six états, et un seul lieu qui les décide. Les vues du réseau lisaient
 * `data ?? []` et `isLoading`, si bien qu'une PANNE se présentait comme une
 * boîte vide, et qu'une query DÉSACTIVÉE (« skip », pas de session) passait
 * pour une attente réseau infinie. Ce module tranche, hors de tout composant :
 *
 *  · `inactif`         — la query n'est pas armée : rien n'est attendu ;
 *  · `attente`         — premier chargement, aucune donnée encore ;
 *  · `erreur`          — la lecture a échoué ; les données PRÉCÉDENTES, si le
 *                        cache en tient, restent à montrer sous un bandeau ;
 *  · `vide`            — le serveur a répondu, il n'y a rien ;
 *  · `pret`            — il y a quelque chose à montrer ;
 *  · `rafraichissement`— il y a quelque chose à montrer, et une lecture est en
 *                        cours derrière.
 *
 * Deux règles qu'aucune vue ne doit contourner :
 *  · une query désactivée n'est JAMAIS `attente` — sinon le squelette est
 *    éternel ;
 *  · une erreur ne VIDE jamais une liste — on garde le dernier résultat
 *    valide et l'on propose Réessayer (`ReseauQueryError`).
 *
 * Ce module ne connaît ni React ni Convex, seulement des booléens — c'est ce
 * qui le rend vérifiable (`query-state.test.ts`).
 */

export type EtatListe =
  | "inactif"
  | "attente"
  | "erreur"
  | "vide"
  | "pret"
  | "rafraichissement"

export interface EtatListeInput {
  /** La query est-elle armée ? `"skip"`, session absente : `false`. */
  enabled: boolean
  /** TanStack : `status === "pending"` — aucune donnée encore détenue. */
  isPending: boolean
  /** TanStack : un aller-retour est en cours (premier chargement OU rafraîchissement). */
  isFetching: boolean
  /** TanStack : `status === "error"`. Le cache conserve les données antérieures. */
  isError: boolean
  /** Ce que la vue détient à l'instant (0 sans données). */
  count: number
}

/**
 * LA décision. L'ordre des tests est le contrat :
 *  1. désactivée → `inactif`, quoi que disent les autres drapeaux (une query
 *     désactivée est `pending` en TanStack v5 — c'est le piège) ;
 *  2. erreur → `erreur`, données ou pas (à la vue de conserver ce qu'elle a) ;
 *  3. sans donnée → `attente` ;
 *  4. avec donnée et lecture en cours → `rafraichissement` ;
 *  5. sinon `vide` ou `pret` selon le compte.
 */
export function deriveEtatListe(input: EtatListeInput): EtatListe {
  if (!input.enabled) return "inactif"
  if (input.isError) return "erreur"
  if (input.isPending) return "attente"
  if (input.isFetching) return "rafraichissement"
  return input.count === 0 ? "vide" : "pret"
}

/**
 * En erreur, reste-t-il quelque chose à montrer ? Si oui, la vue garde sa
 * liste et pose le bandeau AU-DESSUS ; si non, le bandeau tient seul la place.
 * Dans aucun des deux cas l'état vide n'est rendu.
 */
export function conserveDonneesEnErreur(etat: EtatListe, count: number): boolean {
  return etat === "erreur" && count > 0
}

/** Un squelette ne se montre qu'en VRAIE attente. */
export function montreSquelette(etat: EtatListe): boolean {
  return etat === "attente"
}

/**
 * L'état vide n'est légitime que quand le serveur a répondu « rien » — et il
 * le RESTE pendant qu'une relecture tourne derrière (`rafraichissement` à
 * zéro élément) : une liste vide qui clignote à chaque rafraîchissement
 * n'est pas plus honnête. Jamais en erreur, jamais en attente, jamais inactif.
 */
export function montreEtatVide(etat: EtatListe, count: number): boolean {
  if (count !== 0) return false
  return etat === "vide" || etat === "rafraichissement"
}

/** Y a-t-il des éléments à rendre (prêts, ou conservés pendant un rafraîchissement / une panne) ? */
export function montreElements(etat: EtatListe, count: number): boolean {
  if (count === 0) return false
  return etat === "pret" || etat === "rafraichissement" || etat === "erreur"
}

/**
 * Ce qu'un `UseQueryResult` TanStack (via `useAuthenticatedConvexQuery`)
 * expose — sous-ensemble structurel, pour que les tests montés puissent
 * fournir un objet minimal. `isLoading` sert de repli aux mocks qui ne
 * distinguent pas encore `isPending` de `isFetching`.
 */
export interface ResultatQuery {
  isPending?: boolean
  isFetching?: boolean
  isError?: boolean
  isLoading?: boolean
  fetchStatus?: "fetching" | "paused" | "idle"
}

/**
 * L'état d'une query TanStack.
 *
 * `enabled` se DÉDUIT quand l'appelant ne le dit pas : en TanStack v5, une
 * query désactivée est `pending` ET `idle` (elle n'a jamais rien demandé) —
 * une query armée qui attend est `pending` ET `fetching` (ou `paused`, hors
 * ligne). L'appelant qui sait qu'il a passé `"skip"` le dit explicitement.
 */
export function etatDeQuery(
  result: ResultatQuery,
  count: number,
  enabled?: boolean,
): EtatListe {
  const isPending = result.isPending ?? result.isLoading ?? false
  const isFetching = result.isFetching ?? result.isLoading ?? false
  const armee = enabled ?? !(isPending && result.fetchStatus === "idle")
  return deriveEtatListe({
    enabled: armee,
    isPending,
    isFetching,
    isError: result.isError ?? false,
    count,
  })
}

/** Les quatre statuts de `usePaginatedQuery` (convex/react). */
export type StatutPagination =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted"

/**
 * L'état d'une liste PAGINÉE (`usePaginatedQuery`). Une panne y LÈVE au
 * rendu — c'est `ReseauPaginatedErrorBoundary` qui la tient —, donc jamais
 * `erreur` ici. Ce que ce module fixe : l'état VIDE n'est prononcé qu'à
 * `Exhausted` — tant que le serveur peut encore servir une page, « rien » est
 * un mensonge (R-07 : `emptyPagesText` seulement après épuisement).
 */
export function etatDePagination(status: StatutPagination, count: number): EtatListe {
  switch (status) {
    case "LoadingFirstPage":
      return "attente"
    case "LoadingMore":
      return count === 0 ? "attente" : "rafraichissement"
    case "CanLoadMore":
      return "pret"
    case "Exhausted":
      return count === 0 ? "vide" : "pret"
  }
}
