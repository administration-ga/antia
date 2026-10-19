/**
 * CC-5 — adresses, clés et filtre des conversations contextuelles (écrit le 19/10/2026,
 * NON EXÉCUTÉ : « Continuer sans vérifier »). Même doctrine que la destination P10 : rien
 * n'existe sans l'injection de l'application, aucun identifiant ne change de famille.
 */
import { describe, expect, it } from "vitest"

import { CONTEXTUAL_CONVERSATION_FILTER, filtrerConversations, parseConversationFilter, servedConversationFilters } from "./icom-views"
import { commercialKey, contextualConversationKey, parseCommercialKey, parseContextualConversationKey, parseKey } from "./messagerie-dock"
import { CONTEXTUAL_ROUTE_KIND, CONVERSATION_ROUTE_KINDS, contextualThreadIdFromPath, conversationHref, conversationKeyFromPath, parseConversationRoute } from "./messagerie-routes"

describe("destination contextuelle injectée (CC-5)", () => {
  it("ne transforme aucun fil contextuel en fil personnel, de groupe ou commercial", () => {
    const key = contextualConversationKey("fil/contexte")
    expect(parseContextualConversationKey(key)).toBe("fil/contexte")
    expect(parseKey(key)).toBeNull()
    expect(parseCommercialKey(key)).toBeNull()
    expect(parseContextualConversationKey(commercialKey("fil"))).toBeNull()
    expect(parseContextualConversationKey("contexte:")).toBeNull()
  })

  it("compose et relit l'adresse, seulement pour l'application qui injecte sa source", () => {
    const key = contextualConversationKey("fil/contexte")
    expect(CONTEXTUAL_ROUTE_KIND).toBe("mise-en-relation")
    expect(conversationHref(key, "/messages/")).toBe("/messages/mise-en-relation/fil%2Fcontexte")
    expect(parseConversationRoute("mise-en-relation", "fil/contexte")).toBeNull()
    expect(parseConversationRoute("mise-en-relation", "fil/contexte", false, true)).toBe(key)
    expect(parseConversationRoute("mise-en-relation", "", false, true)).toBeNull()
    // Le canal commercial garde son propre drapeau : l'un n'ouvre jamais l'autre.
    expect(parseConversationRoute("commerce", "fil", false, true)).toBeNull()
    expect(parseConversationRoute("mise-en-relation", "fil", true, false)).toBeNull()
  })

  it("reste hors des genres historiques : le dock personnel et ses adresses n'en savent rien", () => {
    expect(CONVERSATION_ROUTE_KINDS).not.toContain("mise-en-relation")
    expect(conversationKeyFromPath("/messages/mise-en-relation/fil-1", "/messages")).toBeNull()
  })

  it("relit le fil ouvert d'un chemin complet, décodé, et rien d'autre", () => {
    expect(contextualThreadIdFromPath("/messages/mise-en-relation/fil%2F1", "/messages")).toBe("fil/1")
    expect(contextualThreadIdFromPath("/messages/chat/fil-1", "/messages")).toBeNull()
    expect(contextualThreadIdFromPath("/messages/mise-en-relation/%zz", "/messages")).toBeNull()
    expect(contextualThreadIdFromPath("/messages", "/messages")).toBeNull()
  })
})

describe("filtre « Mises en relation » typé (CC-5)", () => {
  it("n'est ni rendu ni adressable sans injection", () => {
    expect(servedConversationFilters().some((filter) => filter.id === "mises_en_relation")).toBe(false)
    expect(parseConversationFilter("mises_en_relation")).toBe("toutes")
    expect(parseConversationFilter("mises_en_relation", true)).toBe("toutes")
  })

  it("est servi, en dernier, quand l'application injecte sa liste — avec ou sans le canal P10", () => {
    expect(servedConversationFilters(false, true).map((filter) => filter.id)).toEqual(["toutes", "non_lues", "groupes", "mises_en_relation"])
    expect(servedConversationFilters(true, true).map((filter) => filter.id)).toEqual(["toutes", "non_lues", "groupes", "boutiques", "mises_en_relation"])
    expect(CONTEXTUAL_CONVERSATION_FILTER.labelKey).toBe("messagerie:contextualConversation.filter")
    expect(parseConversationFilter("mises_en_relation", false, true)).toBe("mises_en_relation")
  })

  it("n'admet aucun fil personnel ni de groupe dans ce filtre", () => {
    const chat = { id: "chat", lastMessageAt: 10, unreadCount: 1 }
    const group = { id: "group", lastMessageAt: 20, unreadCount: 1 }
    expect(filtrerConversations([chat], [group], "mises_en_relation")).toEqual([])
  })
})
