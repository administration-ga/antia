// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/bookmarks-panel.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans l'i18n du moteur (`t` en dernier paramètre) ; les deux cas du socle portés ; cas ajoutés pour l'identité d'un aperçu (page, auteur, nom neutre) et la lecture des refus du moteur.
/**
 * bookmarks-panel — ce que le volet Enregistrements décide, vérifié :
 *
 *  1. l'état vide EXPLIQUE le geste qui remplit la liste ;
 *  2. le décompte accorde correctement, 0 compris ;
 *  3. l'en-tête d'un aperçu dit QUI parle — la page, l'auteur, ou un nom neutre.
 */
import type { Id } from "@antia/api/engine"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { bookmarkIdentity, bookmarksCountLabel, emptyBookmarksText, markActionErrorText, type BookmarkedPostSummary } from "./bookmarks-panel"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

describe("emptyBookmarksText", () => {
  it("explique comment enregistrer une publication", () => {
    const text = emptyBookmarksText(t)
    expect(text.length).toBeGreaterThan(0)
    // Le mode d'emploi est la moitié du message : sans lui, l'écran dit
    // seulement « c'est vide » sans dire comment le peupler.
    expect(text).toContain("Enregistrer")
  })
})

describe("bookmarksCountLabel", () => {
  it("accorde au singulier à 1, au pluriel ailleurs — 0 compris", () => {
    expect(bookmarksCountLabel(0, t)).toBe("0 publications enregistrées")
    expect(bookmarksCountLabel(1, t)).toBe("1 publication enregistrée")
    expect(bookmarksCountLabel(2, t)).toBe("2 publications enregistrées")
    expect(bookmarksCountLabel(42, t)).toBe("42 publications enregistrées")
  })

  it("se traduit avec le même accord", () => {
    expect(bookmarksCountLabel(1, tEn)).toBe("1 saved post")
    expect(bookmarksCountLabel(0, tEn)).toBe("0 saved posts")
  })
})

describe("bookmarkIdentity — qui parle en tête de l'aperçu", () => {
  /** L'adresse de la photo servie par la garde des fichiers — opaque pour l'écran. */
  const AVATAR = "fichiers/awa-portrait"
  const author: BookmarkedPostSummary["author"] = {
    personId: "persons_awa" as Id<"persons">,
    displayName: "Awa Ndong",
    handle: "awa",
    avatarUrl: AVATAR,
  }

  it("une publication de personne : l'auteur, en médaillon", () => {
    expect(bookmarkIdentity({ author, page: null }, t)).toEqual({ name: "Awa Ndong", imageUrl: AVATAR, hasIdentity: true, shape: "round" })
  })

  it("une publication de page : la PAGE, jamais son signataire", () => {
    const page: NonNullable<BookmarkedPostSummary["page"]> = {
      pageId: "pages_mairie" as Id<"pages">,
      networkId: "networks_test" as Id<"networks">,
      handle: "mairie",
      name: "Mairie de Libreville",
      shortName: null,
      logoUrl: null,
      badge: "official",
      ownerKind: "institution",
      country: null,
    }
    const identity = bookmarkIdentity({ author, page }, t)
    expect(identity.name).toBe("Mairie de Libreville")
    expect(identity.shape).toBe("square")
    expect(identity.name).not.toBe("Awa Ndong")
  })

  it("une personne sans profil publié : un nom neutre, sans initiales inventées", () => {
    const identity = bookmarkIdentity({ author: { ...author, displayName: null }, page: null }, t)
    expect(identity).toEqual({ name: "Personne du réseau", imageUrl: AVATAR, hasIdentity: false, shape: "round" })
  })
})

describe("un refus du moteur se dit par son code, jamais par sa trace", () => {
  const FALLBACK = "reseau:bookmarksPanel.toast.removeFailed"

  it("le débit se dit ; le refus indistinct garde la phrase du geste", () => {
    expect(markActionErrorText(new ConvexError({ code: "rateLimited" }), FALLBACK, t)).toBe(t("errors:rateLimited"))
    expect(markActionErrorText(new ConvexError({ code: "notFound" }), FALLBACK, t)).toBe("Impossible de retirer cette publication.")
    expect(markActionErrorText(new Error("Server Error"), FALLBACK, t)).toBe("Impossible de retirer cette publication.")
  })
})
