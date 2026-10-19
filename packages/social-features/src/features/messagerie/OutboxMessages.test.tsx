// @vitest-environment jsdom
import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { OutboxMessages } from "./OutboxMessages"
import { outboxStore, type OutboxEntry } from "./messagerie-outbox"

const pending: OutboxEntry = { key: "intent", owner: "reader", conversation: "chat:one", text: "Bonjour", attachmentCount: 1, at: 1, messageId: null }
afterEach(() => outboxStore.__resetForTests())

describe("Trace visible des envois", () => {
	it("affiche l'envoi et ses pièces, puis uniquement l'admission prouvée", () => {
		const view = renderWithEngine(<OutboxMessages entries={[pending]} />)
		expect(screen.getByText("Bonjour")).toBeInTheDocument()
		expect(screen.getByText("1 pièce jointe")).toBeInTheDocument()
		expect(screen.getByRole("status")).toHaveTextContent("Envoi en cours")
		view.rerender(<OutboxMessages entries={[{ ...pending, messageId: "real-message" }]} />)
		expect(screen.getByRole("status")).toHaveTextContent("Envoyé")
		expect(screen.queryByText(/Livré|^Lu$/)).toBeNull()
		expect(screen.queryByRole("button")).toBeNull()
	})

	it("ne retire la trace que pour le vrai identifiant dans la bonne boîte", () => {
		outboxStore.add(pending)
		outboxStore.acknowledge("reader", "chat:one", ["real-message"])
		expect(outboxStore.has("intent")).toBe(true)
		outboxStore.admit("intent", "real-message")
		outboxStore.acknowledge("other-reader", "chat:one", ["real-message"])
		expect(outboxStore.has("intent")).toBe(true)
		outboxStore.acknowledge("reader", "chat:one", ["some-other-message"])
		expect(outboxStore.has("intent")).toBe(true)
		outboxStore.acknowledge("reader", "chat:one", ["real-message"])
		expect(outboxStore.has("intent")).toBe(false)
	})
})
