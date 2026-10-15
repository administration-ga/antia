// Dupliqué de socle/packages/agent-features/src/features/iappel/call-kind-reconcile.test.ts @ ad2e7fdc2 — adaptations : instantané = état de l'appel du moteur (`getCall` : `participantCount` au lieu du tableau `participants`) ; titre par défaut lu dans les locales françaises du moteur (`t` réel) — attendus inchangés.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { CallSlot } from "../../stores/call-store"
import {
	deriveEffectiveCallKind,
	planSlotReconciliation,
} from "./call-kind-reconcile"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * IC-02 — la promotion 1:1 → groupe n'atteignait que celui qui avait ajouté.
 *
 * `callKind` est une PHOTOGRAPHIE prise à la création du slot (l'appelé la
 * reçoit de `listRinging`, l'appelant sortant n'en a pas) et n'était jamais
 * re-dérivée de l'appel canonique auquel l'hôte souscrit déjà. A et B
 * restaient en tête-à-tête pendant que C entrait dans une salle de groupe.
 */

const slot = (extra: Partial<CallSlot> = {}): CallSlot => ({
	meetingId: "m1" as CallSlot["meetingId"],
	status: "active",
	...extra,
})

describe("deriveEffectiveCallKind — le meeting canonique l'emporte", () => {
	it("un meeting promu « group » l'emporte sur la photographie « direct » du slot", () => {
		expect(
			deriveEffectiveCallKind({ slotCallKind: "direct", meetingCallKind: "group" }),
		).toBe("group")
		expect(
			deriveEffectiveCallKind({ slotCallKind: undefined, meetingCallKind: "group" }),
		).toBe("group")
	})

	it("ne rétrograde JAMAIS un groupe en tête-à-tête", () => {
		expect(
			deriveEffectiveCallKind({ slotCallKind: "group", meetingCallKind: "direct" }),
		).toBe("group")
		expect(
			deriveEffectiveCallKind({ slotCallKind: "group", meetingCallKind: undefined }),
		).toBe("group")
		expect(
			deriveEffectiveCallKind({ slotCallKind: "group", meetingCallKind: null }),
		).toBe("group")
	})

	it("sans meeting, la photographie du slot fait foi — et « direct » par défaut", () => {
		expect(
			deriveEffectiveCallKind({ slotCallKind: "direct", meetingCallKind: undefined }),
		).toBe("direct")
		expect(
			deriveEffectiveCallKind({ slotCallKind: undefined, meetingCallKind: undefined }),
		).toBe("direct")
		// Une valeur inconnue côté meeting ne promeut rien.
		expect(
			deriveEffectiveCallKind({ slotCallKind: "direct", meetingCallKind: "meeting" }),
		).toBe("direct")
	})
})

describe("planSlotReconciliation — ce que le slot doit reprendre du meeting", () => {
	const meetingGroup = {
		callKind: "group",
		title: "Appel de groupe — Bob, Carla",
		participantCount: 3,
	}

	it("meeting absent ⇒ rien à faire", () => {
		expect(planSlotReconciliation(slot({ callKind: "direct" }), undefined, t)).toBeNull()
		expect(planSlotReconciliation(slot({ callKind: "direct" }), null, t)).toBeNull()
	})

	it("meeting non groupe ⇒ rien à faire, même pour un slot groupe (pas de rétrogradation)", () => {
		expect(
			planSlotReconciliation(slot({ callKind: "direct" }), { callKind: "direct" }, t),
		).toBeNull()
		expect(
			planSlotReconciliation(slot({ callKind: "group" }), { callKind: undefined }, t),
		).toBeNull()
	})

	it("slot direct + meeting group ⇒ promotion, avec titre et effectif des CONVIÉS", () => {
		// L'effectif suit `listRinging` (les lignes de l'appel, hôte compris) :
		// c'est l'identité que l'appelé reçoit, la même partout.
		expect(planSlotReconciliation(slot({ callKind: "direct" }), meetingGroup, t)).toEqual({
			callKind: "group",
			group: { title: "Appel de groupe — Bob, Carla", memberCount: 3 },
		})
		expect(planSlotReconciliation(slot({}), meetingGroup, t)).toEqual({
			callKind: "group",
			group: { title: "Appel de groupe — Bob, Carla", memberCount: 3 },
		})
	})

	it("identique ⇒ null — un snapshot du meeting à chaque tick ne doit rien émettre", () => {
		expect(
			planSlotReconciliation(
				slot({
					callKind: "group",
					group: { title: "Appel de groupe — Bob, Carla", memberCount: 3 },
				}),
				meetingGroup, t,
			),
		).toBeNull()
	})

	it("titre ou effectif changés ⇒ patch, sans toucher au reste", () => {
		const patch = planSlotReconciliation(
			slot({ callKind: "group", group: { title: "Ancien", memberCount: 2 } }),
			meetingGroup, t,
		)
		expect(patch).toEqual({
			callKind: "group",
			group: { title: "Appel de groupe — Bob, Carla", memberCount: 3 },
		})
		expect(Object.keys(patch ?? {}).sort()).toEqual(["callKind", "group"])
	})

	it("un meeting groupe sans titre garde le titre déjà connu du slot", () => {
		expect(
			planSlotReconciliation(
				slot({ callKind: "group", group: { title: "Cellule de crise", memberCount: 3 } }),
				{ callKind: "group", title: "", participantCount: meetingGroup.participantCount }, t,
			),
		).toBeNull()
		expect(
			planSlotReconciliation(slot({ callKind: "direct" }), {
				callKind: "group",
				participantCount: meetingGroup.participantCount,
			}, t),
		).toEqual({
			callKind: "group",
			group: { title: "Appel de groupe", memberCount: 3 },
		})
	})
})
