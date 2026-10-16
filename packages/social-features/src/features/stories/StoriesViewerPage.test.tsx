// Test du moteur (sans équivalent au socle, qui ne montait aucun composant) : le lecteur plein écran — plateau du réseau courant à un instant arrondi, sortie par la route d'accueil de l'application, entrée par `?auteur=`, mon handle servi par `myActive` seulement quand mon profil est publié, aucun direct tant que le lot `live` n'est pas branché.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { createAppI18n } from "../../i18n"

type QueryCall = { reference: string; args: unknown }

const mocks = vi.hoisted(() => ({
	calls: [] as QueryCall[],
	tray: undefined as { groups: unknown[]; truncated: boolean } | undefined,
	me: null as null | { handle?: string; published: boolean },
	live: { items: [] as unknown[] },
	composer: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
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

vi.mock("@antsia/api/hooks", () => ({
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

// La sonde garde un brouillon local : la révocation doit réellement démonter
// la feuille, pas seulement cacher son dialogue et laisser ses fichiers vivre.
vi.mock("./StoryCreateSheet", () => ({
	StoryCreateSheet: (props: { open: boolean; onClose: () => void }) => {
		const { t } = useTranslation("stories")
		const [draft, setDraft] = useState("")
		mocks.composer({ open: props.open })
		return props.open ? (
			<div role="dialog" aria-label={t("storyCreateSheet.title")}>
				<input aria-label="Repère du brouillon" value={draft} onChange={(event) => setDraft(event.target.value)} />
				<button type="button" onClick={props.onClose}>{t("storyCreateSheet.close")}</button>
			</div>
		) : null
	},
}))

// Le téléphone : la pile est rendue en place, sans portail.
vi.mock("@antsia/ui/overlay", () => ({
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
	mocks.composer.mockClear()
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

	it.each([
		{ locale: "fr" as const, loading: "Chargement…", create: "Publier une actu" },
		{ locale: "en" as const, loading: "Loading…", create: "Post a story" },
	])("lit l'auteur sans monter le composeur malgré l'adresse nouvelle ($locale)", ({ locale, loading, create }) => {
		mocks.tray = { groups: [group("paul")], truncated: false }
		const router = memoryRouter({ pathname: `${TEST_ROUTES.stories()}/nouvelle`, search: "auteur=paul" })
		const i18n = createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "social" })
		renderWithEngine(
			<I18nextProvider i18n={i18n}><StoriesViewerPage canCreate={false} openCreate /></I18nextProvider>,
			{ router: router.implementation },
		)

		expect(argsOf("listByAuthor").at(-1)).toMatchObject({ networkId: TEST_NETWORK_ID, handle: "paul" })
		expect(screen.getByText(loading)).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: create })).not.toBeInTheDocument()
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(mocks.composer).not.toHaveBeenCalled()
	})

	it.each([
		{ locale: "fr" as const, empty: "Aucune actu pour l'instant", create: "Publier une actu", back: "Revenir au fil" },
		{ locale: "en" as const, empty: "No stories for now", create: "Post a story", back: "Back to the feed" },
	])("rend l'état vide sans invitation à publier quand la création est refusée ($locale)", ({ locale, empty, create, back }) => {
		mocks.tray = { groups: [], truncated: false }
		const i18n = createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "social" })
		renderWithEngine(
			<I18nextProvider i18n={i18n}><StoriesViewerPage canCreate={false} /></I18nextProvider>,
		)

		expect(screen.getByText(empty)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: back })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: create })).not.toBeInTheDocument()
		expect(screen.queryByText(/Publiez la première|Post the first one/)).not.toBeInTheDocument()
		expect(mocks.composer).not.toHaveBeenCalled()
	})

	it("conserve l'ouverture explicite du composeur lorsque le droit n'est pas précisé", () => {
		mocks.tray = { groups: [], truncated: false }
		renderWithEngine(<StoriesViewerPage openCreate />)
		expect(screen.getByRole("dialog", { name: "Publier une actu" })).toBeInTheDocument()
	})

	it.each([
		{ locale: "fr" as const, create: "Publier une actu" },
		{ locale: "en" as const, create: "Post a story" },
	])("démonte le composeur à la révocation et repart avec un brouillon neuf après réautorisation ($locale)", ({ locale, create }) => {
		mocks.tray = { groups: [], truncated: false }
		const i18n = createAppI18n({ locale, appResources: { fr: {}, en: {} }, defaultNS: "social" })
		const viewer = (canCreate: boolean) => <I18nextProvider i18n={i18n}><StoriesViewerPage canCreate={canCreate} openCreate /></I18nextProvider>
		const view = renderWithEngine(viewer(true))
		fireEvent.change(screen.getByRole("textbox", { name: "Repère du brouillon" }), { target: { value: "ancien fichier" } })

		mocks.composer.mockClear()
		view.rerender(viewer(false))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(mocks.composer).not.toHaveBeenCalled()

		view.rerender(viewer(true))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: create }))
		expect(screen.getByRole("dialog", { name: create })).toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "Repère du brouillon" })).toHaveValue("")
	})
})
