// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/profil-personne.test.ts @ ad2e7fdc2 — adaptations : textes du mur lus dans les locales françaises du moteur (`t` réel ; `wallEmptyText(isSelf, t)`, `wallErrorText(t)`, `wallLoadMoreLabel(t)` au lieu des constantes) ; cas de couverture inchangés ; cas neufs : adresses d'aperçu et de gestion composées sur l'adresse du profil injectée (`profileApercuHref`, `profileManageHref`), texte d'un refus du moteur (`profileErrorText` : règle, puis code, puis repli — jamais le message brut).
/**
 * profil-personne — la couverture publiée s'affiche, et son absence ramène
 * EXACTEMENT le rendu d'avant (R-10).
 *
 * Le défaut reproduit ici : la page posait `esp-banner pp-banner` en dur,
 * quelle que soit la valeur de la couverture. Un test qui n'observe que la
 * présence d'une classe ne l'aurait pas vu — c'est la BASCULE qui compte.
 */
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  COVER_BASE_MINI,
  coverBannerClassName,
  coverBannerStyle,
  PROFILE_APERCU_PARAM,
  PROFILE_MANAGE_PARAM,
  profileApercuHref,
  profileErrorText,
  profileManageHref,
  wallEmptyText,
  wallErrorText,
  wallLoadMoreLabel,
} from "./profil-personne"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** Une erreur telle que le client Convex la rend : seul `data` porte l'information. */
function engineError(data: unknown, message = "Server Error"): Error {
  return Object.assign(new Error(message), { data })
}

describe("coverBannerClassName", () => {
  it("sans couverture : le dégradé de charte, au caractère près", () => {
    expect(coverBannerClassName(null)).toBe("esp-banner pp-banner")
    expect(coverBannerClassName(undefined)).toBe("esp-banner pp-banner")
    // Une URL vide n'est pas une couverture : le serveur rend `null`, mais un
    // DTO ancien pourrait rendre la chaîne vide.
    expect(coverBannerClassName("")).toBe("esp-banner pp-banner")
  })

  it("avec couverture : plus de dégradé, un fond neutre sous la photo", () => {
    const classes = coverBannerClassName("https://s.ga/c.png")
    expect(classes).toBe("pp-banner pp-banner--photo")
    expect(classes).not.toContain("esp-banner")
  })

  it("la carte de rappel utilise SA base, pas celle du profil", () => {
    expect(coverBannerClassName(null, COVER_BASE_MINI)).toBe(
      "esp-banner rp-mini-banner",
    )
    expect(coverBannerClassName("https://s.ga/c.png", COVER_BASE_MINI)).toBe(
      "rp-mini-banner rp-mini-banner--photo",
    )
  })
})

describe("coverBannerStyle", () => {
  it("sans couverture : aucun style en ligne — la classe tient seule le fond", () => {
    expect(coverBannerStyle(null)).toBeUndefined()
    expect(coverBannerStyle(undefined)).toBeUndefined()
    expect(coverBannerStyle("")).toBeUndefined()
  })

  it("avec couverture : cover + center, l'URL citée", () => {
    const style = coverBannerStyle("https://s.ga/c.png?token=a b")
    expect(style).toEqual({
      backgroundImage: 'url("https://s.ga/c.png?token=a b")',
      backgroundSize: "cover",
      backgroundPosition: "center",
    })
  })

  it("une URL qui porte un guillemet ne sort pas de la fonction url()", () => {
    const style = coverBannerStyle('https://s.ga/c.png?x=")*{')
    expect(style?.backgroundImage).toBe(
      'url("https://s.ga/c.png?x=\\")*{")',
    )
  })

  it("aucune COULEUR n'est prononcée par ce module (cliquet de charte)", () => {
    const rendu = JSON.stringify([
      coverBannerStyle("https://s.ga/c.png"),
      coverBannerClassName("https://s.ga/c.png"),
      coverBannerClassName(null),
    ])
    expect(rendu).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rendu).not.toMatch(/\b(rgb|hsl|oklch)\(/)
  })
})

describe("textes du mur", () => {
  it("le mur vide dit une chose à son auteur, une autre au visiteur", () => {
    expect(wallEmptyText(true, t)).toBe("Vous n'avez encore rien publié.")
    expect(wallEmptyText(false, t)).toBe(
      "Aucune publication ne vous est ouverte ici.",
    )
  })

  it("une panne ne prétend jamais « rien publié »", () => {
    const { title, message } = wallErrorText(t)
    expect(title).toBe("Publications indisponibles")
    expect(message).not.toMatch(/rien publié|Aucune publication/)
  })

  it("la continuation est un geste explicite, nommé", () => {
    expect(wallLoadMoreLabel(t)).toBe("Voir plus de publications")
  })
})

describe("paramètres de vue de la fiche", () => {
  it("l'aperçu et la gestion se composent sur l'adresse du profil, sans route écrite ici", () => {
    expect(PROFILE_APERCU_PARAM).toBe("apercu")
    expect(PROFILE_MANAGE_PARAM).toBe("gerer")
    expect(profileApercuHref("/profil/awa")).toBe("/profil/awa?apercu=1")
    expect(profileManageHref("/profil/awa")).toBe("/profil/awa?gerer=1")
  })

  it("une adresse qui porte déjà une requête la garde", () => {
    expect(profileApercuHref("/profil/awa?onglet=albums")).toBe(
      "/profil/awa?onglet=albums&apercu=1",
    )
    expect(profileManageHref("/r/fiche?h=awa")).toBe("/r/fiche?h=awa&gerer=1")
  })
})

describe("profileErrorText — un refus se dit par son code, jamais par sa trace", () => {
  it("la règle du domaine d'abord, avec ses bornes", () => {
    const err = engineError({ code: "invalidArgument", rule: "HANDLE_LENGTH", params: { min: 3, max: 30 } })
    expect(profileErrorText(err, "reseau:profilPersonnePage.toast.followFailed", t)).toBe(
      "Un identifiant public compte entre 3 et 30 caractères.",
    )
  })

  it("puis le code du moteur", () => {
    expect(
      profileErrorText(engineError({ code: "handleUnavailable" }), "reseau:profilPersonnePage.toast.followFailed", t),
    ).toBe("Cet identifiant n'est pas disponible.")
  })

  it("sinon la phrase de l'écran — jamais le message brut d'un déploiement", () => {
    const err = new Error("Uncaught Error: stack trace du serveur")
    const text = profileErrorText(err, "reseau:profilPersonnePage.toast.followFailed", t)
    expect(text).toBe("L'action a échoué.")
    expect(text).not.toContain("stack")
  })
})
