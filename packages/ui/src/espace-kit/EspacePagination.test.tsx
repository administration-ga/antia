// @vitest-environment jsdom
/**
 * EspacePagination — le paquet n'a pas d'i18n : chaque phrase de la barre
 * vient des `labels` de l'appelant. Ce test prouve le branchement (nom de la
 * barre, boutons, numéros, annonce) que le module pur ne peut pas voir.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { EspacePaginationLabels } from "./espace-pagination"
import { EspacePagination } from "./EspacePagination"

const LABELS: EspacePaginationLabels = {
  navigation: (list) => `Pagination — ${list}`,
  previous: "Précédent",
  next: "Suivant",
  page: (page, count) => `Page ${page} sur ${count}`,
  currentPage: (page, count) => `Page ${page} sur ${count}, page actuelle`,
  empty: "Aucun élément",
  single: "1 élément",
  range: ({ page, count, start, end, total }) =>
    `Page ${page} sur ${count} — ${start} à ${end} sur ${total}`,
}

describe("EspacePagination — les phrases viennent de l'appelant", () => {
  it("nomme la barre, les boutons et chaque numéro avec les libellés fournis", () => {
    render(
      <EspacePagination
        page={2}
        pageSize={12}
        totalItems={87}
        onPageChange={() => {}}
        listLabel="Mes groupes"
        labels={LABELS}
      />,
    )

    expect(screen.getByRole("navigation", { name: "Pagination — Mes groupes" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Précédent" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Suivant" })).toBeEnabled()
    const current = screen.getByRole("button", { name: "Page 2 sur 8, page actuelle" })
    expect(current).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Page 1 sur 8" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 sur 8 — 13 à 24 sur 87")
  })

  it("rend la page demandée par les boutons et les numéros", () => {
    const onPageChange = vi.fn()
    render(
      <EspacePagination
        page={2}
        pageSize={12}
        totalItems={87}
        onPageChange={onPageChange}
        listLabel="Mes groupes"
        labels={LABELS}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }))
    fireEvent.click(screen.getByRole("button", { name: "Page 8 sur 8" }))
    expect(onPageChange.mock.calls).toEqual([[3], [1], [8]])
  })

  it("désactive « Précédent » sur la première page et « Suivant » sur la dernière", () => {
    const { rerender } = render(
      <EspacePagination page={1} pageSize={10} totalItems={25} onPageChange={() => {}} listLabel="Agenda" labels={LABELS} />,
    )
    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled()

    rerender(<EspacePagination page={3} pageSize={10} totalItems={25} onPageChange={() => {}} listLabel="Agenda" labels={LABELS} />)
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled()
  })

  it("ne rend rien quand tout tient dans une seule page", () => {
    const { container } = render(
      <EspacePagination page={1} pageSize={10} totalItems={10} onPageChange={() => {}} listLabel="Agenda" labels={LABELS} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
