// Dupliqué de socle/packages/agent-features/src/components/espace-kit/espace-pagination.test.ts @ ad2e7fdc2 — adaptations : les phrases ne vivent plus dans le module (le paquet n'a pas d'i18n) — `paginationSummary` et `pageAriaLabel` reçoivent les libellés de l'appelant, ici un jeu FRANÇAIS de test qui reprend mot pour mot les phrases du socle : les 29 cas et leurs attentes sont inchangés ; cas ajoutés : la tranche transmise aux libellés porte les nombres bornés, et une autre langue ne change que les mots.
import { describe, expect, it } from "vitest"
import {
  clampPage,
  type EspacePaginationLabels,
  pageAriaLabel,
  pageCount,
  pageSlice,
  pageWindow,
  paginationSummary,
  shouldPaginate,
} from "./espace-pagination"

/**
 * Les phrases du socle, telles qu'un écran français les traduit : le module
 * choisit la phrase et ses nombres, l'appelant fournit la langue.
 */
const FR: EspacePaginationLabels = {
  navigation: (list) => `Pagination — ${list}`,
  previous: "Précédent",
  next: "Suivant",
  page: (page, count) => `Page ${page} sur ${count}`,
  currentPage: (page, count) => `Page ${page} sur ${count}, page actuelle`,
  empty: "Aucun élément",
  single: "1 élément",
  range: ({ page, count, start, end, total }) =>
    `Page ${page} sur ${count} — ${start} à ${end} sur ${total}`,
}

describe("pageCount", () => {
  it("une liste vide compte quand même une page", () => {
    expect(pageCount(0, 10)).toBe(1)
  })

  it("arrondit au lot supérieur", () => {
    expect(pageCount(87, 12)).toBe(8)
    expect(pageCount(50, 10)).toBe(5)
    expect(pageCount(11, 10)).toBe(2)
  })

  it("une taille de page nulle ou négative ne casse rien — une seule page", () => {
    expect(pageCount(50, 0)).toBe(1)
    expect(pageCount(50, -3)).toBe(1)
  })
})

describe("clampPage", () => {
  it("relève une page sous la borne basse", () => {
    expect(clampPage(0, 87, 12)).toBe(1)
    expect(clampPage(-5, 87, 12)).toBe(1)
  })

  it("redescend une page au-delà de la dernière", () => {
    expect(clampPage(999, 87, 12)).toBe(8)
  })

  it("laisse passer une page déjà valide", () => {
    expect(clampPage(3, 87, 12)).toBe(3)
  })

  it("une valeur non finie retombe sur la première page", () => {
    expect(clampPage(Number.NaN, 87, 12)).toBe(1)
  })
})

describe("pageSlice", () => {
  const items = Array.from({ length: 87 }, (_, index) => index + 1)

  it("découpe un lot plein", () => {
    expect(pageSlice(items, 1, 12)).toEqual(range(1, 12))
    expect(pageSlice(items, 2, 12)).toEqual(range(13, 24))
  })

  it("le dernier lot est partiel", () => {
    // 87 = 7 lots de 12 + 3 : la 8e page ne porte que 3 éléments.
    expect(pageSlice(items, 8, 12)).toEqual([85, 86, 87])
  })

  it("applique le bornage AVANT de découper — une page hors bornes rend la dernière page réelle", () => {
    expect(pageSlice(items, 999, 12)).toEqual([85, 86, 87])
    expect(pageSlice(items, -3, 12)).toEqual(range(1, 12))
  })

  it("une taille de page nulle rend tout, sans exploser", () => {
    expect(pageSlice([1, 2, 3], 1, 0)).toEqual([1, 2, 3])
  })
})

describe("shouldPaginate", () => {
  it("faux quand tout tient dans une seule page", () => {
    expect(shouldPaginate(8, 10)).toBe(false)
  })

  it("faux à l'égalité — un lot pile plein ne se découpe pas", () => {
    expect(shouldPaginate(10, 10)).toBe(false)
  })

  it("vrai dès qu'un élément dépasse", () => {
    expect(shouldPaginate(11, 10)).toBe(true)
  })

  it("faux sur une taille de page nulle ou négative", () => {
    expect(shouldPaginate(50, 0)).toBe(false)
    expect(shouldPaginate(50, -1)).toBe(false)
  })
})

