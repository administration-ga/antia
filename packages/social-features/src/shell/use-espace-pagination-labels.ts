"use client"

/**
 * Les phrases de la pagination du kit d'espace (`@antia/ui/espace-kit`),
 * traduites UNE fois pour tous les volets du réseau personnel.
 *
 * Le paquet d'interface n'a pas d'i18n : `EspacePagination` exige ses phrases
 * de l'appelant (`labels`). Plutôt que chaque volet (groupes, évènements,
 * relations, signets…) les réécrive, ils prennent celles-ci — mêmes mots
 * qu'au socle (« Précédent », « Page 2 sur 5, page actuelle »…), espace de
 * noms `reseau`, clé `espacePagination`.
 */
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { EspacePaginationLabels } from "@antia/ui/espace-kit"

export function useEspacePaginationLabels(): EspacePaginationLabels {
  const { t } = useTranslation("reseau")
  return useMemo(
    () => ({
      navigation: (list) => t("espacePagination.navigation", { list }),
      previous: t("espacePagination.previous"),
      next: t("espacePagination.next"),
      page: (page, count) => t("espacePagination.page", { page, count }),
      currentPage: (page, count) => t("espacePagination.currentPage", { page, count }),
      empty: t("espacePagination.empty"),
      single: t("espacePagination.single"),
      range: ({ page, count, start, end, total }) =>
        t("espacePagination.range", { page, count, start, end, total }),
    }),
    [t],
  )
}
