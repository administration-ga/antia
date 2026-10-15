// Dupliqué de socle/packages/agent-features/src/components/espace-kit/index.ts @ ad2e7fdc2 — adaptations : point d'entrée public `@antia/ui/espace-kit` (champ `exports` du paquet) ; exporte en plus les types des phrases traduites par l'appelant (`EspacePaginationLabels`, `PaginationRange`), le paquet n'ayant pas d'i18n ; liste des symboles inchangée.
/**
 * Le kit de primitives d'espace — cartes, onglets « chemise », état vide,
 * pagination, dialogue par portail, et leur feuille partagée.
 *
 * ⚠️ Le paquet `@antia/ui` n'a PAS d'i18n (il sert plusieurs applications) :
 * toute phrase arrive TRADUITE de l'appelant, par des props — titres, textes,
 * `closeLabel` du dialogue, `labels` de la pagination.
 */
export {
  ESPACE_CARD_STYLE,
  ESPACE_INNER_CARD_STYLE,
  ESPACE_SURFACE_STYLE,
} from "./espace-card"
export { EspaceKitStyles } from "./espace-kit-styles"
export { resolveListState } from "./espace-list-state"
export { EspaceCard } from "./EspaceCard"
export { EspaceDossierTabs } from "./EspaceDossierTabs"
export type { EspaceDossierTab } from "./EspaceDossierTabs"
export { EspaceEmptyState } from "./EspaceEmptyState"
export {
  clampPage,
  pageAriaLabel,
  pageCount,
  pageSlice,
  pageWindow,
  paginationSummary,
  shouldPaginate,
} from "./espace-pagination"
export type { EspacePaginationLabels, PaginationRange } from "./espace-pagination"
export { EspacePagination } from "./EspacePagination"
export { EspaceDialog } from "./EspaceDialog"
