// Dupliqué de socle/packages/agent-features/src/features/notifications/notification-center-tabs.test.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT pour une seule source — retirés avec l'onglet « Administration » : `CENTER_TABS` (1 cas), `defaultCenterTab` (5), `combineUnread` (2), `combinedUnreadLabel` (4) et l'accord « administrative » de `tabBadgeLabel` (1) ; portés : les trois cas de `tabBadge`, et trois cas de `tabBadgeLabel` réécrits sur `unreadLabel` (nombre et accord, silence, plafond), libellés lus dans l'i18n du moteur ; ajoutés : la LACUNE du décompte (`capped`) sur la pastille et sur son nom, le plafond lu dans le domaine, l'anglais, et le texte d'un marquage refusé (code du moteur, sinon phrase générique).
import { NOTIFICATION_UNREAD_CAP } from "@antsia/social-domain/notifications"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { readFailureText, tabBadge, unreadLabel } from "./notification-center-tabs"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "notifications" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

describe("tabBadge — « 1 »…« 99 », puis « 99+ »", () => {
	it("ne rend aucune pastille à zéro, inconnu ou aberrant", () => {
		for (const count of [
			undefined,
			0,
			-3,
			0.4,
			Number.NaN,
			Number.POSITIVE_INFINITY,
		]) {
			expect(tabBadge(count)).toBeNull()
			// Une lacune sans rien à compter ne fabrique pas de pastille.
			expect(tabBadge(count, true)).toBeNull()
		}
	})

	it("écrit le nombre exact jusqu'à 99 inclus", () => {
		expect(tabBadge(1)).toBe("1")
		expect(tabBadge(42)).toBe("42")
		expect(tabBadge(99)).toBe("99")
		expect(tabBadge(2.7)).toBe("2")
	})

	it("plafonne au-delà", () => {
		expect(tabBadge(100)).toBe("99+")
		expect(tabBadge(200)).toBe("99+")
	})

	it("dit « 99+ » quand le serveur signale une LACUNE, et 99 tel quel sans elle", () => {
		// Le moteur compte jusqu'au plafond et dit, par `capped`, qu'il en reste :
		// 99 sans lacune est EXACT, 99 avec lacune est un plancher.
		expect(tabBadge(99, false)).toBe("99")
		expect(tabBadge(99, true)).toBe("99+")
		expect(tabBadge(99, true)).toBe(`${NOTIFICATION_UNREAD_CAP}+`)
	})
})

describe("unreadLabel — le nombre, l'unité et l'accord", () => {
	it("dit le nombre de non-lues, au singulier et au pluriel", () => {
		expect(unreadLabel(1, false, t)).toBe("1 notification non lue")
		expect(unreadLabel(2, false, t)).toBe("2 notifications non lues")
	})

	it("se tait quand la pastille se tait", () => {
		for (const count of [undefined, 0, -1, Number.NaN]) {
			expect(unreadLabel(count, false, t)).toBeNull()
			expect(unreadLabel(count, true, t)).toBeNull()
		}
	})

	it("annonce le plafond comme la pastille l'affiche", () => {
		expect(unreadLabel(99, false, t)).toBe("99 notifications non lues")
		expect(unreadLabel(99, true, t)).toBe("Plus de 99 notifications non lues")
		expect(unreadLabel(100, false, t)).toBe("Plus de 99 notifications non lues")
	})

	it("parle la langue de l'écran", () => {
		expect(unreadLabel(1, false, tEn)).toBe("1 unread notification")
		expect(unreadLabel(3, false, tEn)).toBe("3 unread notifications")
		expect(unreadLabel(99, true, tEn)).toBe("More than 99 unread notifications")
	})
})

describe("readFailureText — le refus d'un marquage, par son code", () => {
	it("dit le code du moteur, sinon la phrase générique — jamais le message brut", () => {
		expect(readFailureText({ data: { code: "rateLimited" } }, t)).toBe(
			"Trop de tentatives. Réessayez dans quelques instants.",
		)
		expect(readFailureText(new Error("[CONVEX M(x)] Server Error"), t)).toBe(
			"Le marquage n'a pas pu être enregistré.",
		)
		expect(readFailureText({ data: { code: "code_inconnu" } }, t)).toBe(
			"Le marquage n'a pas pu être enregistré.",
		)
	})
})
