// Dupliqué de socle/packages/agent-features/src/components/espace-kit/EspacePagination.tsx @ ad2e7fdc2 — adaptations : le paquet d'interface n'a pas d'i18n — « Précédent », « Suivant », le nom de la barre (« Pagination — <liste> »), les noms des numéros et l'annonce viennent de l'appelant par la nouvelle prop OBLIGATOIRE `labels` (`EspacePaginationLabels`), comme `closeLabel` du tiroir et d'`Alert` ; `listLabel` et le reste du contrat inchangés ; rendu inchangé.
"use client"

import {
  clampPage,
  type EspacePaginationLabels,
  pageAriaLabel,
  pageCount,
  pageWindow,
  paginationSummary,
  shouldPaginate,
} from "./espace-pagination"

/**
 * La barre de pagination du kit d'espace. Toute la décision (nombre de
 * pages, fenêtre de numéros, phrase annoncée) vient de `espace-pagination.ts`
 * — ce composant ne fait que la rendre, avec les phrases que l'appelant a
 * traduites (`labels`).
 *
 * Rend `null` quand tout tient dans une seule page : une pagination à un
 * seul numéro n'a rien à offrir et n'occupe pas d'espace pour rien.
 */
export function EspacePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  listLabel,
  labels,
  density = "default",
}: {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  /** Le nom de la liste paginée, déjà traduit (« Mes groupes »). */
  listLabel: string
  /** Les phrases de la barre, traduites par l'appelant : le paquet n'a pas d'i18n. */
  labels: EspacePaginationLabels
  /** `"compact"` réduit les cibles de 44px à 32px (voir espace-kit-styles.tsx). */
  density?: "default" | "compact"
}) {
  if (!shouldPaginate(totalItems, pageSize)) return null

  const count = pageCount(totalItems, pageSize)
  const current = clampPage(page, totalItems, pageSize)
  const entries = pageWindow(current, count)

  return (
    <nav
      className="esk-pagination"
      aria-label={labels.navigation(listLabel)}
      data-density={density}
    >
      <button
        type="button"
        className="esk-pagination-nav"
        disabled={current <= 1}
        onClick={() => onPageChange(current - 1)}
      >
        {labels.previous}
      </button>
      {entries.map((entry, index) =>
        entry === "gap" ? (
          <span
            // Deux trous ne sont jamais adjacents (cf. espace-pagination.ts) :
            // l'index suffit à distinguer les deux occurrences possibles.
            key={`gap-${index}`}
            className="esk-pagination-gap"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className="esk-pagination-num"
            aria-current={entry === current ? "page" : undefined}
            aria-label={pageAriaLabel(entry, count, entry === current, labels)}
            onClick={() => onPageChange(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className="esk-pagination-nav"
        disabled={current >= count}
        onClick={() => onPageChange(current + 1)}
      >
        {labels.next}
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {paginationSummary(current, pageSize, totalItems, labels)}
      </p>
    </nav>
  )
}
