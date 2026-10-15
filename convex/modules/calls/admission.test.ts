// Dupliqué de socle/convex/modules/iappel/admission.test.ts @ ad2e7fdc2 — adaptations : décideur du moteur (sans portée, horaires, autorité, priorité ni secrétariat — 31 cas de ces blocs partent avec leur code) ; plus de phrase pour l'appelant (`callerMessageFor`, `labelOf` retirés : la décision rend la raison, l'écran la dit) ; « hors relations » sans notion d'appel de poste ; cas gardés : sans réglage, ne pas déranger (dont l'expiré), silence de réunion opt-in, déjà en ligne, ordre des refus, hors ligne fail-open, hors de mes relations.
import { describe, expect, it } from "vitest"

import { type AdmissionInput, decideCallAdmission } from "./admission"

const NOW = Date.UTC(2026, 9, 15, 12, 0)
const DND_ACTIF = { until: NOW + 3_600_000 }

function decide(over: Partial<AdmissionInput> = {}) {
  return decideCallAdmission({ now: NOW, prefs: null, calleeActiveCallCount: 0, ...over })
}

describe("sans aucun réglage, tout appel passe", () => {
  it("un appel ordinaire est admis", () => {
    expect(decide()).toEqual({ admitted: true })
  })
})

describe("ne pas déranger", () => {
  it("refuse, sans jamais dire jusqu'à quand (la décision ne porte aucune heure)", () => {
    expect(decide({ prefs: { dnd: DND_ACTIF } })).toEqual({ admitted: false, reason: "dnd" })
  })

  it("un silence expiré n'a plus d'effet", () => {
    expect(decide({ prefs: { dnd: { until: NOW - 1 } } }).admitted).toBe(true)
    expect(decide({ prefs: { dnd: { until: NOW } } }).admitted).toBe(true)
  })
})

describe("silence automatique de réunion", () => {
  it("refuse quand un évènement est en cours ET le réglage activé", () => {
    expect(decide({ inMeeting: true, prefs: { autoMeetingDnd: { enabled: true } } })).toEqual({ admitted: false, reason: "in_meeting" })
  })

  it("ne refuse RIEN si le réglage n'est pas activé — c'est un opt-in", () => {
    expect(decide({ inMeeting: true, prefs: { autoMeetingDnd: { enabled: false } } }).admitted).toBe(true)
    expect(decide({ inMeeting: true, prefs: null }).admitted).toBe(true)
  })

  it("ne refuse rien hors réunion", () => {
    expect(decide({ inMeeting: false, prefs: { autoMeetingDnd: { enabled: true } } }).admitted).toBe(true)
  })
})

describe("déjà en ligne", () => {
  it("par DÉFAUT, un second appel passe — il se présentera en attente", () => {
    expect(decide({ calleeActiveCallCount: 1 }).admitted).toBe(true)
  })

  it("refuse seulement si l'appel en attente a été désactivé", () => {
    expect(decide({ calleeActiveCallCount: 1, prefs: { callWaiting: false } })).toEqual({ admitted: false, reason: "busy" })
  })

  it("…et pas quand la ligne est libre", () => {
    expect(decide({ calleeActiveCallCount: 0, prefs: { callWaiting: false } }).admitted).toBe(true)
  })
})

describe("l'ordre des refus", () => {
  it("le silence déclaré l'emporte sur « en réunion » et sur « déjà en ligne »", () => {
    expect(decide({ inMeeting: true, calleeActiveCallCount: 2, prefs: { dnd: DND_ACTIF, autoMeetingDnd: { enabled: true }, callWaiting: false } })).toEqual({ admitted: false, reason: "dnd" })
  })

  it("la réunion l'emporte sur « déjà en ligne »", () => {
    expect(decide({ inMeeting: true, calleeActiveCallCount: 1, prefs: { autoMeetingDnd: { enabled: true }, callWaiting: false } })).toEqual({ admitted: false, reason: "in_meeting" })
  })
})

describe("hors ligne (constat serveur, fail-open)", () => {
  it("sans preuve, l'appel sonne — le fail-open est le contrat", () => {
    expect(decide({ calleeKnownOffline: false }).admitted).toBe(true)
    expect(decide({}).admitted).toBe(true)
  })

  it("preuves en main, refuse en disant « hors ligne »", () => {
    expect(decide({ calleeKnownOffline: true })).toEqual({ admitted: false, reason: "offline" })
  })

  it("tout réglage délibéré parle AVANT l'état technique", () => {
    expect(decide({ calleeKnownOffline: true, prefs: { dnd: DND_ACTIF } })).toEqual({ admitted: false, reason: "dnd" })
    expect(decide({ calleeKnownOffline: true, calleeActiveCallCount: 1, prefs: { callWaiting: false } })).toEqual({ admitted: false, reason: "busy" })
  })
})

describe("appels hors de mes relations", () => {
  it("un étranger est écarté, en le disant", () => {
    expect(decide({ strangerPolicy: { silent: true, callerIsRelation: false } })).toEqual({ admitted: false, reason: "outside_relations" })
  })

  it("une RELATION passe", () => {
    expect(decide({ strangerPolicy: { silent: true, callerIsRelation: true } }).admitted).toBe(true)
  })

  it("le DÉFAUT (« sonner ») laisse passer tout le monde", () => {
    expect(decide({ strangerPolicy: { silent: false, callerIsRelation: false } }).admitted).toBe(true)
  })

  it("on ne sait pas si c'est une relation : l'appel sonne (fail-open)", () => {
    expect(decide({ strangerPolicy: { silent: true, callerIsRelation: null } }).admitted).toBe(true)
  })

  it("il se prononce AVANT le « ne pas déranger » : un périmètre déclaré, pas un état", () => {
    expect(decide({ strangerPolicy: { silent: true, callerIsRelation: false }, prefs: { dnd: DND_ACTIF }, calleeKnownOffline: true })).toEqual({ admitted: false, reason: "outside_relations" })
  })
})
