// Dupliqué de socle/packages/agent-features/src/features/messagerie/PinnedMessageBanner.test.tsx @ ad2e7fdc2 — adaptations : monté dans l'enveloppe du moteur (`renderWithEngine` : i18n française) — les libellés attendus restent le texte exact du socle.
// @vitest-environment jsdom

/**
 * PinnedMessageBanner — l'épingle au sommet du fil (ADR-0143 §5).
 *
 * La bande RAMÈNE au message et n'offre le retrait qu'à qui a le droit
 * d'épingler — un bouton refusé après l'appui est un défaut, pas une garde.
 */

import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { PinnedMessageBanner } from "./PinnedMessageBanner"

afterEach(cleanup)

const EPINGLE = {
	messageId: "m-1",
	senderName: "Alice Durand",
	excerpt: "La consigne à garder.",
	hasAttachments: false,
}

function poser(props: Partial<Parameters<typeof PinnedMessageBanner>[0]> = {}) {
	const onJump = vi.fn()
	const onUnpin = vi.fn()
	const vue = renderWithEngine(
		<PinnedMessageBanner
			pinned={EPINGLE}
			canPin={false}
			onJump={onJump}
			onUnpin={onUnpin}
			{...props}
		/>,
	)
	return { vue, onJump, onUnpin }
}

describe("la bande d'épingle", () => {
	it("nomme l'auteur et l'extrait, et ramène au message au clic", () => {
		const { onJump } = poser()
		fireEvent.click(
			screen.getByLabelText(
				"Aller au message épinglé de Alice Durand : La consigne à garder.",
			),
		)
		expect(onJump).toHaveBeenCalledWith("m-1")
	})

	it("n'offre le retrait qu'au droit d'épingle", () => {
		const premier = poser()
		expect(screen.queryByLabelText("Désépingler le message")).toBeNull()
		premier.vue.unmount()

		poser({ canPin: true })
		expect(screen.getByLabelText("Désépingler le message")).toBeTruthy()
	})

	it("le retrait appelle onUnpin", () => {
		const { onUnpin } = poser({ canPin: true })
		fireEvent.click(screen.getByLabelText("Désépingler le message"))
		expect(onUnpin).toHaveBeenCalledOnce()
	})

	it("dit « Pièce jointe » quand le corps est une pièce sans texte", () => {
		poser({ pinned: { ...EPINGLE, excerpt: "", hasAttachments: true } })
		expect(screen.getByText("Pièce jointe")).toBeTruthy()
	})
})
