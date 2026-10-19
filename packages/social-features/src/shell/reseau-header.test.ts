// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-header.test.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) avec son module ; cas inchangés (les volets viennent de `reseau-agent-nav` du moteur).
import { describe, expect, it } from "vitest"
import { RESEAU_AGENT_TAB_IDS } from "./reseau-agent-nav"
import {
  RESEAU_COVER_AVATAR,
  RESEAU_COVER_HEIGHT,
  RESEAU_HEADER_VARIANT,
  showCover,
  stripAvatarSize,
} from "./reseau-header"

describe("showCover — variante strip : jamais de bannière", () => {
  it("est faux pour tous les volets", () => {
    for (const tab of RESEAU_AGENT_TAB_IDS) {
      expect(showCover("strip", tab)).toBe(false)
    }
  })
})

describe("showCover — variante cover-fil : seulement le fil", () => {
  it("est vrai sur le fil, faux sur tous les autres volets", () => {
    for (const tab of RESEAU_AGENT_TAB_IDS) {
      expect(showCover("cover-fil", tab)).toBe(tab === "fil")
    }
  })
})

describe("la variante retenue pour ce lot", () => {
  it("est la barre compacte", () => {
    expect(RESEAU_HEADER_VARIANT).toBe("strip")
  })
})

describe("cohérence arithmétique marge/diamètre", () => {
  it("la marge à cheval vaut la moitié du diamètre plus le liseré (4 px)", () => {
    expect(RESEAU_COVER_AVATAR / 2 + 4).toBe(48)
  })

  it("les tailles publiées restent celles documentées", () => {
    expect(RESEAU_COVER_HEIGHT).toBe(104)
    expect(RESEAU_COVER_AVATAR).toBe(88)
    expect(stripAvatarSize()).toBe(52)
  })
})
