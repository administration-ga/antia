// Dupliqué de socle/convex/modules/reseauAlbums/domain.test.ts @ ad2e7fdc2 — adaptations : refus lus par leur CODE de règle et leurs bornes (`DomainViolation`) au lieu des phrases ; cas inchangés.
/**
 * Le domaine des albums — la MATRICE de visibilité d'abord.
 *
 * C'est le test de sécurité de la tranche : `isAlbumVisibleTo` est la seule
 * règle, et toute évolution du scoping doit faire évoluer cette matrice. Le
 * reste vérifie que les bornes refusent, et que le réordonnancement refuse un
 * ordre qui ne correspond plus.
 */
import { describe, expect, it } from "vitest"

import {
  ALBUM_ADD_BATCH_MAX,
  ALBUM_ALT_TEXT_MAX,
  ALBUM_CAPTION_MAX,
  ALBUM_DESCRIPTION_MAX,
  ALBUM_ITEMS_MAX,
  ALBUM_ITEMS_SCAN_MAX,
  ALBUM_PAGE_MAX,
  ALBUM_STATUSES,
  ALBUM_TITLE_MAX,
  type AlbumAudience,
  type AlbumStatus,
  assertAlbumAltText,
  assertAlbumCapacity,
  assertAlbumCaption,
  assertAlbumDescription,
  assertAlbumMedia,
  assertAlbumPublishable,
  assertAlbumTitle,
  assertAlbumWithdrawable,
  isAlbumVisibleTo,
  nextPosition,
  reorderPositions,
  resolveCoverId,
} from "./albums"
import { DomainViolation } from "./violation"

const LECTEURS = {
  proprietaire: { isOwner: true, isConnected: false, isBlocked: false },
  connexion: { isOwner: false, isConnected: true, isBlocked: false },
  inconnu: { isOwner: false, isConnected: false, isBlocked: false },
  bloque: { isOwner: false, isConnected: true, isBlocked: true },
} as const

function violationOf(run: () => unknown): DomainViolation | null {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof DomainViolation ? error : null
  }
}

const codeOf = (run: () => unknown) => violationOf(run)?.code ?? null

describe("isAlbumVisibleTo — LA matrice", () => {
  it("un BROUILLON n'est lisible que de son propriétaire, quelle que soit l'audience", () => {
    for (const audience of ["public", "connections"] as AlbumAudience[]) {
      expect(isAlbumVisibleTo({ audience, status: "draft", ...LECTEURS.proprietaire })).toBe(true)
      for (const lecteur of ["connexion", "inconnu", "bloque"] as const) {
        expect(isAlbumVisibleTo({ audience, status: "draft", ...LECTEURS[lecteur] })).toBe(false)
      }
    }
  })

  it("un album RETIRÉ se referme sur son propriétaire", () => {
    expect(isAlbumVisibleTo({ audience: "public", status: "withdrawn", ...LECTEURS.proprietaire })).toBe(true)
    expect(isAlbumVisibleTo({ audience: "public", status: "withdrawn", ...LECTEURS.inconnu })).toBe(false)
  })

  it("publié + public : tout le réseau, sauf un blocage", () => {
    expect(isAlbumVisibleTo({ audience: "public", status: "published", ...LECTEURS.inconnu })).toBe(true)
    expect(isAlbumVisibleTo({ audience: "public", status: "published", ...LECTEURS.bloque })).toBe(false)
  })

  it("publié + connexions : la connexion ACCEPTÉE, et personne d'autre", () => {
    expect(isAlbumVisibleTo({ audience: "connections", status: "published", ...LECTEURS.connexion })).toBe(true)
    expect(isAlbumVisibleTo({ audience: "connections", status: "published", ...LECTEURS.inconnu })).toBe(false)
  })

  it("le BLOCAGE l'emporte sur la connexion — dans un sens comme dans l'autre", () => {
    for (const audience of ["public", "connections"] as AlbumAudience[]) {
      for (const status of ALBUM_STATUSES) expect(isAlbumVisibleTo({ audience, status, ...LECTEURS.bloque })).toBe(false)
    }
  })

  it("le propriétaire voit TOUJOURS son album, dans les trois états", () => {
    for (const status of ALBUM_STATUSES) expect(isAlbumVisibleTo({ audience: "connections", status, ...LECTEURS.proprietaire })).toBe(true)
  })

  it("couvre les 3 états × 2 audiences × 4 lecteurs sans jamais rendre `undefined`", () => {
    let compte = 0
    for (const status of ALBUM_STATUSES) {
      for (const audience of ["public", "connections"] as AlbumAudience[]) {
        for (const lecteur of Object.values(LECTEURS)) {
          expect(typeof isAlbumVisibleTo({ audience, status, ...lecteur })).toBe("boolean")
          compte += 1
        }
      }
    }
    expect(compte).toBe(24)
  })
})