describe("pageWindow", () => {
  it("montre tout, sans trou, quand le total tient dans le budget", () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("place un trou à droite près du début", () => {
    expect(pageWindow(1, 100)).toEqual([1, 2, 3, 4, 5, "gap", 100])
  })

  it("place un trou à gauche près de la fin", () => {
    expect(pageWindow(100, 100)).toEqual([1, "gap", 96, 97, 98, 99, 100])
  })

  it("place deux trous quand la page courante est loin des deux bornes", () => {
    expect(pageWindow(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100])
  })

  it("n'affiche jamais un trou pour un seul numéro manquant", () => {
    // total=7 tient tout entier dans le budget par défaut : aucun trou.
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // total=8 déborde d'une unité : le trou qui apparaît masque bien DEUX
    // pages (6 et 7), jamais une seule.
    expect(pageWindow(1, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8])
  })

  it("respecte un width personnalisé", () => {
    const window = pageWindow(50, 100, 7)
    // width=7 → 2 voisins de chaque côté de la page courante.
    expect(window).toEqual([1, "gap", 48, 49, 50, 51, 52, "gap", 100])
    expect(window.length).toBeLessThanOrEqual(7 + 2)
  })

  it("respecte les invariants sur un large échantillon de (current, count)", () => {
    const width = 5
    for (const count of [1, 2, 3, 5, 7, 8, 10, 25, 50, 100, 137]) {
      for (let current = 1; current <= count; current += 1) {
        const window = pageWindow(current, count, width)

        // La première et la dernière page sont toujours présentes.
        expect(window[0]).toBe(1)
        expect(window[window.length - 1]).toBe(count)

        // La page courante est toujours présente.
        expect(window).toContain(current)

        // Longueur bornée par width + 2.
        expect(window.length).toBeLessThanOrEqual(width + 2)

        for (let index = 0; index < window.length - 1; index += 1) {
          const left = window[index]!
          const right = window[index + 1]!

          // Jamais deux trous adjacents.
          expect(left === "gap" && right === "gap").toBe(false)

          if (left !== "gap" && right !== "gap") {
            // Deux numéros voisins SANS trou entre eux sont deux pages
            // consécutives — sinon un trou manque silencieusement.
            expect(right - left).toBe(1)
          }
        }

        // Un trou représente toujours une omission d'AU MOINS deux pages :
        // les deux numéros qui l'encadrent sont donc distants d'au moins 3.
        window.forEach((entry, index) => {
          if (entry !== "gap") return
          const before = window[index - 1]
          const after = window[index + 1]
          expect(typeof before).toBe("number")
          expect(typeof after).toBe("number")
          expect((after as number) - (before as number)).toBeGreaterThanOrEqual(3)
        })
      }
    }
  })
})

describe("paginationSummary", () => {
  it("l'exemple canonique", () => {
    expect(paginationSummary(2, 12, 87, FR)).toBe(
      "Page 2 sur 8 — 13 à 24 sur 87",
    )
  })

  it("la liste vide n'énonce aucune borne", () => {
    expect(paginationSummary(1, 12, 0, FR)).toBe("Aucun élément")
  })

  it("un seul élément — pas de bornes à situer", () => {
    expect(paginationSummary(1, 12, 1, FR)).toBe("1 élément")
  })

  it("borne le dernier lot partiel sur le total réel, pas sur pageSize", () => {
    expect(paginationSummary(8, 12, 87, FR)).toBe(
      "Page 8 sur 8 — 85 à 87 sur 87",
    )
  })

  it("clampe une page hors bornes avant d'énoncer", () => {
    expect(paginationSummary(999, 12, 87, FR)).toBe(
      "Page 8 sur 8 — 85 à 87 sur 87",
    )
  })

  it("transmet aux libellés une tranche aux nombres déjà bornés", () => {
    const ranges: unknown[] = []
    paginationSummary(-4, 12, 87, {
      ...FR,
      range: (range) => {
        ranges.push(range)
        return ""
      },
    })
    expect(ranges).toEqual([{ page: 1, count: 8, start: 1, end: 12, total: 87 }])
  })

  it("une autre langue ne change que les mots, jamais la décision", () => {
    const EN: EspacePaginationLabels = {
      ...FR,
      empty: "No items",
      single: "1 item",
      range: ({ page, count, start, end, total }) =>
        `Page ${page} of ${count} — ${start} to ${end} of ${total}`,
    }
    expect(paginationSummary(2, 12, 87, EN)).toBe("Page 2 of 8 — 13 to 24 of 87")
    expect(paginationSummary(1, 12, 0, EN)).toBe("No items")
    expect(paginationSummary(1, 12, 1, EN)).toBe("1 item")
  })
})

describe("pageAriaLabel", () => {
  it("le libellé simple", () => {
    expect(pageAriaLabel(2, 5, false, FR)).toBe("Page 2 sur 5")
  })

  it("double le libellé pour la page actuelle", () => {
    expect(pageAriaLabel(2, 5, true, FR)).toBe("Page 2 sur 5, page actuelle")
  })
})

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => index + start)
}
