// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-feed-pages.test.ts @ ad2e7fdc2 — adaptations : l'annonce du « Voir plus » est lue dans l'i18n du moteur (`t` français, et anglais pour un cas ajouté) ; tous les cas du socle portés.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  appendPage,
  initialFeedPages,
  loadMoreAnnouncement,
  mountedPageCount,
  rebasePagesAfter,
  recordTail,
  shouldShowLoadMore,
} from "./reseau-feed-pages"

const cursor = (publishedAt: number, postId: string) => ({ publishedAt, postId })

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

describe("chaîne de pages du fil", () => {
  it("démarre sur une page unique, sans curseur", () => {
    const state = initialFeedPages()
    expect(state.cursors).toEqual([null])
    expect(state.exhausted).toBe(false)
    expect(mountedPageCount(state)).toBe(1)
  })

  it("ne propose « Voir plus » qu'avec un curseur RÉEL", () => {
    const state = initialFeedPages()
    // La page n'a pas encore répondu : on ne propose pas une suite dont on
    // ignore l'existence. Proposer puis retirer serait pire qu'attendre.
    expect(shouldShowLoadMore(state, null)).toBe(false)
    expect(shouldShowLoadMore(state, cursor(1700, "a"))).toBe(true)
  })

  it("monte la page suivante et cesse alors de la proposer", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    expect(state.cursors).toEqual([null, cursor(1700, "a")])
    expect(shouldShowLoadMore(state, cursor(1700, "a"))).toBe(false)
    expect(shouldShowLoadMore(state, cursor(1600, "b"))).toBe(true)
  })

  it("est idempotent — un double-clic n'affiche pas deux fois la même page", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    const again = appendPage(state, cursor(1700, "a"))
    expect(again).toBe(state)
    expect(mountedPageCount(again)).toBe(2)
  })

  it("distingue deux curseurs au même instant par l'identifiant de publication", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "post-b"))
    state = appendPage(state, cursor(1700, "post-a"))
    expect(state.cursors).toEqual([null, cursor(1700, "post-b"), cursor(1700, "post-a")])
  })

  it("un curseur nul CLÔT la chaîne", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    state = appendPage(state, null)
    expect(state.exhausted).toBe(true)
    expect(state.cursors).toEqual([null, cursor(1700, "a")])
    expect(shouldShowLoadMore(state, cursor(1500, "b"))).toBe(false)
  })

  it("`recordTail` note la fin sans monter quoi que ce soit", () => {
    // Monter ici ferait du chargement automatique — c'est-à-dire le
    // défilement infini qu'on a écarté.
    let state = initialFeedPages()
    state = recordTail(state, null)
    expect(state.exhausted).toBe(true)
    expect(state.cursors).toEqual([null])
    expect(shouldShowLoadMore(state, cursor(1700, "a"))).toBe(false)
  })

  it("`recordTail` rouvre la chaîne si de nouvelles publications arrivent", () => {
    // Le fil est en temps réel : une page close peut cesser de l'être.
    let state = recordTail(initialFeedPages(), null)
    expect(state.exhausted).toBe(true)
    state = recordTail(state, cursor(1700, "a"))
    expect(state.exhausted).toBe(false)
    expect(shouldShowLoadMore(state, cursor(1700, "a"))).toBe(true)
  })

  it("ne recrée pas d'objet quand rien ne change", () => {
    const state = initialFeedPages()
    expect(recordTail(state, cursor(1700, "a"))).toBe(state)
    const closed = recordTail(state, null)
    expect(recordTail(closed, null)).toBe(closed)
  })

  it("les curseurs restent ordonnés du plus récent au plus ancien", () => {
    // `myFeed` pagine sur `publishedAt` décroissant : un curseur qui remonte
    // signalerait une chaîne cassée.
    let state = initialFeedPages()
    for (const point of [cursor(1700, "c"), cursor(1600, "b"), cursor(1500, "a")]) {
      state = appendPage(state, point)
    }
    const dated = state.cursors.filter((value): value is ReturnType<typeof cursor> => value !== null)
    expect(dated.map((value) => value.publishedAt)).toEqual([1700, 1600, 1500])
  })

  it("réaligne la page suivante quand une insertion déplace la frontière amont", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    state = appendPage(state, cursor(1600, "b"))

    const rebased = rebasePagesAfter(state, 0, cursor(1750, "nouvelle-frontiere"))

    expect(rebased).toEqual({
      cursors: [null, cursor(1750, "nouvelle-frontiere")],
      exhausted: false,
    })
  })

  it("ferme et tronque la chaîne si une page amont n'a plus de suite", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    state = appendPage(state, cursor(1600, "b"))

    expect(rebasePagesAfter(state, 0, null)).toEqual({
      cursors: [null],
      exhausted: true,
    })
  })

  it("ne recrée rien quand la frontière amont est inchangée", () => {
    let state = initialFeedPages()
    state = appendPage(state, cursor(1700, "a"))
    expect(rebasePagesAfter(state, 0, cursor(1700, "a"))).toBe(state)
  })

  it("annonce ce qui a été ajouté, pas l'intention", () => {
    expect(loadMoreAnnouncement(1, t)).toBe("1 publication de plus.")
    expect(loadMoreAnnouncement(20, t)).toBe("20 publications de plus.")
    expect(loadMoreAnnouncement(0, t)).toBe("Aucune publication supplémentaire.")
    expect(loadMoreAnnouncement(-1, t)).toBe("Aucune publication supplémentaire.")
  })

  it("annonce dans la langue de l'écran", () => {
    expect(loadMoreAnnouncement(1, tEn)).toBe("1 more post.")
    expect(loadMoreAnnouncement(20, tEn)).toBe("20 more posts.")
    expect(loadMoreAnnouncement(0, tEn)).toBe("No more posts.")
  })
})
