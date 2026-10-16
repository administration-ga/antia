// Test du moteur (sans équivalent au socle, qui ne montait aucun composant) : le lecteur plein écran — plateau du réseau courant à un instant arrondi, sortie par la route d'accueil de l'application, entrée par `?auteur=`, mon handle servi par `myActive` seulement quand mon profil est publié, aucun direct tant que le lot `live` n'est pas branché.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"

type QueryCall = { reference: string; args: unknown }

const mocks = vi.hoisted(() => ({
	calls: [] as QueryCall[],
	tray: undefined as { groups: unknown[]; truncated: boolean } | undefined,
	me: null as null | { handle?: string; published: boolean },
	live: { items: [] as unknown[] },
}))

vi.mock("@antia/api/engine", () => ({
	api: {
		modules: {
			stories: {
				stories: {
					tray: "tray",
					myActive: "myActive",
					listByAuthor: "listByAuthor",
					markSeen: "markSeen",
					remove: "remove",
					viewers: "viewers",
					publish: "publish",
				},
			},
			live: { sessions: { listLive: "listLive" } },
			people: { persons: { getMyPerson: "getMyPerson" } },
			media: { media: { generateUploadUrl: "generateUploadUrl" } },
		},
	},
}))

vi.mock("@antia/api/hooks", () => ({
	useAuthenticatedConvexQuery: (reference: string, args: unknown) => {
		mocks.calls.push({ reference, args })
		if (args === "skip") return { data: undefined, isError: false, refetch: vi.fn() }
		if (reference === "tray") return { data: mocks.tray, isError: false, refetch: vi.fn() }
		if (reference === "listLive") return { data: mocks.live, isError: false, refetch: vi.fn() }
		if (reference === "getMyPerson") return { data: mocks.me, isError: false, refetch: vi.fn() }
		// Les séries : en vol — l'écran dit « Chargement… », ce test ne lit que leurs arguments.
		return { data: undefined, isError: false, refetch: vi.fn() }
	},
	useAuthenticatedPaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))

vi.mock("convex/react", () => ({ useMutation: () => vi.fn(() => Promise.resolve()) }))

// Le téléphone : la pile est rendue en place, sans portail.
vi.mock("@antia/ui/overlay", () => ({
	useIsReseauMobile: () => true,
	ImmersiveOverlay: (props: { open: boolean; label: string; children: ReactNode }) =>
		props.open ? (
			<div role="dialog" aria-label={props.label}>
				{props.children}
			</div>
		) : null,
}))

// Le pager : seul l'écran courant, monté ACTIF — ses gestes ont leurs propres tests.
vi.mock("../../shell/mobile/VerticalPager", () => ({
	VerticalPager: <T,>(props: {
		items: readonly T[]
		index: number
		ariaLabel: string
		renderItem: (item: T, state: { active: boolean; index: number }) => ReactNode
	}) => {
		const item = props.items[props.index]
		return (
			<div role="region" aria-label={props.ariaLabel}>
				{item === undefined ? null : props.renderItem(item, { active: true, index: props.index })}
			</div>
		)
	},
}))

import { StoriesViewerPage } from "./StoriesViewerPage"
import { STORY_QUERY_STEP_MS } from "./stories-tray"

const NOW = 4_000 * STORY_QUERY_STEP_MS + 123_456

function group(handle: string) {
	return {
		author: { personId: `person-${handle}`, handle, displayName: `Nom ${handle}`, headline: null, avatarUrl: null, source: "published" },
		storyCount: 1,
		unseenCount: 1,
		latestPublishedAt: NOW - 60_000,
		cover: { url: `${handle}.jpg`, kind: "image" },
	}
}

const argsOf = (reference: string) => mocks.calls.filter((call) => call.reference === reference && call.args !== "skip").map((call) => call.args)

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(NOW)
	mocks.calls = []
	mocks.tray = undefined
	mocks.me = null
	mocks.live = { items: [] }
})

afterEach(() => {
	vi.useRealTimers()
})

describe("StoriesViewerPage", () => {
  it("montre les directs avant les actus et n'ouvre leur salle que par le geste explicite", () => {
    mocks.tray = { groups: [], truncated: false }
    mocks.live.items = [{ sessionId: "live-test", title: "Direct du réseau", audience: "followers", startedAt: NOW, host: { displayName: "Awa", handle: "awa", avatarUrl: null }, counters: { viewerGrantCount: 0, comments: 0, reactions: 0 }, isHost: false }]
    const router = memoryRouter({ pathname: TEST_ROUTES.stories() })
    renderWithEngine(<StoriesViewerPage />, { router: router.implementation })
    expect(screen.getByRole("heading", { name: "Direct du réseau" })).toBeTruthy()
    expect(router.calls).not.toContainEqual({ method: "push", href: TEST_ROUTES.conference("live-test") })
    fireEvent.click(screen.getByRole("button", { name: /Rejoindre/ }))
    expect(router.calls).toContainEqual({ method: "push", href: TEST_ROUTES.conference("live-test") })
  })

	it("demande le plateau du réseau courant à l'instant ARRONDI au pas", () => {
		renderWithEngine(<StoriesViewerPage />)
		expect(argsOf("tray").at(-1)).toEqual({
			networkId: TEST_NETWORK_ID,
			now: NOW - (NOW % STORY_QUERY_STEP_MS),
		})
		expect(argsOf("listLive").at(-1)).toEqual({ networkId: TEST_NETWORK_ID, limit: 20 })
		expect(screen.getByText("Chargement…")).toBeInTheDocument()
	})

	it("sort vers l'accueil du réseau, par sa route, sur un lien direct", () => {
		mocks.tray = { groups: [], truncated: false }
		const router = memoryRouter({ pathname: TEST_ROUTES.stories() })
		renderWithEngine(<StoriesViewerPage />, { router: router.implementation })

		expect(screen.getByText("Aucune actu pour l'instant")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Revenir au fil" }))
		expect(router.calls).toContainEqual({ method: "push", href: TEST_ROUTES.home() })
	})

	it("entre sur l'auteur demandé et nomme l'écran courant", () => {
		mocks.tray = { groups: [group("marie"), group("paul")], truncated: false }
		const router = memoryRouter({ pathname: TEST_ROUTES.stories(), search: "auteur=paul" })
		renderWithEngine(<StoriesViewerPage />, { router: router.implementation })

		expect(screen.getByRole("region", { name: "Actus et conférences — Actus de Nom paul" })).toBeInTheDocument()
		expect(argsOf("listByAuthor").at(-1)).toEqual({
			networkId: TEST_NETWORK_ID,
			handle: "paul",
			now: NOW - (NOW % STORY_QUERY_STEP_MS),
		})
	})

	it("ne sert MES stories par `myActive` que si mon profil est publié", () => {
		mocks.tray = { groups: [group("paul")], truncated: false }
		mocks.me = { handle: "paul", published: true }
		renderWithEngine(<StoriesViewerPage />)
		expect(argsOf("myActive").at(-1)).toEqual({
			networkId: TEST_NETWORK_ID,
			now: NOW - (NOW % STORY_QUERY_STEP_MS),
		})
		expect(argsOf("listByAuthor")).toEqual([])
	})

	it("traite un handle choisi mais non publié comme aucun handle", () => {
		mocks.tray = { groups: [group("paul")], truncated: false }
		mocks.me = { handle: "paul", published: false }
		renderWithEngine(<StoriesViewerPage />)
		expect(argsOf("myActive")).toEqual([])
		expect(argsOf("listByAuthor").at(-1)).toMatchObject({ handle: "paul" })
	})
})
