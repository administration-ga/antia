// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/author-link.test.ts @ ad2e7fdc2 — adaptations : adresses par une table de routes injectée (celle du test, non celle de l'espace) ; libellés lus dans l'i18n du moteur (français) ; vocabulaire « page » au lieu d'« administration » ; deux cas ajoutés (une page sans route de page ne mène nulle part ; l'encodage est fait une seule fois, par ce module).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  authorBadgeLabel,
  authorHeadlineFor,
  authorHref,
  authorIsMutable,
  avatarShapeFor,
  pageHref,
  personHref,
  signedByLabel,
  type AuthorRoutes,
} from "./author-link"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** Une table de routes de test : l'application seule sait ses adresses. */
const ROUTES: Required<AuthorRoutes> = {
  profile: (handle) => `/profil/${handle}`,
  page: (handle) => `/pages/${handle}`,
}

/** Une personne du réseau, profil publié. */
const PERSONNE = { authorKind: "person", handle: "awa.ndong" } as const
/** Une page qui publie sous son propre nom. */
const PAGE = { authorKind: "page", handle: "min-economie" } as const

describe("où mène l'auteur", () => {
  it("mène une PERSONNE à son profil", () => {
    expect(personHref("awa.ndong", ROUTES.profile)).toBe("/profil/awa.ndong")
    expect(authorHref(PERSONNE, ROUTES)).toBe("/profil/awa.ndong")
  })

  it("mène une PAGE à sa page, jamais à un profil", () => {
    // Une page n'a pas de profil de personne : y mener afficherait un 404, ou
    // pire, le profil d'un homonyme.
    expect(pageHref("min-economie", ROUTES.page)).toBe("/pages/min-economie")
    expect(authorHref(PAGE, ROUTES)).toBe("/pages/min-economie")
    expect(authorHref(PAGE, ROUTES)).not.toContain("/profil/")
  })

  it("ne mène une PAGE nulle part tant que l'application ne sert pas les pages", () => {
    // Sans route de page, le seul repli possible serait le profil d'une
    // personne — une identité usurpée qui ne se voit pas.
    expect(authorHref(PAGE, { profile: ROUTES.profile })).toBeNull()
    expect(authorHref(PERSONNE, { profile: ROUTES.profile })).toBe("/profil/awa.ndong")
  })

  it("ENCODE une adresse accentuée — les deux routes", () => {
    // `min-économie` non encodé casse la route ; le « é » doit voyager en %C3%A9.
    expect(personHref("min-économie", ROUTES.profile)).toBe("/profil/min-%C3%A9conomie")
    expect(pageHref("min-économie", ROUTES.page)).toBe("/pages/min-%C3%A9conomie")
    expect(authorHref({ authorKind: "page", handle: "min-économie" }, ROUTES)).toBe("/pages/min-%C3%A9conomie")
  })

  it("ENCODE ce qui détournerait l'adresse", () => {
    // Une barre oblique non encodée ferait sortir du segment d'URL.
    expect(pageHref("dgi/interne", ROUTES.page)).toBe("/pages/dgi%2Finterne")
    expect(personHref("awa ndong", ROUTES.profile)).toBe("/profil/awa%20ndong")
    expect(personHref("a?b", ROUTES.profile)).toBe("/profil/a%3Fb")
  })

  it("passe à la table des routes un segment encodé UNE fois", () => {
    const seen: string[] = []
    personHref("é/1", (segment) => {
      seen.push(segment)
      return segment
    })
    expect(seen).toEqual(["%C3%A9%2F1"])
  })

  it("ne rend AUCUN lien sans adresse publiée — personne comme page", () => {
    // Sans publication il n'y a pas de page où aller, et un lien mort vaut
    // moins qu'un texte.
    expect(authorHref({ authorKind: "person", handle: null }, ROUTES)).toBeNull()
    expect(authorHref({ authorKind: "page", handle: null }, ROUTES)).toBeNull()
  })

  it("traite une adresse VIDE ou blanche comme absente", () => {
    // La base nue du profil aboutit ailleurs sans jamais se signaler comme cassée.
    expect(authorHref({ authorKind: "person", handle: "" }, ROUTES)).toBeNull()
    expect(authorHref({ authorKind: "page", handle: "   " }, ROUTES)).toBeNull()
  })
})

