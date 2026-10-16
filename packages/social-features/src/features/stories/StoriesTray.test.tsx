// Test du moteur (sans équivalent au socle, qui ne montait aucun composant) : la barre de stories branchée sur `stories.stories.tray` — réseau courant et instant ARRONDI passés au serveur, plateau du pas précédent gardé pendant le réabonnement, libellés traduits, auteur sans nom.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

type TrayArgs = { networkId: string; now: number } | "skip"
type TrayGroupFixture = {
	author: { personId: string; handle: string | null; displayName: string | null; headline: null; avatarUrl: string | null; source: "published" | "unknown" }
	storyCount: number
	unseenCount: number
	latestPublishedAt: number
	cover: { url: string; kind: "image" | "video" }
}

const mocks = vi.hoisted(() => ({
	calls: [] as TrayArgs[],
	/** La réponse du serveur, par instant demandé (`undefined` = en vol). */
	byInstant: new Map<number, { groups: unknown[]; truncated: boolean }>(),
}))

vi.mock("@antsia/api/engine", () => ({
	api: { modules: { stories: { stories: { tray: "tray" } } } },
}))

vi.mock("@antsia/api/hooks", () => ({
	useAuthenticatedConvexQuery: (_reference: string, args: TrayArgs) => {
		mocks.calls.push(args)
		return {
			data: args === "skip" ? undefined : mocks.byInstant.get(args.now),
			isError: false,
		}
	},
}))

import { StoriesTray } from "./StoriesTray"
import { STORY_QUERY_STEP_MS } from "./stories-tray"

const STEP = STORY_QUERY_STEP_MS
const BASE = 4_000 * STEP

function group(handle: string | null, overrides: Partial<TrayGroupFixture> = {}): TrayGroupFixture {
	return {
		author: {
			personId: `person-${handle ?? "anonyme"}`,
			handle,
			displayName: handle === null ? null : `Nom ${handle}`,
			headline: null,
			avatarUrl: null,
			source: handle === null ? "unknown" : "published",
		},
		storyCount: 1,
		unseenCount: 0,
		latestPublishedAt: BASE - 60 * 60_000,
		cover: { url: `${handle ?? "x"}.jpg`, kind: "image" },
		...overrides,
	}
}

function renderTray(now: number, onOpen = vi.fn(), onCreate = vi.fn()) {
	return renderWithEngine(
		<StoriesTray myHandle="moi" now={now} onOpen={onOpen} onCreate={onCreate} />,
	)
}

beforeEach(() => {
	mocks.calls = []
	mocks.byInstant = new Map()
})

describe("StoriesTray — branchement sur le plateau du moteur", () => {
	it("passe le réseau courant et l'instant ARRONDI au pas, jamais l'horloge brute", () => {
		mocks.byInstant.set(BASE, { groups: [], truncated: false })
		renderTray(BASE + 123_456)
		expect(mocks.calls.at(-1)).toEqual({ networkId: TEST_NETWORK_ID, now: BASE })
	})

	it("ne rend rien tant que le premier plateau n'est pas arrivé", () => {
		const { container } = renderTray(BASE)
		expect(container.querySelector(".st-tray")).toBeNull()
	})

	it("rend la tuile de création puis les vignettes, nommées pour un lecteur d'écran", () => {
		mocks.byInstant.set(BASE, {
			groups: [group("marie", { unseenCount: 1 }), group("moi", { storyCount: 2 })],
			truncated: false,
		})
		const onOpen = vi.fn()
		const onCreate = vi.fn()
		renderTray(BASE, onOpen, onCreate)

		const tiles = screen.getAllByRole("button")
		expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
			"Publier une actu",
			"Votre actu, 2 actus, il y a 1 h",
			"Actus de Nom marie, 1 actu, 1 non vue, il y a 1 h",
		])
		expect(screen.getByRole("group", { name: "Actus" })).toBeInTheDocument()
		expect(screen.getByText("Vous")).toBeInTheDocument()

		fireEvent.click(tiles[0]!)
		expect(onCreate).toHaveBeenCalledTimes(1)
		fireEvent.click(tiles[2]!)
		expect(onOpen).toHaveBeenCalledWith("marie")
	})

	it("nomme par le libellé neutre un auteur que le moteur ne nomme pas", () => {
		mocks.byInstant.set(BASE, { groups: [group(null)], truncated: false })
		renderTray(BASE)
		expect(screen.getByText("Membre du réseau")).toBeInTheDocument()
	})

	it("garde le plateau du pas précédent pendant que le pas suivant s'abonne", () => {
		mocks.byInstant.set(BASE, { groups: [group("marie")], truncated: false })
		const view = renderTray(BASE + 1_000)
		expect(screen.getByText("Nom marie")).toBeInTheDocument()

		// Le pas suivant : sa réponse est encore en vol — la rangée ne disparaît pas.
		view.rerender(<StoriesTray myHandle="moi" now={BASE + STEP + 1_000} onOpen={vi.fn()} onCreate={vi.fn()} />)
		expect(mocks.calls.at(-1)).toEqual({ networkId: TEST_NETWORK_ID, now: BASE + STEP })
		expect(screen.getByText("Nom marie")).toBeInTheDocument()

		// Puis il répond : c'est lui qui s'affiche.
		mocks.byInstant.set(BASE + STEP, { groups: [group("paul")], truncated: false })
		view.rerender(<StoriesTray myHandle="moi" now={BASE + STEP + 2_000} onOpen={vi.fn()} onCreate={vi.fn()} />)
		expect(screen.queryByText("Nom marie")).toBeNull()
		expect(screen.getByText("Nom paul")).toBeInTheDocument()
	})

	it("rend une vignette vidéo dans un élément vidéo muet", () => {
		mocks.byInstant.set(BASE, {
			groups: [group("marie", { cover: { url: "clip.mp4", kind: "video" } })],
			truncated: false,
		})
		const { container } = renderTray(BASE)
		const video = container.querySelector("video.st-card-media")
		expect(video).not.toBeNull()
		expect(video?.getAttribute("src")).toBe("clip.mp4#t=0.1")
	})
})
