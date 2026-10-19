// Dupliqué de socle/packages/agent-features/src/features/floating-surface/escape-stack.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle).
import { describe, expect, it, vi } from "vitest"
import {
	createEscapeStack,
	ESCAPE_PRIORITY,
	type EscapeStackEvent,
} from "./escape-stack"

/**
 * IC-12 — la pile Échap. Le défaut reproduit ici est celui de l'audit :
 * l'hôte de la couche d'appel (monté EN PREMIER, donc abonné en premier)
 * réduisait la fenêtre pendant que le sélecteur posé PAR-DESSUS se fermait,
 * sur la même frappe.
 */

/** Une frappe Échap qui retient si quelqu'un l'a consommée. */
function frappe(): EscapeStackEvent {
	const event = {
		key: "Escape",
		defaultPrevented: false,
		preventDefault: () => {
			event.defaultPrevented = true
		},
	}
	return event
}

describe("la surface SUPÉRIEURE consomme d'abord", () => {
	it("le sélecteur se ferme sans que l'appel soit réduit", () => {
		const stack = createEscapeStack()
		const reduireLAppel = vi.fn()
		const fermerLeSelecteur = vi.fn()

		// L'ordre de MONTAGE est celui du défaut : l'hôte d'abord.
		stack.push({
			id: "call-surface",
			priority: ESCAPE_PRIORITY.SURFACE,
			onEscape: reduireLAppel,
		})
		stack.push({
			id: "add-to-call",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: fermerLeSelecteur,
		})

		const result = stack.dispatch(frappe())

		expect(result).toEqual({ handled: true, by: "add-to-call" })
		expect(fermerLeSelecteur).toHaveBeenCalledTimes(1)
		expect(reduireLAppel).not.toHaveBeenCalled()
	})

	it("le SECOND Échap atteint la surface d'en dessous", () => {
		const stack = createEscapeStack()
		const reduireLAppel = vi.fn()
		const fermerLeSelecteur = vi.fn()
		stack.push({
			id: "call-surface",
			priority: ESCAPE_PRIORITY.SURFACE,
			onEscape: reduireLAppel,
		})
		const retirer = stack.push({
			id: "add-to-call",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: fermerLeSelecteur,
		})

		stack.dispatch(frappe())
		retirer()
		const second = stack.dispatch(frappe())

		expect(second.by).toBe("call-surface")
		expect(reduireLAppel).toHaveBeenCalledTimes(1)
		expect(fermerLeSelecteur).toHaveBeenCalledTimes(1)
	})

	it("à priorité égale, la plus RÉCEMMENT posée gagne", () => {
		const stack = createEscapeStack()
		const ordre: string[] = []
		stack.push({
			id: "icom",
			priority: ESCAPE_PRIORITY.WINDOW,
			onEscape: () => void ordre.push("icom"),
		})
		stack.push({
			id: "iappel",
			priority: ESCAPE_PRIORITY.WINDOW,
			onEscape: () => void ordre.push("iappel"),
		})

		expect(stack.dispatch(frappe()).by).toBe("iappel")
		expect(ordre).toEqual(["iappel"])
	})
})

describe("une couche peut DÉCLINER", () => {
	it("`false` cède la frappe à la suivante", () => {
		const stack = createEscapeStack()
		const reduireLAppel = vi.fn()
		stack.push({
			id: "call-surface",
			priority: ESCAPE_PRIORITY.SURFACE,
			onEscape: reduireLAppel,
		})
		// L'hôte décline quand aucun appel n'est actif : sans la cascade, il
		// mangerait la frappe sans rien faire.
		stack.push({
			id: "overlay-inerte",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: () => false,
		})

		expect(stack.dispatch(frappe()).by).toBe("call-surface")
		expect(reduireLAppel).toHaveBeenCalledTimes(1)
	})

	it("personne ne répond : la frappe n'est pas consommée", () => {
		const stack = createEscapeStack()
		stack.push({
			id: "decline",
			priority: ESCAPE_PRIORITY.SURFACE,
			onEscape: () => false,
		})
		const event = frappe()
		expect(stack.dispatch(event)).toEqual({ handled: false, by: null })
		expect(event.defaultPrevented).toBe(false)
	})
})

describe("la pile respecte ce que les autres ont revendiqué", () => {
	it("`defaultPrevented` ⇒ AUCUNE couche n'est appelée", () => {
		const stack = createEscapeStack()
		const onEscape = vi.fn()
		stack.push({ id: "overlay", priority: ESCAPE_PRIORITY.OVERLAY, onEscape })

		// Le composeur (`MessageComposer`) et la recherche mobile préviennent :
		// la pile ne double jamais leur geste.
		const result = stack.dispatch({ key: "Escape", defaultPrevented: true })

		expect(result).toEqual({ handled: false, by: null })
		expect(onEscape).not.toHaveBeenCalled()
	})

	it("une autre touche ne réveille personne", () => {
		const stack = createEscapeStack()
		const onEscape = vi.fn()
		stack.push({ id: "overlay", priority: ESCAPE_PRIORITY.OVERLAY, onEscape })
		expect(stack.dispatch({ key: "Enter" }).handled).toBe(false)
		expect(onEscape).not.toHaveBeenCalled()
	})

	it("consommer PRÉVIENT l'évènement — la couche du dessous ne le reverra pas", () => {
		const stack = createEscapeStack()
		stack.push({
			id: "overlay",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: () => undefined,
		})
		const event = frappe()
		stack.dispatch(event)
		expect(event.defaultPrevented).toBe(true)
	})
})

describe("la pile se vide", () => {
	it("retirer deux fois la même couche ne retire pas celle d'à côté", () => {
		const stack = createEscapeStack()
		const retirer = stack.push({
			id: "a",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: () => undefined,
		})
		stack.push({
			id: "b",
			priority: ESCAPE_PRIORITY.OVERLAY,
			onEscape: () => undefined,
		})
		retirer()
		retirer()
		expect(stack.size()).toBe(1)
		expect(stack.dispatch(frappe()).by).toBe("b")
	})

	it("le compteur retombe à zéro — c'est ce qui retire l'écouteur", () => {
		const stack = createEscapeStack()
		const a = stack.push({
			id: "a",
			priority: ESCAPE_PRIORITY.WINDOW,
			onEscape: () => undefined,
		})
		const b = stack.push({
			id: "b",
			priority: ESCAPE_PRIORITY.SURFACE,
			onEscape: () => undefined,
		})
		expect(stack.size()).toBe(2)
		a()
		b()
		expect(stack.size()).toBe(0)
		expect(stack.dispatch(frappe())).toEqual({ handled: false, by: null })
	})
})

describe("les priorités sont NOMMÉES", () => {
	it("le déplacement reste au-dessus de tout", () => {
		expect(ESCAPE_PRIORITY.DRAG).toBeGreaterThan(ESCAPE_PRIORITY.OVERLAY)
		expect(ESCAPE_PRIORITY.OVERLAY).toBeGreaterThan(ESCAPE_PRIORITY.WINDOW)
		expect(ESCAPE_PRIORITY.WINDOW).toBeGreaterThan(ESCAPE_PRIORITY.SURFACE)
	})
})