describe("bornes — un plafond qui n'est pas celui de la publication", () => {
  it("60 photos par album, pas 4", () => {
    expect(ALBUM_ITEMS_MAX).toBe(60)
    expect(ALBUM_ITEMS_MAX).toBeGreaterThan(4)
  })

  it("la fenêtre de lecture est PLUS LARGE que le plafond", () => {
    expect(ALBUM_ITEMS_SCAN_MAX).toBeGreaterThan(ALBUM_ITEMS_MAX)
  })

  it("les autres bornes sont celles annoncées par l'ADR", () => {
    expect(ALBUM_TITLE_MAX).toBe(120)
    expect(ALBUM_DESCRIPTION_MAX).toBe(600)
    expect(ALBUM_CAPTION_MAX).toBe(300)
    expect(ALBUM_ALT_TEXT_MAX).toBe(300)
    expect(ALBUM_ADD_BATCH_MAX).toBe(12)
    expect(ALBUM_PAGE_MAX).toBe(24)
  })

  it("le plafond se juge sur le total, pas sur le lot", () => {
    expect(() => assertAlbumCapacity({ current: ALBUM_ITEMS_MAX - 1, adding: 1 })).not.toThrow()
    expect(violationOf(() => assertAlbumCapacity({ current: ALBUM_ITEMS_MAX, adding: 1 }))).toMatchObject({ code: "ALBUM_FULL", params: { max: 60 } })
  })
})

describe("refus de forme", () => {
  it("un titre est obligatoire, et une chaîne d'espaces n'est pas un titre", () => {
    expect(assertAlbumTitle("  Mission Oyem  ")).toBe("Mission Oyem")
    expect(codeOf(() => assertAlbumTitle("   "))).toBe("ALBUM_TITLE_REQUIRED")
    expect(violationOf(() => assertAlbumTitle("x".repeat(ALBUM_TITLE_MAX + 1)))).toMatchObject({ code: "ALBUM_TITLE_TOO_LONG", params: { max: 120 } })
  })

  it("description, légende et texte alternatif : une chaîne d'espaces vaut ABSENCE", () => {
    expect(assertAlbumDescription("   ")).toBeUndefined()
    expect(assertAlbumCaption(undefined)).toBeUndefined()
    expect(assertAlbumAltText("  ")).toBeUndefined()
    expect(assertAlbumCaption(" Vue du chantier ")).toBe("Vue du chantier")
  })

  it("chaque borne de texte refuse au caractère près", () => {
    expect(violationOf(() => assertAlbumDescription("x".repeat(ALBUM_DESCRIPTION_MAX + 1)))).toMatchObject({ code: "ALBUM_DESCRIPTION_TOO_LONG", params: { max: 600 } })
    expect(violationOf(() => assertAlbumCaption("x".repeat(ALBUM_CAPTION_MAX + 1)))).toMatchObject({ code: "ALBUM_CAPTION_TOO_LONG", params: { max: 300 } })
    expect(violationOf(() => assertAlbumAltText("x".repeat(ALBUM_ALT_TEXT_MAX + 1)))).toMatchObject({ code: "ALBUM_ALT_TOO_LONG", params: { max: 300 } })
    expect(assertAlbumCaption("x".repeat(ALBUM_CAPTION_MAX))).toHaveLength(ALBUM_CAPTION_MAX)
  })

  it("porte un CODE de refus — le texte vit dans les locales de l'écran", () => {
    const violation = violationOf(() => assertAlbumTitle(""))
    expect(violation).toBeInstanceOf(DomainViolation)
    expect(violation?.code).toBe("ALBUM_TITLE_REQUIRED")
  })
})

