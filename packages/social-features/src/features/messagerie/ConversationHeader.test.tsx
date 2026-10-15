// Dupliqué de socle/packages/agent-features/src/features/messagerie/ConversationHeader.test.tsx @ ad2e7fdc2 — adaptations : monté dans l'enveloppe du moteur (`renderWithEngine` : i18n française) — les noms accessibles attendus restent le texte exact du socle ; le titre du fil passé par une constante (donnée de test, hors cliquet des chaînes).
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { ConversationHeader } from "./ConversationHeader"

afterEach(cleanup)

/** Le titre du fil — une donnée du test, pas un texte d'interface. */
const TITRE = "Test Groupe"

describe("ConversationHeader — identité et pose indépendantes", () => {
	it("ouvre les informations du groupe dans le dock déplié sans le rétracter", () => {
		const ouvrirInfos = vi.fn()
		const basculerPose = vi.fn()

		renderWithEngine(
			<ConversationHeader
				variant="dock"
				kind="groupe"
				title={TITRE}
				onBack={vi.fn()}
				onOpenProfile={ouvrirInfos}
				onToggleOpen={basculerPose}
				open
			/>,
		)

		fireEvent.click(
			screen.getByRole("button", {
				name: "Informations du groupe Test Groupe",
			}),
		)

		expect(ouvrirInfos).toHaveBeenCalledTimes(1)
		expect(basculerPose).not.toHaveBeenCalled()
	})

	it("conserve une commande distincte pour rétracter la conversation", () => {
		const ouvrirInfos = vi.fn()
		const basculerPose = vi.fn()

		renderWithEngine(
			<ConversationHeader
				variant="dock"
				kind="groupe"
				title={TITRE}
				onBack={vi.fn()}
				onOpenProfile={ouvrirInfos}
				onToggleOpen={basculerPose}
				open
			/>,
		)

		fireEvent.click(
			screen.getByRole("button", { name: "Rétracter la conversation" }),
		)

		expect(basculerPose).toHaveBeenCalledTimes(1)
		expect(ouvrirInfos).not.toHaveBeenCalled()
	})

	it("déplie d'abord une conversation rétractée avant d'ouvrir sa fiche", () => {
		const ouvrirInfos = vi.fn()
		const basculerPose = vi.fn()

		renderWithEngine(
			<ConversationHeader
				variant="dock"
				kind="groupe"
				title={TITRE}
				onBack={vi.fn()}
				onOpenProfile={ouvrirInfos}
				onToggleOpen={basculerPose}
				open={false}
			/>,
		)

		fireEvent.click(
			screen.getByRole("button", {
				name: "Déployer la conversation Test Groupe",
			}),
		)

		expect(basculerPose).toHaveBeenCalledTimes(1)
		expect(ouvrirInfos).not.toHaveBeenCalled()
	})

	it("regroupe les appels audio et vidéo dans une commande segmentée", () => {
		const appelerAudio = vi.fn()
		const appelerVideo = vi.fn()

		renderWithEngine(
			<ConversationHeader
				variant="page"
				kind="groupe"
				title={TITRE}
				onBack={vi.fn()}
				onCallAudio={appelerAudio}
				onCallVideo={appelerVideo}
			/>,
		)

		const actions = screen.getByRole("group", {
			name: "Actions d'appel pour Test Groupe",
		})
		const audio = screen.getByRole("button", { name: "Appel de groupe" })
		const video = screen.getByRole("button", { name: "Appel vidéo de groupe" })

		expect(actions.querySelectorAll("button")).toHaveLength(2)
		expect(audio.className).toContain("icom-action-group-btn")
		expect(video.className).toContain("icom-action-group-btn")

		fireEvent.click(audio)
		fireEvent.click(video)
		expect(appelerAudio).toHaveBeenCalledOnce()
		expect(appelerVideo).toHaveBeenCalledOnce()
	})
})
