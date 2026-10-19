// Dupliqué de socle/packages/agent-features/src/features/iappel/call-surface-plan.test.ts @ ad2e7fdc2 — adaptations : cas retiré — le slot de la file du centre d'appels (`kind: "queue"`), absente du moteur ; le slot sans `kind` reste un appel direct ; P05 (18/10/2026) : deux cas — le slot terminé ACTIF montre son écran de fin, un slot terminé non actif reste invisible.
import { describe, expect, it } from "vitest"
import { planCallSurface, type SurfaceSlotView } from "./call-surface-plan"

function slot(
	meetingId: string,
	status: SurfaceSlotView["status"],
	over: Partial<SurfaceSlotView> = {},
): SurfaceSlotView {
	return { meetingId, status, ...over }
}

function plan(over: Partial<Parameters<typeof planCallSurface>[0]> = {}) {
	return planCallSurface({
		slots: [],
		activeSlotId: null,
		minimized: false,
		viewport: "mobile",
		...over,
	})
}

describe("rien à montrer", () => {
	it("aucun slot : la surface n'est pas montée", () => {
		expect(plan()).toEqual({
			front: null,
			frontIsHeld: false,
			held: [],
			presentation: "hidden",
			showHeldChips: false,
		})
	})

	it("un slot terminé ne monte rien", () => {
		expect(plan({ slots: [slot("x", "ended")] }).presentation).toBe("hidden")
	})

	it("P05 — le slot terminé qui tient la ligne montre son écran de fin (refus d'admission, fin distante)", () => {
		expect(plan({ slots: [slot("x", "ended")], activeSlotId: "x" })).toMatchObject({ front: "x", frontIsHeld: false, presentation: "fullscreen" })
	})

	it("P05 — un slot terminé qui n'est plus l'actif reste invisible ; l'appel vivant garde la ligne", () => {
		expect(plan({ slots: [slot("x", "ended"), slot("y", "active")], activeSlotId: "y" })).toMatchObject({ front: "y", held: [] })
	})

	it("un slot sans `kind` est traité comme direct — c'est ce qu'il a toujours été", () => {
		expect(plan({ slots: [slot("x", "active")] }).presentation).toBe("fullscreen")
		expect(plan({ slots: [slot("x", "active", { kind: "direct" })] }).presentation).toBe("fullscreen")
	})
})

describe("la pose", () => {
	it("téléphone : plein écran", () => {
		const p = plan({ slots: [slot("x", "active")], viewport: "mobile" })
		expect(p.presentation).toBe("fullscreen")
	})

	it("bureau : fenêtre flottante — la page reste utilisable", () => {
		const p = plan({ slots: [slot("x", "active")], viewport: "desktop" })
		expect(p.presentation).toBe("floating")
	})

	it("réduit : la pilule, dans les deux cas", () => {
		for (const viewport of ["mobile", "desktop"] as const) {
			const p = plan({ slots: [slot("x", "active")], viewport, minimized: true })
			expect(p.presentation).toBe("minimized")
		}
	})

	it("largeur inconnue (rendu serveur) : on ne devine pas, on attend", () => {
		const p = plan({ slots: [slot("x", "active")], viewport: "unknown" })
		expect(p.presentation).toBe("hidden")
		// …mais l'appel de tête est déjà connu : rien n'est perdu, seul le
		// rendu attend de savoir sur quel écran il se fait.
		expect(p.front).toBe("x")
	})
})

describe("quel appel est au premier plan", () => {
	it("le slot actif, quand il est vivant", () => {
		const p = plan({
			slots: [slot("a", "active"), slot("b", "connecting")],
			activeSlotId: "b",
		})
		expect(p.front).toBe("b")
	})

	it("un slot actif PARQUÉ ne tient pas le premier plan", () => {
		const p = plan({
			slots: [slot("parque", "held", { heldSince: 1 }), slot("libre", "active")],
			activeSlotId: "parque",
		})
		expect(p.front).toBe("libre")
		expect(p.held).toEqual(["parque"])
	})

	it("sans slot actif désigné, le premier non parqué prend la main", () => {
		const p = plan({ slots: [slot("h", "held"), slot("v", "connecting")] })
		expect(p.front).toBe("v")
	})

	it("un `activeSlotId` périmé ne fait pas disparaître la surface", () => {
		const p = plan({ slots: [slot("v", "active")], activeSlotId: "disparu" })
		expect(p.front).toBe("v")
	})
})

describe("les appels en attente", () => {
	it("sont ordonnés du plus ancien au plus récent", () => {
		const p = plan({
			slots: [
				slot("recent", "held", { heldSince: 200 }),
				slot("ancien", "held", { heldSince: 100 }),
				slot("front", "active"),
			],
		})
		expect(p.held).toEqual(["ancien", "recent"])
		expect(p.showHeldChips).toBe(true)
	})

	it("les puces disparaissent en pilule — le compteur les remplace", () => {
		const p = plan({
			slots: [slot("h", "held"), slot("f", "active")],
			minimized: true,
		})
		expect(p.held).toEqual(["h"])
		expect(p.showHeldChips).toBe(false)
	})

	it("tous les appels parqués : le plus RÉCENT passe au premier plan", () => {
		// Ce test affirmait `front: null` et une pose forcée en pilule. C'était
		// le défaut : `CallSurface` jette alors ses `children`, « Raccrocher »
		// n'a plus de cible et « Restaurer » ne fait rien. Un appel parqué
		// reste un appel qu'on pilote — il porte son bouton « Reprendre ».
		const p = plan({ slots: [slot("h", "held")] })
		expect(p.front).toBe("h")
		expect(p.frontIsHeld).toBe(true)
		expect(p.presentation).toBe("fullscreen")
		// Il est déjà à l'écran : l'afficher AUSSI en puce ferait croire à deux
		// appels là où il n'y en a qu'un.
		expect(p.held).toEqual([])
	})

	it("entre deux parqués, le dernier quitté prend la tête", () => {
		const p = plan({
			slots: [
				{ ...slot("vieux", "held"), heldSince: 100 },
				{ ...slot("recent", "held"), heldSince: 900 },
			],
		})
		expect(p.front).toBe("recent")
		expect(p.held).toEqual(["vieux"])
	})

	it("l'actif parqué garde la tête tant qu'aucun autre n'est disponible", () => {
		// C'est LUI que l'usager regardait : le remplacer par un autre parqué
		// changerait d'interlocuteur sans qu'il l'ait demandé.
		const p = plan({
			slots: [
				{ ...slot("regarde", "held"), heldSince: 100 },
				{ ...slot("autre", "held"), heldSince: 900 },
			],
			activeSlotId: "regarde",
		})
		expect(p.front).toBe("regarde")
		expect(p.frontIsHeld).toBe(true)
	})

	it("un appel NON parqué passe toujours devant un parqué", () => {
		const p = plan({
			slots: [slot("parque", "held"), slot("vivant", "active")],
			activeSlotId: "parque",
		})
		expect(p.front).toBe("vivant")
		expect(p.frontIsHeld).toBe(false)
		expect(p.held).toEqual(["parque"])
	})

	it("aucune puce quand rien n'attend", () => {
		expect(plan({ slots: [slot("x", "active")] }).showHeldChips).toBe(false)
	})
})
