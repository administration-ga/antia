// Dupliqué de socle/packages/agent-features/src/features/iappel/call-host.test.ts @ ad2e7fdc2 — adaptations : la carte du poste (portée `poste`) n'existe pas dans le moteur ; « une carte qui ne sert pas ce scope » est désormais une carte qui n'en déclare aucun (`scopes: []`) — mêmes règles vérifiées : jamais un appel chez une carte qui ne l'accepte pas, repli sur la surface libre, réveil d'une carte fermée pour son seul scope.
import { describe, expect, it } from "vitest"

import {
	cardYieldsEscape,
	collapseRequiresMinimize,
	coverStarts,
	hostModeFor,
	pickCallHost,
	resolveCallHosting,
	shouldWakeForRinging,
	type CallHostView,
} from "./call-host"

const agent: CallHostView = { id: "icom-agent", scopes: ["personnel"], pose: "medium" }
/** Une carte montée qui n'héberge aucun appel (aucun scope déclaré). */
const muette: CallHostView = { id: "icom-muette", scopes: [], pose: "phone" }

describe("pickCallHost — quelle carte héberge un appel", () => {
	it("sans carte, l'appel garde la surface libre", () => {
		expect(pickCallHost([], "personnel")).toBeNull()
	})

	it("un appel personnel va dans la carte qui accepte sa portée", () => {
		expect(pickCallHost([agent, muette], "personnel")).toBe(agent)
	})

	it("jamais chez une carte qui ne l'accepte pas : repli sur la surface libre", () => {
		// La carte muette est la plus récente ET la seule : elle n'héberge pas
		// pour autant un appel dont elle n'a pas déclaré la portée.
		expect(pickCallHost([muette], "personnel")).toBeNull()
	})

	it("à scope égal, la carte déclarée en dernier l'emporte", () => {
		const first: CallHostView = { id: "a", scopes: ["personnel"], pose: "medium" }
		const last: CallHostView = { id: "b", scopes: ["personnel"], pose: "compact" }
		expect(pickCallHost([first, last], "personnel")).toBe(last)
		expect(pickCallHost([last, first], "personnel")).toBe(first)
	})
})

describe("hostModeFor — ce que l'appel occupe dans la carte", () => {
	it("affiché, il couvre le corps ; réduit, il devient une bande", () => {
		expect(hostModeFor("floating", agent)).toBe("cover")
		expect(hostModeFor("minimized", agent)).toBe("strip")
	})

	it("rien à dessiner sans carte, sans appel, ou au téléphone réel", () => {
		expect(hostModeFor("floating", null)).toBe("none")
		expect(hostModeFor("minimized", null)).toBe("none")
		expect(hostModeFor("hidden", agent)).toBe("none")
		// `fullscreen` est la pose du téléphone réel (< 960 px) : l'écran entier.
		expect(hostModeFor("fullscreen", agent)).toBe("none")
	})
})

describe("cohabitation avec la forme de la carte", () => {
	it("un appel qui arrive ou qu'on restaure déplie la carte — une transition, pas un état", () => {
		expect(coverStarts("none", "cover")).toBe(true)
		expect(coverStarts("strip", "cover")).toBe(true)
		// Rétracter la carte pendant l'appel (qui le réduit d'abord) ne doit pas
		// la rouvrir : l'état `cover` ne suffit pas, il faut y ENTRER.
		expect(coverStarts("cover", "cover")).toBe(false)
		expect(coverStarts("cover", "strip")).toBe(false)
		expect(coverStarts("none", "strip")).toBe(false)
	})

	it("rétracter une carte qui montre l'appel le réduit d'abord — jamais dehors", () => {
		expect(collapseRequiresMinimize("cover")).toBe(true)
		expect(collapseRequiresMinimize("strip")).toBe(false)
		expect(collapseRequiresMinimize("none")).toBe(false)
	})

	it("Échap appartient à la couche d'appel tant qu'elle couvre (IC-07)", () => {
		expect(cardYieldsEscape("cover")).toBe(true)
		expect(cardYieldsEscape("strip")).toBe(false)
		expect(cardYieldsEscape("none")).toBe(false)
	})
})

describe("resolveCallHosting — l'appel entrant sonne DANS le téléphone", () => {
	it("un appel en cours l'emporte : sa carte, son mode", () => {
		expect(
			resolveCallHosting({
				presentation: "floating",
				callHost: agent,
				ringing: { scope: "personnel" },
				ringingHost: muette,
			}),
		).toEqual({ id: "icom-agent", mode: "cover" })
		expect(
			resolveCallHosting({
				presentation: "minimized",
				callHost: agent,
				ringing: null,
				ringingHost: null,
			}),
		).toEqual({ id: "icom-agent", mode: "strip" })
	})

	it("sans appel en cours, ce qui sonne couvre la carte de SON scope", () => {
		expect(
			resolveCallHosting({
				presentation: "hidden",
				callHost: null,
				ringing: { scope: "personnel" },
				ringingHost: agent,
			}),
		).toEqual({ id: "icom-agent", mode: "cover" })
	})

	it("sans carte pour le scope qui sonne, la bannière libre reste le repli", () => {
		expect(
			resolveCallHosting({
				presentation: "hidden",
				callHost: null,
				ringing: { scope: "personnel" },
				ringingHost: null,
			}),
		).toBeNull()
		expect(
			resolveCallHosting({ presentation: "hidden", callHost: null, ringing: null, ringingHost: agent }),
		).toBeNull()
	})

	it("au téléphone réel (plein écran) ou en appel en cours sans carte, rien n'est hébergé", () => {
		expect(
			resolveCallHosting({
				presentation: "fullscreen",
				callHost: null,
				ringing: { scope: "personnel" },
				ringingHost: agent,
			}),
		).toBeNull()
		// Un appel en cours SANS carte ne laisse pas l'entrant couvrir une
		// autre carte : il vit dans la bande de la scène libre (appel en attente).
		expect(
			resolveCallHosting({
				presentation: "floating",
				callHost: null,
				ringing: { scope: "personnel" },
				ringingHost: agent,
			}),
		).toBeNull()
	})
})

describe("shouldWakeForRinging — un téléphone rangé s'allume quand on l'appelle", () => {
	it("la carte fermée s'ouvre pour un appel de sa portée, au bureau", () => {
		expect(
			shouldWakeForRinging({ ringing: { scope: "personnel" }, scopes: ["personnel"], open: false, desktop: true }),
		).toBe(true)
	})

	it("jamais pour une portée qu'elle ne sert pas, jamais ouverte, jamais au téléphone réel, jamais sans sonnerie", () => {
		expect(
			shouldWakeForRinging({ ringing: { scope: "personnel" }, scopes: [], open: false, desktop: true }),
		).toBe(false)
		expect(
			shouldWakeForRinging({ ringing: { scope: "personnel" }, scopes: ["personnel"], open: true, desktop: true }),
		).toBe(false)
		expect(
			shouldWakeForRinging({ ringing: { scope: "personnel" }, scopes: ["personnel"], open: false, desktop: false }),
		).toBe(false)
		expect(shouldWakeForRinging({ ringing: null, scopes: ["personnel"], open: false, desktop: true })).toBe(false)
	})
})
