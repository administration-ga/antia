// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { MessageComposer, type ComposerMediaDraft } from "./MessageComposer"
import { newMediaItem } from "./messagerie-media-draft"

vi.mock("./VoiceRecorderButton", () => ({ VoiceRecorderButton: () => null }))

function deferred() {
	let resolve!: () => void
	let reject!: (error: unknown) => void
	const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
	return { promise, resolve, reject }
}

function draft(): ComposerMediaDraft {
	const piece = newMediaItem({ file: { name: "photo.png", size: 1024, type: "image/png" } as File, uploaded: { storageId: "already-uploaded" } })
	return { items: [piece], fileOf: () => null, add: vi.fn(), remove: vi.fn(), markUploaded: vi.fn(), markFailed: vi.fn(), clear: vi.fn() }
}

const base = { value: "Bonjour", onChange: vi.fn(), placeholder: "Écrire", ariaLabel: "Message à Nadia", generateUploadUrl: async () => "unused", allowVoice: false }

describe("Fiabilité du composeur P05", () => {
	it("verrouille un double appui avant le prochain rendu", async () => {
		const response = deferred()
		const onSend = vi.fn(() => response.promise)
		renderWithEngine(<MessageComposer {...base} onSend={onSend} />)
		const field = screen.getByRole("textbox", { name: "Message à Nadia" })
		act(() => {
			fireEvent.keyDown(field, { key: "Enter" })
			fireEvent.keyDown(field, { key: "Enter" })
		})
		await vi.waitFor(() => expect(onSend).toHaveBeenCalledOnce())
		await act(async () => { response.resolve(); await response.promise })
	})

	it("un refus conserve les pièces déjà montées et le texte", async () => {
		const mediaDraft = draft()
		const onError = vi.fn()
		renderWithEngine(<MessageComposer {...base} mediaDraft={mediaDraft} onSend={async () => { throw new Error("private server trace") }} onError={onError} />)
		fireEvent.click(screen.getByRole("button", { name: "Envoyer" }))
		await vi.waitFor(() => expect(onError).toHaveBeenCalled())
		expect(mediaDraft.clear).not.toHaveBeenCalled()
		expect(screen.getByRole("textbox", { name: "Message à Nadia" })).toHaveValue("Bonjour")
		expect(screen.getByText("photo.png")).toBeInTheDocument()
		expect(onError.mock.calls.flat().join(" ")).not.toContain("private server trace")
	})

	it("nettoie les pièces avant d'autoriser la promotion du premier fil", async () => {
		const mediaDraft = draft()
		const order: string[] = []
		mediaDraft.clear = vi.fn(() => { order.push("clear") })
		const onSent = vi.fn(() => { order.push("navigate") })
		renderWithEngine(<MessageComposer {...base} mediaDraft={mediaDraft} onSend={async () => undefined} onSent={onSent} />)
		fireEvent.click(screen.getByRole("button", { name: "Envoyer" }))
		await vi.waitFor(() => expect(onSent).toHaveBeenCalledOnce())
		expect(order).toEqual(["clear", "navigate"])
	})

	it("une réponse tardive du composeur remplacé ne nettoie ni ne réinjecte de pièces ou d'erreur", async () => {
		const response = deferred()
		const mediaDraft = draft()
		const onError = vi.fn()
		const onSent = vi.fn()
		const onSend = vi.fn(() => response.promise)
		const view = renderWithEngine(<MessageComposer {...base} contextKey="old" mediaDraft={mediaDraft} onSend={onSend} onSent={onSent} onError={onError} />)
		fireEvent.click(screen.getByRole("button", { name: "Envoyer" }))
		await vi.waitFor(() => expect(onSend).toHaveBeenCalledOnce())
		view.rerender(<MessageComposer {...base} contextKey="new" onSend={async () => undefined} onError={onError} />)
		await act(async () => { response.reject(new Error("late")); await response.promise.catch(() => undefined) })
		expect(mediaDraft.clear).not.toHaveBeenCalled()
		expect(mediaDraft.add).not.toHaveBeenCalled()
		expect(onError).not.toHaveBeenCalled()
		expect(onSent).not.toHaveBeenCalled()
	})
})
