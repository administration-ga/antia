// Dupliqué de socle/packages/agent-features/src/components/identity/post-identity.test.ts @ ad2e7fdc2 — adaptations : les six cas portés sur l'identité du moteur — le sur-titre dit les badges CALCULÉS (plus de fonction ni d'administration : les cas « poste » deviennent leurs pendants « badges ») ; libellés lus dans l'i18n du moteur (français) ; un cas ajouté pour le badge sans libellé à part (`badgeLabelKey`).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { badgeLabelKey, hasPostEyebrow, postEyebrow, postIdentityAnnouncement, signalBadges } from "./post-identity"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

describe("le sur-titre de l'identité d'une personne", () => {
  it("porte les badges calculés, dans l'ordre du serveur", () => {
    expect(postEyebrow({ badges: ["verified", "public_agent"] }, t)).toBe("Vérifié · Agent public")
  })

  it("disparaît quand seule la Communauté est rendue", () => {
    // « Communauté » est l'absence de tout autre badge : au-dessus de chaque
    // nom, il n'apprendrait rien.
    expect(postEyebrow({ badges: ["community"] }, t)).toBeNull()
    expect(hasPostEyebrow({ badges: ["community"] })).toBe(false)
  })

  it("ne répète pas un badge rendu deux fois", () => {
    expect(postEyebrow({ badges: ["verified", "verified", "community"] }, t)).toBe("Vérifié")
    expect(signalBadges({ badges: ["official", "community", "official"] })).toEqual(["official"])
  })

  it("se contente de ce qu'il a", () => {
    expect(postEyebrow({ badges: ["official"] }, t)).toBe("Officiel")
    expect(postEyebrow({ badges: ["public_agent"] }, t)).toBe("Agent public")
  })

  it("rend null plutôt qu'une phrase de remplissage", () => {
    expect(postEyebrow({}, t)).toBeNull()
    expect(postEyebrow({ badges: null }, t)).toBeNull()
    expect(postEyebrow({ badges: [] }, t)).toBeNull()
    expect(hasPostEyebrow({})).toBe(false)
    expect(hasPostEyebrow({ badges: ["verified"] })).toBe(true)
  })

  it("annonce le nom ET les badges d'un seul tenant aux lecteurs d'écran", () => {
    // Un sur-titre suivi d'un nom s'annonce comme deux fragments sans lien.
    expect(postIdentityAnnouncement("Jean Ondo", { badges: ["verified", "public_agent"] }, t)).toBe(
      "Jean Ondo, Vérifié · Agent public",
    )
    expect(postIdentityAnnouncement("Jean Ondo", { badges: ["community"] }, t)).toBe("Jean Ondo")
  })

  it("lit chaque libellé dans l'espace partagé des badges", () => {
    expect(badgeLabelKey("public_agent")).toBe("social:badges.publicAgent")
    expect(t(badgeLabelKey("community"))).toBe("Communauté")
  })
})
