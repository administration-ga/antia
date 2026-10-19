// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/DiscoveryEmptyCard.test.tsx @ ad2e7fdc2 — adaptations : textes de test au vocabulaire du réseau (« Personnes à découvrir », l'état vide du registre `empty-states`, page sans « officielle ») ; les deux cas du socle gardés.
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DiscoveryEmptyCard } from "./DiscoveryEmptyCard"

afterEach(cleanup)

describe("DiscoveryEmptyCard", () => {
  it("conserve une vraie carte dans le rail quand il n'y a rien à proposer", () => {
    const { container } = render(
      <DiscoveryEmptyCard title="Personnes à découvrir" message="Aucune nouvelle personne à proposer pour le moment." presentation="rail" />,
    )

    const section = screen.getByRole("region", { name: "Personnes à découvrir" })
    expect(screen.getByRole("heading", { name: "Personnes à découvrir" })).toBeTruthy()
    expect(screen.getByText("Aucune nouvelle personne à proposer pour le moment.")).toBeTruthy()
    expect(container.firstElementChild).not.toBe(section)
  })

  it("reste sans enveloppe de carte dans le carrousel", () => {
    const { container } = render(<DiscoveryEmptyCard title="Pages à suivre" message="Aucune nouvelle page à proposer pour le moment." presentation="carousel" />)

    expect(container.firstElementChild).toBe(screen.getByRole("region", { name: "Pages à suivre" }))
  })
})
