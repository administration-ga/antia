// Test du moteur (sans équivalent au socle, qui ne montait aucun composant) : les bandeaux d'une story — lien de profil composé par la table des routes de l'application, auteur sans nom, nom accessible de la croix, légende nulle.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_ROUTES } from "../../tests/engine-wrapper"
import { StoryOverlay } from "./StoryOverlay"

describe("StoryOverlay", () => {
	it("mène au profil par la route de l'application, jamais par une adresse écrite ici", () => {
		renderWithEngine(
			<StoryOverlay
				displayName="Marie Ndong"
				handle="marie"
				avatarUrl={null}
				ageLabel="il y a 2 h"
				onClose={vi.fn()}
			/>,
		)
		const link = screen.getByRole("link")
		expect(link).toHaveAttribute("href", TEST_ROUTES.profile("marie"))
		expect(link).toHaveTextContent("Marie Ndong")
		expect(link).toHaveTextContent("il y a 2 h")
	})

	it("n'ouvre aucun lien sans handle publié, et dit le libellé neutre sans nom", () => {
		renderWithEngine(
			<StoryOverlay
				displayName={null}
				handle={null}
				avatarUrl={null}
				ageLabel="à l'instant"
				caption={null}
				onClose={vi.fn()}
			/>,
		)
		expect(screen.queryByRole("link")).toBeNull()
		expect(screen.getByText("Membre du réseau")).toBeInTheDocument()
	})

	it("ferme par une croix nommée, et montre la légende quand il y en a une", () => {
		const onClose = vi.fn()
		renderWithEngine(
			<StoryOverlay
				displayName="Marie Ndong"
				handle="marie"
				avatarUrl={null}
				ageLabel="il y a 2 h"
				caption="Au marché ce matin"
				onClose={onClose}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "Fermer les actus" }))
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(screen.getByText("Au marché ce matin")).toBeInTheDocument()
	})
})
