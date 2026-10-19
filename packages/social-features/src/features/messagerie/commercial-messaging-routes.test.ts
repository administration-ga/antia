import { describe, expect, it } from "vitest"
import { commercialKey, parseCommercialKey, parseKey } from "./messagerie-dock"
import { parseConversationFilter, servedConversationFilters } from "./icom-views"
import { conversationHref, parseConversationRoute } from "./messagerie-routes"

describe("destination commerciale injectée", () => {
	it("ne transforme aucun fil commercial en fil du dock personnel", () => {
		const key = commercialKey("commercial/id")
		expect(parseCommercialKey(key)).toBe("commercial/id")
		expect(parseKey(key)).toBeNull()
		expect(parseCommercialKey("commerce:")).toBeNull()
		expect(conversationHref(key, "/messages/")).toBe("/messages/commerce/commercial%2Fid")
		expect(parseConversationRoute("commerce", "commercial/id")).toBeNull()
		expect(parseConversationRoute("commerce", "commercial/id", true)).toBe(key)
	})
	it("n'offre le filtre Boutiques qu'à l'application qui fournit sa vraie liste", () => {
		expect(servedConversationFilters().some((filter) => filter.id === "boutiques")).toBe(false)
		expect(parseConversationFilter("boutiques")).toBe("toutes")
		expect(servedConversationFilters(true).some((filter) => filter.id === "boutiques")).toBe(true)
		expect(parseConversationFilter("boutiques", true)).toBe("boutiques")
	})
})