describe("genre ABSENT du DTO", () => {
  // Le JS neuf face à un backend encore ancien ne reçoit pas `authorKind` :
  // l'absence doit valoir « personne », jamais faire tomber la carte.
  it("mène au profil, comme avant les pages", () => {
    expect(authorHref({ handle: "awa.ndong" }, ROUTES)).toBe("/profil/awa.ndong")
  })

  it("ne pose aucun badge, garde le médaillon rond et laisse la sourdine", () => {
    const inconnu = { handle: "awa.ndong" }
    expect(authorBadgeLabel(inconnu, t)).toBeNull()
    expect(avatarShapeFor(inconnu)).toBe("round")
    expect(authorIsMutable(inconnu)).toBe(true)
  })
})

describe("badge d'en-tête", () => {
  it("annonce « Page officielle » sur une publication de page", () => {
    expect(authorBadgeLabel(PAGE, t)).toBe("Page officielle")
  })

  it("ne badge JAMAIS une personne", () => {
    // Un badge sur un avis personnel ferait croire que la page l'endosse.
    expect(authorBadgeLabel(PERSONNE, t)).toBeNull()
    expect(authorBadgeLabel({ authorKind: "person", handle: null }, t)).toBeNull()
  })
})

describe("intitulé sous le nom", () => {
  it("ne répète PAS le badge sur une page", () => {
    // Rendu en plus du badge, l'intitulé le dirait deux fois.
    expect(authorHeadlineFor({ authorKind: "page", headline: "Page officielle" }, t)).toBeNull()
  })

  it("garde l'accroche d'une personne", () => {
    expect(
      authorHeadlineFor(
        {
          authorKind: "person",
          headline: "Cheffe de service, MEF",
        },
        t,
      ),
    ).toBe("Cheffe de service, MEF")
  })

  it("tient un intitulé absent ou blanc pour absent", () => {
    expect(authorHeadlineFor({ authorKind: "person", headline: null }, t)).toBeNull()
    expect(authorHeadlineFor({ authorKind: "person", headline: "  " }, t)).toBeNull()
  })
})

describe("forme de la pastille", () => {
  it("rend une page en TUILE, jamais en médaillon", () => {
    // Un logo rogné en cercle perd son cadre et son sigle.
    expect(avatarShapeFor(PAGE)).toBe("square")
  })

  it("garde le médaillon rond pour une personne", () => {
    expect(avatarShapeFor(PERSONNE)).toBe("round")
  })
})

describe("mise en sourdine", () => {
  it("est FERMÉE sur une page", () => {
    // La sourdine vise une personne : sur une carte de page elle ferait taire
    // la signataire, pas la page.
    expect(authorIsMutable(PAGE)).toBe(false)
  })

  it("reste ouverte sur une personne", () => {
    expect(authorIsMutable(PERSONNE)).toBe(true)
  })
})

describe("mention de la signataire", () => {
  it("nomme la personne qui a signé, au passé", () => {
    expect(signedByLabel({ displayName: "Awa NDONG" }, t)).toBe("Publié par Awa NDONG")
  })

  it("ne dit rien quand personne n'a signé", () => {
    // `null` sur une publication de personne — l'autrice EST la signataire.
    expect(signedByLabel(null, t)).toBeNull()
  })

  it("ne dit rien quand la signataire n'a pas de profil publié", () => {
    // Le serveur rend `null` : l'identité n'est pas une publication. Et un
    // nom vide affirmerait une signature qu'on ne peut pas montrer.
    expect(signedByLabel({ displayName: "" }, t)).toBeNull()
    expect(signedByLabel({ displayName: "   " }, t)).toBeNull()
  })
})
