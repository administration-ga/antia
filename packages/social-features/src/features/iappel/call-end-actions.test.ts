import { describe, expect, it } from "vitest"
import { callEndActions } from "./call-end-actions"

const routes = { messages: () => "/messages", commercialConversation: (id: string) => `/messages/commerce/${id}` }
const base = { kind: "direct" as const, peer: { userId: "buyer", handle: "acheteur" }, routes }
describe("P10 — gestes de fin d'appel", () => {
  it("conserve le rappel et la rédaction personnels sur une projection connue", () => {
    expect(callEndActions({ ...base, meeting: {} })).toEqual({ retryAvailable: true, writeHref: "/messages/a/acheteur", addParticipantAvailable: true })
  })
  it.each([undefined, null])("ferme les gestes quand l'autorité n'est plus lisible", (meeting) => {
    expect(callEndActions({ ...base, meeting })).toEqual({ retryAvailable: false, writeHref: null, addParticipantAvailable: false })
  })
  it("ouvre le fil commercial et ne prête aucun geste personnel", () => {
    expect(callEndActions({ ...base, meeting: { commercialThreadId: "commercial-1" } })).toEqual({ retryAvailable: false, writeHref: "/messages/commerce/commercial-1", addParticipantAvailable: false })
  })
  it("reste fermé chez un hôte sans route commerciale injectée", () => {
    expect(callEndActions({ ...base, routes: { messages: routes.messages }, meeting: { commercialThreadId: "commercial-1" } }).writeHref).toBeNull()
  })
})
