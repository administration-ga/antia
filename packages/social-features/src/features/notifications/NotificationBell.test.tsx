// Dupliqué de socle/packages/agent-features/src/features/notifications/NotificationBell.test.tsx @ ad2e7fdc2 — adaptations : RÉÉCRIT sur la cloche du moteur — montée dans l'enveloppe du moteur (`renderWithEngine` : i18n française, réseau et adresses de test, routeur en mémoire), fonctions `notifications.bell.*` et `graph.connections.*` simulées par référence, VRAIE carte flottante (`ImmersiveOverlay` et `useModalA11y` d'`@antia/ui`, plus de simulacre du verrou de défilement ni du viewport) ; une seule source : les cas « somme des deux sources », « une source à zéro » et « l'autre décompte charge encore » deviennent le décompte, son accord et le réseau passé au serveur ; le plafond se teste avec la LACUNE du moteur (`capped`) et 99 exact sans elle ; « deux onglets » devient « plus d'onglets, la liste du réseau » ; « charte de l'hôte relue » devient « charte de `<html>`, jamais celle d'un nœud hôte » ; mode personnel et charte de poste retirés ; les autres cas portés (focus, « Tout voir », Échap, une seule carte pour deux cloches, demande antérieure au montage).
// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
	/** Le décompte de la cloche (`notifications.bell.unreadCount`), lacune comprise. */
	unread: { count: 0, capped: false } as { count: number; capped: boolean } | undefined,
	results: [] as unknown[],
	queries: [] as { reference: string; args: unknown }[],
}))

vi.mock("@antia/api/engine", () => ({
	api: {
		modules: {
			notifications: {
				bell: {
					paginateNotifications: "paginateNotifications",
					unreadCount: "unreadCount",
					markRead: "markRead",
					markAllRead: "markAllRead",
				},
			},
			graph: {
				connections: {
					respondToConnection: "respondToConnection",
					pendingState: "pendingState",
				},
			},
		},
	},
}))

vi.mock("@antia/api/hooks", () => ({
	useAuthenticatedConvexQuery: (reference: string, args: unknown) => {
		mocks.queries.push({ reference, args })
		return { data: mocks.unread, isLoading: false, isError: false }
	},
	useAuthenticatedPaginatedQuery: () => ({
		results: mocks.results,
		status: "Exhausted",
		loadMore: vi.fn(),
		isLoading: false,
	}),
}))

