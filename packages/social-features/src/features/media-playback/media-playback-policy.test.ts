// P04 (18/10/2026) : les règles de lecture de 04 §3, décidées hors du navigateur.
import { describe, expect, it } from "vitest"

import {
  autoplayCapabilityFromPolicy,
  autoplayDecision,
  DEFAULT_PLAYBACK_ENVIRONMENT,
  environmentSuspension,
  isAutoplayRejection,
  isInterruptedPlay,
  isSufficientlyVisible,
  MEDIA_VISIBILITY_THRESHOLD,
  normalizedThreshold,
  preloadFor,
  suspensionFor,
  type AutoplayInput,
} from "./media-playback-policy"
import { effectiveVideoRole } from "./use-coordinated-video"

const base: AutoplayInput = {
  role: "active",
  capability: "unknown",
  environment: DEFAULT_PLAYBACK_ENVIRONMENT,
  visibleRatio: 1,
  threshold: MEDIA_VISIBILITY_THRESHOLD,
  userPaused: false,
  ended: false,
  displaced: false,
}

describe("seuil et visibilité", () => {
  it("part de 70 %, réglable dans ]0, 1], sinon le seuil initial", () => {
    expect(MEDIA_VISIBILITY_THRESHOLD).toBe(0.7)
    expect(normalizedThreshold(undefined)).toBe(0.7)
    expect(normalizedThreshold(0.5)).toBe(0.5)
    expect(normalizedThreshold(1)).toBe(1)
    for (const invalid of [0, -1, 1.5, Number.NaN]) expect(normalizedThreshold(invalid)).toBe(0.7)
  })

  it("une visibilité inconnue ne vaut pas « hors écran »", () => {
    expect(isSufficientlyVisible(null, 0.7)).toBe(true)
    expect(isSufficientlyVisible(0.69, 0.7)).toBe(false)
    expect(isSufficientlyVisible(0.7, 0.7)).toBe(true)
    expect(isSufficientlyVisible(Number.NaN, 0.7)).toBe(false)
  })
})

describe("suspensions", () => {
  it("l'appel prime sur l'onglet masqué ; aucun des deux : rien", () => {
    expect(environmentSuspension({ ...DEFAULT_PLAYBACK_ENVIRONMENT, callInProgress: true, documentHidden: true })).toBe("call")
    expect(environmentSuspension({ ...DEFAULT_PLAYBACK_ENVIRONMENT, documentHidden: true })).toBe("hidden")
    expect(environmentSuspension(DEFAULT_PLAYBACK_ENVIRONMENT)).toBeNull()
  })

  it("une vidéo qui joue se tait hors du créneau lu, sous le seuil, ou pendant une interruption", () => {
    const visible = { environment: DEFAULT_PLAYBACK_ENVIRONMENT, visibleRatio: 1, threshold: 0.7 }
    expect(suspensionFor({ ...visible, role: "active" })).toBeNull()
    expect(suspensionFor({ ...visible, role: "unmanaged" })).toBeNull()
    expect(suspensionFor({ ...visible, role: "neighbor" })).toBe("offscreen")
    expect(suspensionFor({ ...visible, role: "distant" })).toBe("offscreen")
    expect(suspensionFor({ ...visible, role: "unmanaged", visibleRatio: 0.3 })).toBe("offscreen")
    expect(suspensionFor({ ...visible, role: "active", environment: { ...DEFAULT_PLAYBACK_ENVIRONMENT, callInProgress: true } })).toBe("call")
  })
})

describe("préchargement", () => {
  it("la seule voisine et la publication lue préparent leurs métadonnées, les lointaines rien", () => {
    expect(preloadFor("active", DEFAULT_PLAYBACK_ENVIRONMENT)).toBe("metadata")
    expect(preloadFor("neighbor", DEFAULT_PLAYBACK_ENVIRONMENT)).toBe("metadata")
    expect(preloadFor("distant", DEFAULT_PLAYBACK_ENVIRONMENT)).toBe("none")
    // Hors lecteur : le comportement P03, à l'identique.
    expect(preloadFor("unmanaged", DEFAULT_PLAYBACK_ENVIRONMENT)).toBe("metadata")
  })

  it("l'économie de données n'anticipe AUCUNE vidéo", () => {
    for (const role of ["active", "neighbor", "distant", "unmanaged"] as const) {
      expect(preloadFor(role, { dataSaver: true })).toBe("none")
    }
  })
})

describe("lecture automatique", () => {
  it("seulement pour la publication lue, visible, sans interruption", () => {
    expect(autoplayDecision(base)).toBe("play")
    expect(autoplayDecision({ ...base, role: "neighbor" })).toBe("wait")
    expect(autoplayDecision({ ...base, role: "unmanaged" })).toBe("wait")
    expect(autoplayDecision({ ...base, visibleRatio: 0.5 })).toBe("wait")
    expect(autoplayDecision({ ...base, environment: { ...DEFAULT_PLAYBACK_ENVIRONMENT, documentHidden: true } })).toBe("wait")
    expect(autoplayDecision({ ...base, environment: { ...DEFAULT_PLAYBACK_ENVIRONMENT, callInProgress: true } })).toBe("wait")
  })

  it("« Lire » quand le navigateur refuse ou en économie de données", () => {
    expect(autoplayDecision({ ...base, capability: "blocked" })).toBe("manual")
    expect(autoplayDecision({ ...base, environment: { ...DEFAULT_PLAYBACK_ENVIRONMENT, dataSaver: true } })).toBe("manual")
  })

  it("aucune relance après une pause de la personne, une fin ou un remplacement", () => {
    expect(autoplayDecision({ ...base, userPaused: true })).toBe("wait")
    expect(autoplayDecision({ ...base, ended: true })).toBe("wait")
    expect(autoplayDecision({ ...base, displaced: true })).toBe("wait")
  })

  it("lit l'indice du navigateur sans jamais l'inventer", () => {
    expect(autoplayCapabilityFromPolicy("disallowed")).toBe("blocked")
    expect(autoplayCapabilityFromPolicy("allowed-muted")).toBe("allowed")
    expect(autoplayCapabilityFromPolicy("allowed")).toBe("allowed")
    expect(autoplayCapabilityFromPolicy(undefined)).toBe("unknown")
    expect(autoplayCapabilityFromPolicy(42)).toBe("unknown")
  })

  it("reconnaît le refus de lecture et l'interruption par une pause", () => {
    expect(isAutoplayRejection(new DOMException("blocked", "NotAllowedError"))).toBe(true)
    expect(isAutoplayRejection(new Error("other"))).toBe(false)
    expect(isInterruptedPlay(new DOMException("interrupted", "AbortError"))).toBe(true)
    expect(isInterruptedPlay(null)).toBe(false)
  })

  it("une vidéo CITÉE dans un partage ne prend jamais le rôle actif", () => {
    expect(effectiveVideoRole("active", true)).toBe("active")
    expect(effectiveVideoRole("active", false)).toBe("neighbor")
    expect(effectiveVideoRole("distant", false)).toBe("distant")
    expect(effectiveVideoRole("unmanaged", false)).toBe("unmanaged")
  })
})
