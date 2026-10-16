// Dupliqué de socle/packages/agent-features/src/features/direct/direct-presence.test.ts @ ad2e7fdc2 — adaptations : domaine pur et tests portés ; aucune dépendance inter-produit.
import { describe, expect, it } from "vitest"
import {
  DIRECT_PRESENCE_TTL_MS as SERVER_TTL,
  DIRECT_PRESENCE_HEARTBEAT_MS as SERVER_HEARTBEAT,
  isViewerPresent as serverIsViewerPresent,
} from "@antsia/social-domain/live/domain"
import {
  DIRECT_PRESENCE_HEARTBEAT_MS,
  DIRECT_PRESENCE_TTL_MS,
  isViewerPresent,
  shouldBeatViewerPresence,
  type DirectViewerPresenceFacts,
} from "./direct-presence"

const T0 = 1_700_000_000_000

describe("direct-presence — le contrat avec le serveur", () => {
  it("les deux durées sont celles du serveur, pas des voisines", () => {
    expect(DIRECT_PRESENCE_TTL_MS).toBe(SERVER_TTL)
    expect(DIRECT_PRESENCE_HEARTBEAT_MS).toBe(SERVER_HEARTBEAT)
    // Le battement doit être STRICTEMENT plus rapide que l'extinction du
    // bail — et ici deux fois plus, parce qu'un onglet mobile en arrière-plan
    // est throttlé : perdre sa place pour un feu rouge serait pire que la
    // compter une minute de trop.
    expect(DIRECT_PRESENCE_HEARTBEAT_MS * 2).toBeLessThanOrEqual(
      DIRECT_PRESENCE_TTL_MS,
    )
  })

  it("juge EXACTEMENT comme le serveur, sur toute la matrice", () => {
    const cas: { grant: DirectViewerPresenceFacts; now: number }[] = [
      { grant: {}, now: T0 },
      { grant: { lastSeenAt: T0 }, now: T0 },
      { grant: { lastSeenAt: T0 }, now: T0 + DIRECT_PRESENCE_TTL_MS },
      { grant: { lastSeenAt: T0 }, now: T0 + DIRECT_PRESENCE_TTL_MS + 1 },
      { grant: { lastSeenAt: T0, leftAt: T0 + 10 }, now: T0 + 20 },
      { grant: { leftAt: T0 }, now: T0 + 1 },
    ]
    for (const { grant, now } of cas) {
      expect(isViewerPresent(grant, now)).toBe(
        serverIsViewerPresent(grant, now),
      )
    }
  })
})

describe("direct-presence — qui est présent", () => {
  it("une admission JAMAIS battue n'est pas une présence", () => {
    // C'est le jeton qu'on obtient sans que la salle s'ouvre — et c'est aussi
    // la forme des admissions d'avant le lot 08D. Les compter présentes
    // rendrait les salles d'hier éternellement pleines.
    expect(isViewerPresent({}, T0)).toBe(false)
  })

  it("un départ VOLONTAIRE l'emporte, même sur un battement récent", () => {
    expect(isViewerPresent({ lastSeenAt: T0, leftAt: T0 + 1 }, T0 + 2)).toBe(
      false,
    )
  })

  it("la borne du TTL est INCLUSIVE — une pulsation pile à l'heure tient", () => {
    expect(isViewerPresent({ lastSeenAt: T0 }, T0 + DIRECT_PRESENCE_TTL_MS)).toBe(
      true,
    )
    expect(
      isViewerPresent({ lastSeenAt: T0 }, T0 + DIRECT_PRESENCE_TTL_MS + 1),
    ).toBe(false)
  })
})

describe("direct-presence — qui doit battre", () => {
  it("le SPECTATEUR connecté, et lui seul", () => {
    expect(shouldBeatViewerPresence("viewer", "connected")).toBe(true)
    // Une bascule 4G ne rend pas sa place à quelqu'un qui revient : le TTL
    // reste le juge s'il ne revient pas.
    expect(shouldBeatViewerPresence("viewer", "reconnecting")).toBe(true)
  })

  it("l'intervenant NE bat PAS : il occupe une place d'antenne, pas de salle", () => {
    expect(shouldBeatViewerPresence("speaker", "connected")).toBe(false)
    expect(shouldBeatViewerPresence("speaker", "reconnecting")).toBe(false)
  })

  it("hors salle, personne ne bat — un jeton en main ne suffit pas", () => {
    for (const phase of [
      "idle",
      "preparing",
      "ready",
      "connecting",
      "disconnected",
      "error",
    ] as const) {
      expect(shouldBeatViewerPresence("viewer", phase)).toBe(false)
    }
    expect(shouldBeatViewerPresence(null, "connected")).toBe(false)
  })
})
