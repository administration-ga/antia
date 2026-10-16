// Dupliqué de socle/packages/agent-features/src/features/direct/direct-playback.test.ts @ ad2e7fdc2 — adaptations : règles du moteur, codes i18n et frontière VTT partagée.
import { describe, expect, it } from "vitest"
import { DIRECT_REPLAY_CAPTIONS_MAX_BYTES } from "@antia/social-domain/live/replayComposition"
import { replayCanDecide, replayCanRetry, replayCaptionsFileRefusal, replayDurationParts, replayRetentionIsNear, replayVisibilityOptions } from "./direct-playback"
import { directCardPose, directPresentationPlace } from "./direct-floating"

describe("F3c — lecture et géométrie du retour", () => {
  it("n'élargit pas l'audience et permet de décider pendant la préparation", () => {
    expect(replayVisibilityOptions("public")).toEqual(["public", "connections"])
    for (const audience of ["connections", "followers", "invitees"] as const) expect(replayVisibilityOptions(audience)).toEqual([audience])
    expect(replayCanDecide("pending")).toBe(true)
    expect(replayCanDecide("failed")).toBe(false)
    expect(replayCanDecide("expired")).toBe(false)
    expect(replayCanRetry({ status: "failed", recoverable: false })).toBe(false)
    expect(replayCanRetry({ status: "pending", recoverable: true })).toBe(true)
    expect(replayCanRetry({ status: "ready", recoverable: true })).toBe(false)
  })
  it("garde les mêmes limites de piste, avant toute lecture", () => {
    expect(replayCaptionsFileRefusal({ type: "video/mp4", size: 10 })).toBe("wrong_type")
    expect(replayCaptionsFileRefusal({ type: "text/vtt", size: 0 })).toBe("missing")
    expect(replayCaptionsFileRefusal({ type: "", size: DIRECT_REPLAY_CAPTIONS_MAX_BYTES })).toBeNull()
    expect(replayCaptionsFileRefusal({ type: "text/plain", size: DIRECT_REPLAY_CAPTIONS_MAX_BYTES + 1 })).toBe("too_large")
  })
  it("nomme la durée et la dernière semaine sans date inventée", () => {
    expect(replayDurationParts(null)).toBeNull()
    expect(replayDurationParts(65 * 60_000)).toEqual({ hours: 1, minutes: 5, totalMinutes: 65 })
    expect(replayRetentionIsNear(null, 1)).toBe(false)
    expect(replayRetentionIsNear(100, 100)).toBe(false)
    expect(replayRetentionIsNear(100, 99)).toBe(true)
  })
  it("adapte la pose et compare uniquement la route injectée de la session tenue", () => {
    expect(directCardPose({ isMobile: null, minimized: false })).toBeNull()
    expect(directCardPose({ isMobile: true, minimized: true })).toBe("mobile")
    expect(directCardPose({ isMobile: false, minimized: true })).toBe("pill")
    const input = { heldSessionId: "a", hasCredentials: true, pathname: "/room/a", conferenceHref: "/room/a" }
    expect(directPresentationPlace(input)).toBe("page")
    expect(directPresentationPlace({ ...input, pathname: "/room/b" })).toBe("floating")
    expect(directPresentationPlace({ ...input, heldSessionId: null })).toBe("hidden")
    expect(directPresentationPlace({ ...input, hasCredentials: false })).toBe("hidden")
    expect(directPresentationPlace({ ...input, pathname: "/feed", hasCredentials: false, pendingOrError: true })).toBe("floating")
  })
})
