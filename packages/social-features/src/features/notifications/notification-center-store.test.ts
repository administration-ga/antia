// Dupliqué de socle/packages/agent-features/src/features/notifications/notification-center-store.test.ts @ ad2e7fdc2 — adaptations : instantanés sans le champ `tab` ; les cinq cas de l'onglet de la carte retirés avec l'onglet « Administration » (le magasin ne porte plus d'onglet) ; les quatre cas d'ouverture, de fermeture et de bascule portés tels quels, et un cas ajouté : fermer un centre déjà fermé garde le même instantané.
import { afterEach, describe, expect, it } from "vitest"
import {
	closeNotificationCenter,
	openNotificationCenter,
	readNotificationCenter,
	resetNotificationCenterForTests,
	toggleNotificationCenter,
} from "./notification-center-store"

describe("notification-center-store", () => {
	afterEach(() => resetNotificationCenterForTests())

	it("part fermé, sans demande", () => {
		expect(readNotificationCenter()).toEqual({
			open: false,
			requestSeq: 0,
		})
	})

	it("une ouverture compte une demande, même si déjà ouvert", () => {
		openNotificationCenter()
		openNotificationCenter()
		expect(readNotificationCenter()).toEqual({
			open: true,
			requestSeq: 2,
		})
	})

	it("fermer ne touche pas la demande ; fermer deux fois est neutre", () => {
		openNotificationCenter()
		const before = readNotificationCenter()
		closeNotificationCenter()
		const closed = readNotificationCenter()
		expect(closed).toEqual({
			open: false,
			requestSeq: before.requestSeq,
		})
		closeNotificationCenter()
		expect(readNotificationCenter()).toBe(closed)
	})

	it("bascule", () => {
		toggleNotificationCenter()
		expect(readNotificationCenter().open).toBe(true)
		toggleNotificationCenter()
		expect(readNotificationCenter().open).toBe(false)
	})

	it("une fermeture d'un centre déjà fermé garde le MÊME instantané (aucun rendu inutile)", () => {
		const initial = readNotificationCenter()
		closeNotificationCenter()
		expect(readNotificationCenter()).toBe(initial)
	})
})