vi.mock("convex/react", () => ({
	useMutation: () => vi.fn().mockResolvedValue(undefined),
	useConvex: () => ({ query: vi.fn().mockResolvedValue({}) }),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { NotificationBell } from "./NotificationBell"
import {
	openNotificationCenter,
	resetNotificationCenterForTests,
} from "./notification-center-store"

/** « Tout voir » : la page réseau qui ouvre la cloche — composée, jamais écrite. */
const FULL_HREF = `${TEST_ROUTES.home()}?notifications=1`

beforeEach(() => {
	mocks.unread = { count: 0, capped: false }
	mocks.results = []
	mocks.queries = []
	resetNotificationCenterForTests()
})

afterEach(() => {
	resetNotificationCenterForTests()
	document.documentElement.removeAttribute("data-charte")
})

function bell() {
	return screen.getByRole("button", { name: /notification/i })
}

describe("NotificationBell — la pastille dit le décompte de la cloche du réseau", () => {
	it("affiche le décompte et le dit en toutes lettres", () => {
		mocks.unread = { count: 3, capped: false }
		renderWithEngine(<NotificationBell />)

		const trigger = screen.getByRole("button", {
			name: "3 notifications non lues",
		})
		expect(trigger.textContent).toBe("3")
		expect(trigger.getAttribute("aria-expanded")).toBe("false")
	})

	it("accorde son nom au singulier", () => {
		mocks.unread = { count: 1, capped: false }
		renderWithEngine(<NotificationBell />)

		expect(
			screen.getByRole("button", { name: "1 notification non lue" }).textContent,
		).toBe("1")
	})

	it("demande le décompte du réseau COURANT", () => {
		renderWithEngine(<NotificationBell />)

		expect(mocks.queries).toContainEqual({
			reference: "unreadCount",
			args: { networkId: TEST_NETWORK_ID },
		})
	})

	it("ne porte AUCUNE pastille à zéro, et garde son libellé neutre", () => {
		renderWithEngine(<NotificationBell />)

		const trigger = screen.getByRole("button", {
			name: "Voir les notifications",
		})
		expect(trigger.textContent).toBe("")
	})

	it("ni pendant le chargement du décompte", () => {
		mocks.unread = undefined
		renderWithEngine(<NotificationBell />)

		const trigger = screen.getByRole("button", {
			name: "Voir les notifications",
		})
		expect(trigger.textContent).toBe("")
	})

	it("dit « 99+ » et « plus de 99 » quand le serveur signale une LACUNE", () => {
		mocks.unread = { count: 99, capped: true }
		renderWithEngine(<NotificationBell variant="reseau" />)

		const trigger = screen.getByRole("button", {
			name: "Plus de 99 notifications non lues",
		})
		expect(trigger.textContent).toBe("99+")
	})

	it("affiche 99 tel quel sans lacune : c'est un nombre exact", () => {
		mocks.unread = { count: 99, capped: false }
		renderWithEngine(<NotificationBell />)

		expect(bell().textContent).toBe("99")
	})
})

describe("NotificationBell — la cloche ouvre une carte, elle ne navigue pas", () => {
	it("ouvre la carte et y place le focus, sans quitter la page", () => {
		renderWithEngine(<NotificationBell />)
		const trigger = bell()
		trigger.focus()

		fireEvent.click(trigger)

		const dialog = screen.getByRole("dialog", { name: "Notifications" })
		expect(trigger.getAttribute("aria-expanded")).toBe("true")
		expect(dialog.contains(document.activeElement)).toBe(true)
		// La page dessous n'est pas naviguée : la cloche n'est pas un lien.
		expect(screen.queryByRole("link", { name: /notification/i })).toBeNull()
	})

	it("la carte n'a plus d'onglets : la liste du réseau, et « Tout marquer lu » quand il y a du neuf", () => {
		mocks.unread = { count: 2, capped: false }
		renderWithEngine(<NotificationBell />)
		fireEvent.click(bell())

		const dialog = screen.getByRole("dialog", { name: "Notifications" })
		expect(within(dialog).queryByRole("tablist")).toBeNull()
		expect(within(dialog).queryByRole("tab")).toBeNull()
		expect(
			within(dialog).getByRole("button", { name: "Tout marquer lu" }),
		).toBeInTheDocument()
		expect(
			within(dialog).getByText(/réactions, commentaires, invitations/),
		).toBeInTheDocument()
	})

	it("rend « Tout voir » à la destination fournie par l'hôte, et rien sans elle", () => {
		const { unmount } = renderWithEngine(
			<NotificationBell fullHref={FULL_HREF} />,
		)
		fireEvent.click(bell())
		expect(
			screen.getByRole("link", { name: "Tout voir" }).getAttribute("href"),
		).toBe(FULL_HREF)

		unmount()
		resetNotificationCenterForTests()

		renderWithEngine(<NotificationBell />)
		fireEvent.click(bell())
		expect(screen.queryByRole("link", { name: "Tout voir" })).toBeNull()
	})

	it("Échap ferme la carte et SEULEMENT elle, en rendant le focus à la cloche", () => {
		renderWithEngine(<NotificationBell />)
		const trigger = bell()
		trigger.focus()
		fireEvent.click(trigger)
		expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy()

		fireEvent.keyDown(document, { key: "Escape" })

		expect(screen.queryByRole("dialog")).toBeNull()
		expect(bell().getAttribute("aria-expanded")).toBe("false")
		expect(document.activeElement).toBe(bell())
	})

	it("la carte porte la charte de l'application (<html>), jamais celle d'un nœud hôte", () => {
		// La carte sort du nœud de l'hôte (portail) : elle redéclare la charte
		// du RÉSEAU, lue sur `<html>`, et ne relit plus le déclencheur.
		document.documentElement.setAttribute("data-charte", "antia")
		renderWithEngine(
			<div data-charte="autre-charte">
				<NotificationBell />
			</div>,
		)
		fireEvent.click(bell())

		expect(
			screen
				.getByRole("dialog", { name: "Notifications" })
				.getAttribute("data-charte"),
		).toBe("antia")
	})

	it("n'ouvre QU'UNE carte quand deux cloches sont montées", () => {
		// Au téléphone, la barre de la coque est masquée en CSS mais reste
		// MONTÉE : deux cartes seraient deux dialogues frères de <body>, et
		// `useModalA11y` inerte les frères du sien — chacune éteindrait l'autre.
		renderWithEngine(
			<>
				<NotificationBell fullHref={FULL_HREF} />
				<NotificationBell variant="reseau" />
			</>,
		)
		const triggers = screen.getAllByRole("button", { name: /notification/i })
		expect(triggers).toHaveLength(2)

		fireEvent.click(triggers[0] as HTMLElement)

		expect(screen.getAllByRole("dialog")).toHaveLength(1)
		// La DERNIÈRE cloche montée est l'hôtesse — la plus intérieure, celle
		// qu'on voit : sa carte n'a donc pas de lien « Tout voir ».
		expect(screen.queryByRole("link", { name: "Tout voir" })).toBeNull()
	})

	it("honore une demande d'ouverture faite AVANT son montage", () => {
		// L'ancien lien `?tab=activite` demande l'ouverture depuis la page ; la
		// cloche vit ailleurs dans la coque et peut se monter après.
		openNotificationCenter()
		renderWithEngine(<NotificationBell />)

		expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy()
		expect(bell().getAttribute("aria-expanded")).toBe("true")
	})
})
