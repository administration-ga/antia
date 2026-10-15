// Dupliqué de socle/convex/modules/iappel/group.test.ts @ ad2e7fdc2 — adaptations : personnes (`personId`) ; titre composé → ses parties (`groupCallTitleParts`, la phrase est à l'écran) ; raison « hors horaires » remplacée par une raison du moteur ; borne de balayage du moteur (32) ; cas ajouté : le plafond de onze et le minimum de deux correspondants.
import { describe, expect, it } from "vitest"

import {
  countReservedSeats,
  GROUP_CALL_INVITES_SCAN,
  GROUP_CALL_MAX_PARTICIPANTS,
  GROUP_CALL_MIN_OTHERS,
  groupCallShouldEnd,
  groupCallTitleParts,
  type GroupParticipantState,
  type GroupParticipantView,
  normalizeGroupInvitees,
  participantStateOf,
  reservesSeat,
  summarizeGroupCall,
} from "./callGroup"

const HOST = "p_host"
const MARIE = "p_marie"
const PAUL = "p_paul"

function view(personId: string, state: GroupParticipantView["state"], reason: GroupParticipantView["reason"] = null): GroupParticipantView {
  return { personId, state, reason }
}

describe("participantStateOf — la présence prime sur le ticket", () => {
  it("un invité DANS la salle est connecté, quoi que dise son ticket", () => {
    expect(participantStateOf({ isHost: false, invite: { personId: MARIE, status: "ringing" }, presence: { personId: MARIE, joinedAt: 10 } }).state).toBe("connected")
  })

  it("un invité qui a décroché PUIS raccroché est parti, pas en ligne", () => {
    expect(participantStateOf({ isHost: false, invite: { personId: MARIE, status: "joined" }, presence: { personId: MARIE, joinedAt: 10, leftAt: 20 } }).state).toBe("left")
  })

  it("un refus HUMAIN se dit « a refusé »", () => {
    const state = participantStateOf({ isHost: false, invite: { personId: PAUL, status: "declined", reason: null }, presence: null })
    expect(state.state).toBe("declined")
    expect(state.reason).toBeNull()
  })

  it("un refus AUTOMATIQUE se dit « indisponible », et porte sa raison", () => {
    const state = participantStateOf({ isHost: false, invite: { personId: PAUL, status: "declined", reason: "dnd" }, presence: null })
    expect(state.state).toBe("unavailable")
    expect(state.reason).toBe("dnd")
  })

  it("l'hôte est l'hôte — jusqu'à ce qu'il quitte", () => {
    expect(participantStateOf({ isHost: true, invite: null, presence: { personId: HOST, joinedAt: 1 } }).state).toBe("host")
    expect(participantStateOf({ isHost: true, invite: null, presence: { personId: HOST, joinedAt: 1, leftAt: 9 } }).state).toBe("left")
  })

  it("une ligne sans ticket sonne — jamais « refusé »", () => {
    expect(participantStateOf({ isHost: false, invite: null, presence: null }).state).toBe("ringing")
  })
})

describe("summarizeGroupCall — ce que l'en-tête annonce", () => {
  it("compte l'hôte parmi les connectés", () => {
    expect(summarizeGroupCall([view(HOST, "host"), view(MARIE, "connected"), view(PAUL, "ringing")])).toEqual({ connected: 2, ringing: 1, unreachable: 0, invited: 3 })
  })

  it("range refus, indisponibilité, absence et départ sous « injoignables »", () => {
    const summary = summarizeGroupCall([view(HOST, "host"), view("a", "declined"), view("b", "unavailable", "busy"), view("c", "missed"), view("d", "left")])
    expect(summary.unreachable).toBe(4)
    expect(summary.connected).toBe(1)
  })
})

