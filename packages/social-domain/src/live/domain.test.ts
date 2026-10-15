/**
 * Le domaine du direct — tests NEUFS des adaptations du moteur (le socle n'en
 * avait pas : son domaine était couvert par les tests d'intégration du direct
 * et ceux de l'écran, qui viennent avec leurs lots). Ce que ce fichier tient :
 *  1. les plafonds de la salle vivent ICI (le backend les réexporte) ;
 *  2. un refus du domaine est un CODE de règle et ses bornes, jamais une phrase ;
 *  3. l'audience `followers` (ex-« organisation », V40) garde sa rediffusion :
 *     on n'en sort pas, on n'y entre pas par la copie.
 */
import { describe, expect, it } from "vitest"

import { PERSONAL_REACH_AUDIENCES } from "../content"
import { DomainViolation } from "../violation"
import {
  assertDirectCommentBody,
  assertDirectTitle,
  assertInviteeCapacity,
  DIRECT_AUDIENCES,
  DIRECT_COMMENT_MAX_LENGTH,
  DIRECT_DEFAULT_MAX_VIEWERS,
  DIRECT_MAX_INVITEES,
  DIRECT_MAX_SPEAKER_INVITEES,
  DIRECT_MAX_SPEAKERS,
  DIRECT_MAX_VIEWERS_CAP,
  DIRECT_TITLE_MAX_LENGTH,
  clampMaxViewers,
  effectiveReplayVisibility,
  isReplayVisibilityAllowed,
  planDirectInvitees,
} from "./domain"

/** La violation levée (code et bornes), ou `null`. */
function violationOf(rule: () => unknown): { code: string; params: Record<string, number> } | null {
  try {
    rule()
  } catch (error) {
    if (error instanceof DomainViolation) return { code: error.code, params: { ...error.params } }
    throw error
  }
  return null
}

describe("plafonds de la salle — posés dans le domaine", () => {
  it("huit intervenants hôte compris, deux cents spectateurs par défaut, mille au plus, sept invités intervenants", () => {
    expect(DIRECT_MAX_SPEAKERS).toBe(8)
    expect(DIRECT_DEFAULT_MAX_VIEWERS).toBe(200)
    expect(DIRECT_MAX_VIEWERS_CAP).toBe(1000)
    expect(DIRECT_MAX_SPEAKER_INVITEES).toBe(DIRECT_MAX_SPEAKERS - 1)
    // Une demande hors borne se RÉTRÉCIT, elle n'est pas rejetée.
    expect(clampMaxViewers(undefined)).toBe(DIRECT_DEFAULT_MAX_VIEWERS)
    expect(clampMaxViewers(5_000)).toBe(DIRECT_MAX_VIEWERS_CAP)
    expect(clampMaxViewers(0)).toBe(1)
  })
})

describe("refus du domaine — un code et ses bornes, jamais une phrase", () => {
  it("le titre : requis, borné, épuré", () => {
    expect(violationOf(() => assertDirectTitle("   "))).toEqual({ code: "LIVE_TITLE_REQUIRED", params: {} })
    expect(violationOf(() => assertDirectTitle("x".repeat(DIRECT_TITLE_MAX_LENGTH + 1)))).toEqual({
      code: "LIVE_TITLE_TOO_LONG",
      params: { max: DIRECT_TITLE_MAX_LENGTH },
    })
    expect(assertDirectTitle("  Grand   oral  ")).toBe("Grand oral")
  })

  it("le commentaire : requis, borné", () => {
    expect(violationOf(() => assertDirectCommentBody(" "))).toEqual({ code: "LIVE_COMMENT_EMPTY", params: {} })
    expect(violationOf(() => assertDirectCommentBody("x".repeat(DIRECT_COMMENT_MAX_LENGTH + 1)))).toEqual({
      code: "LIVE_COMMENT_TOO_LONG",
      params: { max: DIRECT_COMMENT_MAX_LENGTH },
    })
  })

  it("la liste d'invités : bornes par code ; doublons fusionnés (`speaker` l'emporte) ; l'hôte ignoré", () => {
    const many = Array.from({ length: DIRECT_MAX_INVITEES + 1 }, (_, index) => ({ personId: `p${index}`, stageRole: "viewer" as const }))
    expect(violationOf(() => planDirectInvitees(many, "hote"))).toEqual({ code: "LIVE_INVITEES_TOO_MANY", params: { max: DIRECT_MAX_INVITEES } })
    const speakers = Array.from({ length: DIRECT_MAX_SPEAKER_INVITEES + 1 }, (_, index) => ({ personId: `s${index}`, stageRole: "speaker" as const }))
    expect(violationOf(() => planDirectInvitees(speakers, "hote"))).toEqual({
      code: "LIVE_SPEAKER_INVITEES_TOO_MANY",
      params: { max: DIRECT_MAX_SPEAKER_INVITEES },
    })
    expect(
      planDirectInvitees(
        [
          { personId: "a", stageRole: "viewer" },
          { personId: "hote", stageRole: "speaker" },
          { personId: "a", stageRole: "speaker" },
        ],
        "hote",
      ),
    ).toEqual([{ personId: "a", stageRole: "speaker" }])
    expect(violationOf(() => assertInviteeCapacity({ invitees: DIRECT_MAX_INVITEES, speakerInvitees: DIRECT_MAX_SPEAKER_INVITEES }))).toBeNull()
  })
})

describe("audience `followers` — le cercle d'une page (V40)", () => {
  it("prolonge la portée du fil : `public` et `connections`, plus `followers` et `invitees`", () => {
    expect(DIRECT_AUDIENCES).toEqual(expect.arrayContaining([...PERSONAL_REACH_AUDIENCES, "followers", "invitees"]))
    expect(DIRECT_AUDIENCES).not.toContain("organisation")
  })

  it("une rediffusion ne SORT pas du cercle de la page, et l'on n'y ENTRE pas par la copie", () => {
    expect(isReplayVisibilityAllowed("followers", "followers")).toBe(true)
    expect(isReplayVisibilityAllowed("followers", "public")).toBe(false)
    expect(isReplayVisibilityAllowed("followers", "connections")).toBe(false)
    expect(isReplayVisibilityAllowed("public", "followers")).toBe(false)
    expect(isReplayVisibilityAllowed("connections", "followers")).toBe(false)
    // Le reste de la règle est intact : on ne peut que RESTREINDRE.
    expect(isReplayVisibilityAllowed("public", "connections")).toBe(true)
    expect(isReplayVisibilityAllowed("connections", "public")).toBe(false)
  })

  it("la visibilité EFFECTIVE d'une conférence réservée aux abonnés reste réservée, quoi qu'on ait stocké", () => {
    expect(effectiveReplayVisibility({ audience: "followers", replayVisibility: "public" })).toBe("followers")
    expect(effectiveReplayVisibility({ audience: "invitees", replayVisibility: "public" })).toBe("invitees")
    expect(effectiveReplayVisibility({ audience: "public", replayVisibility: "connections" })).toBe("connections")
    expect(effectiveReplayVisibility({ audience: "public" })).toBe("public")
  })
})
