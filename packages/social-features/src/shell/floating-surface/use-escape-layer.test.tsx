// Dupliqué de socle/packages/agent-features/src/features/floating-surface/use-escape-layer.test.tsx @ ad2e7fdc2 — adaptations : aucune (copie textuelle, montée en jsdom).
// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react"
import { useEffect, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { escapeStack, ESCAPE_PRIORITY } from "./escape-stack"
import { useEscapeLayer } from "./use-escape-layer"

/**
 * IC-12 monté : deux surfaces réelles, une seule frappe, un seul écouteur.
 * Le défaut d'origine ne se voit qu'ici — la pile pure ne dit rien de l'ordre
 * d'installation des abonnements `window`.
 */

function Surface({
	id,
	priority,
	onEscape,
	enabled,
}: {
	id: string
	priority: number
	onEscape: () => boolean | void
	enabled?: boolean
}) {
	useEscapeLayer({ id, priority, onEscape, enabled })
	return <div data-testid={id} />
}

afterEach(() => {
	// La pile est un singleton : un test qui laisse une couche fausse le suivant.
	expect(escapeStack.size()).toBe(0)
})

describe("la couche du dessus consomme, celle du dessous attend", () => {
	it("un Échap ferme le sélecteur sans réduire l'appel", () => {
		const reduire = vi.fn()
		const fermer = vi.fn()
		const vue = render(
			<>
				<Surface
					id="call-surface"
					priority={ESCAPE_PRIORITY.SURFACE}
					onEscape={reduire}
				/>
				<Surface
					id="add-to-call"
					priority={ESCAPE_PRIORITY.OVERLAY}
					onEscape={fermer}
				/>
			</>,
		)

		fireEvent.keyDown(window, { key: "Escape" })

		expect(fermer).toHaveBeenCalledTimes(1)
		expect(reduire).not.toHaveBeenCalled()
		vue.unmount()
	})

	it("après démontage du sélecteur, l'appel reçoit la frappe", () => {
		const reduire = vi.fn()
		const fermer = vi.fn()

		function Scene() {
			const [ouvert, setOuvert] = useState(true)
			useEffect(() => {
				// Le sélecteur se referme après la première frappe, comme à l'écran.
				if (fermer.mock.calls.length > 0) setOuvert(false)
			})
			return (
				<>
					<Surface
						id="call-surface"
						priority={ESCAPE_PRIORITY.SURFACE}
						onEscape={reduire}
					/>
					{ouvert ? (
						<Surface
							id="add-to-call"
							priority={ESCAPE_PRIORITY.OVERLAY}
							onEscape={fermer}
						/>
					) : null}
				</>
			)
		}

		const vue = render(<Scene />)
		fireEvent.keyDown(window, { key: "Escape" })
		vue.rerender(<Scene />)
		fireEvent.keyDown(window, { key: "Escape" })

		expect(fermer).toHaveBeenCalledTimes(1)
		expect(reduire).toHaveBeenCalledTimes(1)
		vue.unmount()
	})
})

describe("l'écouteur unique", () => {
	it("plus aucune couche ⇒ plus rien n'écoute", () => {
		const onEscape = vi.fn()
		const vue = render(
			<Surface
				id="solo"
				priority={ESCAPE_PRIORITY.WINDOW}
				onEscape={onEscape}
			/>,
		)
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onEscape).toHaveBeenCalledTimes(1)

		vue.unmount()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onEscape).toHaveBeenCalledTimes(1)
	})

	it("`enabled: false` n'inscrit rien", () => {
		const onEscape = vi.fn()
		const vue = render(
			<Surface
				id="repliee"
				priority={ESCAPE_PRIORITY.WINDOW}
				onEscape={onEscape}
				enabled={false}
			/>,
		)
		expect(escapeStack.size()).toBe(0)
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onEscape).not.toHaveBeenCalled()
		vue.unmount()
	})
})

describe("un onKeyDown local garde la main", () => {
	it("un composeur qui PRÉVIENT n'est pas doublé par la pile", () => {
		const reduire = vi.fn()
		const quitterLeFil = vi.fn()

		const vue = render(
			<>
				<Surface
					id="call-surface"
					priority={ESCAPE_PRIORITY.SURFACE}
					onEscape={reduire}
				/>
				<textarea
					data-testid="composeur"
					onKeyDown={(event) => {
						if (event.key !== "Escape") return
						event.preventDefault()
						quitterLeFil()
					}}
				/>
			</>,
		)

		fireEvent.keyDown(vue.getByTestId("composeur"), { key: "Escape" })

		expect(quitterLeFil).toHaveBeenCalledTimes(1)
		expect(reduire).not.toHaveBeenCalled()
		vue.unmount()
	})
})
