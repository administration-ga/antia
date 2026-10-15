// @vitest-environment jsdom
/**
 * Les adaptations de `use-chat-attachments` (le socle n'avait aucun test pour
 * ce module) : tailles mises en forme dans la langue courante, refus traduits,
 * bornes lues dans le contrat du moteur.
 */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ATTACHMENT_MAX_BYTES } from "@antia/social-contracts/attachments"

import { EngineTestWrapper } from "../../tests/engine-wrapper"
import { formatFileSize, MAX_ATTACHMENT_SIZE_BYTES, useChatAttachments } from "./use-chat-attachments"

/** `Intl` sépare nombre et unité par une espace insécable : on compare des espaces simples. */
const plain = (text: string) => text.replace(/\s/g, " ")

const MO = 1024 * 1024

function fileOf(name: string, type: string, size?: number): File {
	const file = new File(["contenu"], name, { type })
	if (size !== undefined) Object.defineProperty(file, "size", { value: size })
	return file
}

describe("formatFileSize — la taille se dit dans la langue courante", () => {
	it("en français : octets, kilo-octets, méga-octets, giga-octets", () => {
		expect(plain(formatFileSize(789, "fr"))).toBe("789 o")
		expect(plain(formatFileSize(12 * 1024, "fr"))).toBe("12 ko")
		expect(plain(formatFileSize(3.2 * MO, "fr"))).toBe("3,2 Mo")
		expect(plain(formatFileSize(25 * MO, "fr"))).toBe("25 Mo")
		expect(plain(formatFileSize(1024 * MO, "fr"))).toBe("1,0 Go")
	})

	it("en anglais : mêmes paliers, unités et séparateur décimal anglais", () => {
		expect(plain(formatFileSize(12 * 1024, "en"))).toBe("12 kB")
		expect(plain(formatFileSize(3.2 * MO, "en"))).toBe("3.2 MB")
		expect(plain(formatFileSize(1024 * MO, "en"))).toBe("1.0 GB")
	})
})

describe("useChatAttachments — bornes du serveur, refus traduits", () => {
	it("le plafond est celui du contrat du moteur", () => {
		expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(ATTACHMENT_MAX_BYTES)
	})

	it("un fichier trop lourd est refusé, avec la phrase traduite", () => {
		const onValidationError = vi.fn<(message: string) => void>()
		const { result } = renderHook(() => useChatAttachments({ onValidationError }), { wrapper: EngineTestWrapper })
		act(() => result.current.addFiles([fileOf("rapport.pdf", "application/pdf", 26 * MO)]))
		expect(result.current.attachments).toHaveLength(0)
		expect(plain(onValidationError.mock.calls[0]?.[0] ?? "")).toBe(
			"rapport.pdf dépasse la taille max autorisée (25 Mo).",
		)
	})

	it("un type hors liste blanche est refusé, avec la phrase traduite", () => {
		const onValidationError = vi.fn<(message: string) => void>()
		const { result } = renderHook(() => useChatAttachments({ onValidationError }), { wrapper: EngineTestWrapper })
		act(() => result.current.addFiles([fileOf("outil.exe", "application/x-msdownload")]))
		expect(result.current.attachments).toHaveLength(0)
		expect(onValidationError).toHaveBeenCalledWith("outil.exe : type non autorisé (application/x-msdownload).")
	})

	it("le type est jugé comme le serveur le juge : paramètres et alias JPEG admis", () => {
		const onValidationError = vi.fn<(message: string) => void>()
		const { result } = renderHook(() => useChatAttachments({ onValidationError }), { wrapper: EngineTestWrapper })
		act(() =>
			result.current.addFiles([fileOf("vocal.webm", "audio/webm;codecs=opus"), fileOf("photo.jpg", "image/jpg")]),
		)
		expect(onValidationError).not.toHaveBeenCalled()
		expect(result.current.attachments.map((a) => a.file.name)).toEqual(["vocal.webm", "photo.jpg"])

		const first = result.current.attachments[0]
		act(() => result.current.remove(first?.localId ?? ""))
		expect(result.current.attachments.map((a) => a.file.name)).toEqual(["photo.jpg"])

		let consumed: File[] = []
		act(() => {
			consumed = result.current.consumeForUpload()
		})
		expect(consumed.map((f) => f.name)).toEqual(["photo.jpg"])
		expect(result.current.attachments).toHaveLength(0)
	})
})
