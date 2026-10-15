// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessagerieGroupeInvite.test.tsx @ ad2e7fdc2 — adaptations : fonctions du moteur moquées (`groups.invites.previewGroupInvite`, `joinGroupViaInviteLink`), appelées avec le réseau courant ; rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n français, réseau de test) ; « l'agent » devient « la personne » ; cas neuf : un refus du serveur à l'entrée se dit par sa phrase traduite, sans ouvrir le groupe.
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

const TOKEN = "jeton-invitation-groupe-test"

const mocks = vi.hoisted(() => ({
	query: vi.fn(),
	mutation: vi.fn(),
	mutateAsync: vi.fn(),
	preview: {
		data: undefined as
			| {
					threadId: string
					title: string
					avatarUrl: string | null
					memberCount: number
					alreadyMember: boolean
			  }
			| undefined,
		isLoading: false,
		isError: false,
	},
}))

vi.mock("@antia/api/engine", () => ({
	api: {
		modules: {
			groups: {
				invites: {
					previewGroupInvite: "previewGroupInvite",
					joinGroupViaInviteLink: "joinGroupViaInviteLink",
				},
			},
		},
	},
}))

vi.mock("@antia/api/hooks", () => ({
	useAuthenticatedConvexQuery: (query: string, args: unknown) => {
		mocks.query(query, args)
		return mocks.preview
	},
	useConvexMutationQuery: (mutation: string) => {
		mocks.mutation(mutation)
		return {
			isPending: false,
			mutateAsync: mocks.mutateAsync,
		}
	},
}))

vi.mock("./GroupeAvatar", () => ({
	GroupeAvatar: ({ title }: { title: string }) => (
		<span aria-label={`Avatar de ${title}`} />
	),
}))

import { MessagerieGroupeInvite } from "./MessagerieGroupeInvite"

beforeEach(() => {
	mocks.query.mockReset()
	mocks.mutation.mockReset()
	mocks.mutateAsync.mockReset()
	mocks.mutateAsync.mockResolvedValue({ threadId: "groupe-42", joined: true })
	mocks.preview.data = undefined
	mocks.preview.isLoading = false
	mocks.preview.isError = false
})

afterEach(cleanup)

describe("MessagerieGroupeInvite", () => {
	it("prévisualise puis rejoint le groupe avant d'ouvrir son fil", async () => {
		mocks.preview.data = {
			threadId: "groupe-42",
			title: "Équipe transformation",
			avatarUrl: null,
			memberCount: 6,
			alreadyMember: false,
		}
		const onJoined = vi.fn()

		renderWithEngine(
			<MessagerieGroupeInvite
				token={TOKEN}
				onClose={vi.fn()}
				onJoined={onJoined}
			/>,
		)

		expect(mocks.query).toHaveBeenCalledWith("previewGroupInvite", {
			networkId: TEST_NETWORK_ID,
			token: TOKEN,
		})
		expect(screen.getByText("Équipe transformation")).toBeTruthy()
		expect(screen.getByText("6 membres")).toBeTruthy()
		fireEvent.click(screen.getByRole("button", { name: "Rejoindre le groupe" }))

		expect(mocks.mutateAsync).toHaveBeenCalledWith({
			networkId: TEST_NETWORK_ID,
			token: TOKEN,
		})
		await waitFor(() => expect(onJoined).toHaveBeenCalledWith("groupe-42"))
	})

	it("ouvre directement un groupe dont la personne est déjà membre", () => {
		mocks.preview.data = {
			threadId: "groupe-7",
			title: "Comité qualité",
			avatarUrl: null,
			memberCount: 3,
			alreadyMember: true,
		}
		const onJoined = vi.fn()

		renderWithEngine(
			<MessagerieGroupeInvite
				token={TOKEN}
				onClose={vi.fn()}
				onJoined={onJoined}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "Ouvrir le groupe" }))
		expect(onJoined).toHaveBeenCalledWith("groupe-7")
		expect(mocks.mutateAsync).not.toHaveBeenCalled()
	})

	it("n'interroge pas le serveur avec un jeton manifestement invalide", () => {
		const onClose = vi.fn()
		renderWithEngine(
			<MessagerieGroupeInvite
				token={null}
				onClose={onClose}
				onJoined={vi.fn()}
			/>,
		)

		expect(mocks.query).toHaveBeenCalledWith("previewGroupInvite", "skip")
		expect(screen.getByRole("alert").textContent).toContain(
			"Invitation indisponible",
		)
		fireEvent.click(screen.getByRole("button", { name: "Retour aux messages" }))
		expect(onClose).toHaveBeenCalledOnce()
	})

	it("annonce explicitement le chargement et l'échec de lecture", () => {
		mocks.preview.isLoading = true
		const props = {
			token: TOKEN,
			onClose: vi.fn(),
			onJoined: vi.fn(),
		}
		const { rerender } = renderWithEngine(<MessagerieGroupeInvite {...props} />)
		expect(screen.getByRole("status").textContent).toContain(
			"Vérification de l'invitation",
		)

		mocks.preview.isLoading = false
		mocks.preview.isError = true
		rerender(<MessagerieGroupeInvite {...props} />)
		expect(screen.getByRole("alert").textContent).toContain(
			"Invitation indisponible",
		)
	})

	it("dit le refus du serveur à l'entrée, sans ouvrir le groupe", async () => {
		mocks.preview.data = {
			threadId: "groupe-9",
			title: "Atelier",
			avatarUrl: null,
			memberCount: 256,
			alreadyMember: false,
		}
		mocks.mutateAsync.mockRejectedValue(
			new ConvexError({ code: "invalidArgument", rule: "GROUP_FULL", params: { max: 256 } }),
		)
		const onJoined = vi.fn()
		renderWithEngine(
			<MessagerieGroupeInvite token={TOKEN} onClose={vi.fn()} onJoined={onJoined} />,
		)

		fireEvent.click(screen.getByRole("button", { name: "Rejoindre le groupe" }))

		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe(
				"Ce groupe a atteint son plafond de 256 personnes.",
			),
		)
		expect(onJoined).not.toHaveBeenCalled()
	})
})