describe("assertAlbumMedia — images SEULEMENT en V1", () => {
  const image = { mimeType: "image/jpeg", sizeBytes: 1024 }

  it("accepte un lot d'images", () => {
    expect(() => assertAlbumMedia([image, image, image])).not.toThrow()
  })

  it("refuse un lot vide", () => {
    expect(codeOf(() => assertAlbumMedia([]))).toBe("ALBUM_ITEMS_EMPTY")
  })

  it("refuse une vidéo, même bien formée — un album n'en porte pas", () => {
    expect(codeOf(() => assertAlbumMedia([{ mimeType: "video/mp4", sizeBytes: 1024 }]))).toBe("ALBUM_MEDIA_MIME_INVALID")
  })

  it("refuse un type qui n'est pas une image acceptée", () => {
    expect(codeOf(() => assertAlbumMedia([{ mimeType: "text/plain", sizeBytes: 12 }]))).toBe("ALBUM_MEDIA_MIME_INVALID")
  })

  it("refuse une taille nulle ou hors borne — la borne dite en mégaoctets", () => {
    expect(violationOf(() => assertAlbumMedia([{ mimeType: "image/png", sizeBytes: 0 }]))).toMatchObject({ code: "ALBUM_MEDIA_TOO_LARGE", params: { maxMb: 20 } })
    expect(codeOf(() => assertAlbumMedia([{ mimeType: "image/png", sizeBytes: 20 * 1024 * 1024 + 1 }]))).toBe("ALBUM_MEDIA_TOO_LARGE")
  })

  it("borne le LOT, pour que la reprise reste le chemin normal", () => {
    const lot = Array.from({ length: ALBUM_ADD_BATCH_MAX + 1 }, () => image)
    expect(violationOf(() => assertAlbumMedia(lot))).toMatchObject({ code: "ALBUM_BATCH_TOO_LARGE", params: { max: 12 } })
  })
})

describe("transitions", () => {
  it("un album VIDE ne se publie pas", () => {
    expect(codeOf(() => assertAlbumPublishable({ status: "draft", itemCount: 0 }))).toBe("ALBUM_EMPTY")
    expect(() => assertAlbumPublishable({ status: "draft", itemCount: 1 })).not.toThrow()
  })

  it("seul un album PUBLIÉ se retire", () => {
    expect(() => assertAlbumWithdrawable("published")).not.toThrow()
    for (const status of ["draft", "withdrawn"] as AlbumStatus[]) expect(codeOf(() => assertAlbumWithdrawable(status))).toBe("ALBUM_NOT_PUBLISHED")
  })
})

describe("ordre", () => {
  it("nextPosition suit le maximum, jamais le décompte", () => {
    expect(nextPosition([])).toBe(0)
    // Après un retrait, le décompte serait 2 et écraserait la position 2.
    expect(nextPosition([0, 2])).toBe(3)
  })

  it("réordonne et ne rend QUE ce qui bouge", () => {
    const current = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]
    expect(reorderPositions(current, ["a", "b", "c"])).toEqual([])
    expect(reorderPositions(current, ["c", "a", "b"])).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ])
  })

  it("compacte les positions à trous sans qu'on le demande", () => {
    const current = [
      { id: "a", position: 0 },
      { id: "b", position: 7 },
    ]
    expect(reorderPositions(current, ["a", "b"])).toEqual([{ id: "b", position: 1 }])
  })

  it("refuse un ordre PARTIEL, un doublon ou un inconnu — le lot entier", () => {
    const current = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]
    for (const demande of [["a"], ["a", "a"], ["a", "b", "z"], ["z", "y"]]) expect(codeOf(() => reorderPositions(current, demande))).toBe("ALBUM_REORDER_MISMATCH")
  })

  it("un album vide se réordonne sans rien faire", () => {
    expect(reorderPositions([], [])).toEqual([])
  })
})

describe("resolveCoverId — une préférence, jamais une vignette morte", () => {
  const items = [{ id: "a" }, { id: "b" }]

  it("honore le choix quand la photo vit encore", () => {
    expect(resolveCoverId(items, "b")).toBe("b")
  })

  it("replie sur la PREMIÈRE photo quand le choix a été retiré", () => {
    expect(resolveCoverId(items, "disparue")).toBe("a")
  })

  it("replie sur la première photo quand aucun choix n'a été fait", () => {
    expect(resolveCoverId(items, undefined)).toBe("a")
  })

  it("un album sans photo n'a pas de couverture", () => {
    expect(resolveCoverId([], "a")).toBeUndefined()
  })
})