describe("groupCallShouldEnd — quitter n'est PAS raccrocher pour tous", () => {
  it("l'appel CONTINUE quand un invité part et que d'autres parlent", () => {
    expect(groupCallShouldEnd([view(HOST, "host"), view(MARIE, "connected"), view(PAUL, "left")])).toBe(false)
  })

  it("l'appel CONTINUE quand une seule personne est en ligne et que ça sonne", () => {
    expect(groupCallShouldEnd([view(HOST, "host"), view(MARIE, "ringing")])).toBe(false)
  })

  it("une sonnerie en cours NE SUFFIT PAS quand la salle est vide", () => {
    expect(groupCallShouldEnd([view(HOST, "left"), view(MARIE, "ringing")])).toBe(true)
  })

  it("l'appel se termine quand plus personne n'est en ligne", () => {
    expect(groupCallShouldEnd([view(HOST, "left"), view(MARIE, "declined"), view(PAUL, "missed")])).toBe(true)
  })

  it("une personne SEULE en ligne suffit à garder l'appel ouvert", () => {
    expect(groupCallShouldEnd([view(HOST, "host"), view(MARIE, "left")])).toBe(false)
  })
})

describe("groupCallTitleParts — un appel dit à qui l'on parle (la phrase est à l'écran)", () => {
  it("nomme les participants quand ils tiennent", () => {
    expect(groupCallTitleParts(["Marie Ndong", "Paul Obame"])).toEqual({ shown: ["Marie Ndong", "Paul Obame"], more: 0 })
  })

  it("borne à trois noms, puis compte le reste", () => {
    expect(groupCallTitleParts(["A", "B", "C", "D", "E"])).toEqual({ shown: ["A", "B", "C"], more: 2 })
  })

  it("ne rend jamais un nom vide", () => {
    expect(groupCallTitleParts([])).toEqual({ shown: [], more: 0 })
    expect(groupCallTitleParts(["  ", ""])).toEqual({ shown: [], more: 0 })
  })
})

describe("reservesSeat / countReservedSeats — qui OCCUPE une place (IC-04)", () => {
  it("l'hôte, un connecté et un téléphone qui sonne encore réservent", () => {
    expect(reservesSeat("host")).toBe(true)
    expect(reservesSeat("connected")).toBe(true)
    expect(reservesSeat("ringing")).toBe(true)
  })

  it("un refus, un manqué, un indisponible et un départ LIBÈRENT la place", () => {
    for (const state of ["declined", "missed", "unavailable", "left"] as const) expect(reservesSeat(state), state).toBe(false)
  })

  it("countReservedSeats ne compte que les états réservants, sur les sept", () => {
    const all: GroupParticipantState[] = ["host", "ringing", "connected", "left", "declined", "unavailable", "missed"]
    expect(countReservedSeats(all.map((state, index) => view(`p${index}`, state)))).toBe(3)
    expect(countReservedSeats([])).toBe(0)
  })

  it("trois refus ne bloquent plus la capacité", () => {
    const participants = [view(HOST, "host"), view("a", "ringing"), view("b", "ringing"), view("c", "ringing"), view("d", "declined"), view("e", "unavailable", "dnd"), view("f", "missed")]
    expect(countReservedSeats(participants)).toBe(4)
    expect(GROUP_CALL_MAX_PARTICIPANTS - countReservedSeats(participants)).toBe(7)
  })

  it("la borne de balayage des tickets dépasse le plafond de participants", () => {
    // Dès qu'un refus libère une place, un appel porte PLUS de lignes que de places.
    expect(GROUP_CALL_INVITES_SCAN).toBeGreaterThan(GROUP_CALL_MAX_PARTICIPANTS)
  })

  it("onze places, appelant compris ; au moins deux correspondants", () => {
    expect(GROUP_CALL_MAX_PARTICIPANTS).toBe(11)
    expect(GROUP_CALL_MIN_OTHERS).toBe(2)
  })
})

describe("normalizeGroupInvitees — ni soi-même, ni deux fois", () => {
  it("écarte l'appelant de sa propre liste", () => {
    expect(normalizeGroupInvitees([MARIE, HOST, PAUL], HOST)).toEqual([MARIE, PAUL])
  })

  it("dédoublonne — un doublon compterait deux places sur le plafond", () => {
    expect(normalizeGroupInvitees([MARIE, MARIE, PAUL], HOST)).toEqual([MARIE, PAUL])
  })

  it("préserve l'ordre de sélection", () => {
    expect(normalizeGroupInvitees([PAUL, MARIE], HOST)).toEqual([PAUL, MARIE])
  })
})
