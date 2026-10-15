// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-layout.test.ts @ ad2e7fdc2 — adaptations : dépendance retirée `espace-rail-collapse` — la largeur du rail rétracté de l'hôte devient une constante locale (82 px, mesure du socle, cas le plus contraint) ; libellés lus dans l'i18n du moteur ; cliquets qui relisent la coque de bureau et les volets du socle absents du moteur à ce lot (`ReseauAgentPage`, `PeoplePanel`, `PagesPanel`, `GroupsPanel`, `ReseauMobileTabBar`) retirés, à rétablir avec eux ; ceux qui relisent la feuille mobile gardés, sur la constante qu'elle exporte (`RESEAU_MOBILE_CSS`) au lieu du texte source.
import { RESEAU_MOBILE_MAX_PX } from "@antia/ui/overlay"
import { describe, expect, it } from "vitest"

import { storyComposePose } from "../features/stories/story-create"
import { createAppI18n } from "../i18n"
import { RESEAU_MOBILE_CSS } from "./mobile/mobile-styles"
import {
  COLLAPSED_FEED_MIN,
  COLLAPSED_NAV_MIN,
  COLLAPSED_RAIL_END_MIN,
  COLLAPSED_THREE_COLUMN_MIN,
  COLLECTION_COLUMN_MAX,
  GRID_MAX_WIDTH,
  GRID_WITH_NAV_MAX_WIDTH,
  FEED_COLUMN_MAX,
  FEED_COLUMN_MIN,
  RAIL_END_WIDTH,
  RESEAU_COLUMN_GAP,
  RESEAU_NAV_RAIL_MIN_WIDTH,
  RESEAU_NAV_RAIL_WIDTH,
  SUGGESTIONS_AFTER,
  TABLET_COLUMN_MAX,
  TABLET_COLUMN_MIN,
  TABLET_WIDE_COLUMN_MAX,
  TABLET_WIDE_MIN,
  TWO_COLUMN_MIN,
  composeSheetPose,
  invitationsBannerLabel,
  isCollectionVolet,
  readingWidth,
  shouldSurfaceInvitations,
  suggestionsInterleaveIndex,
  viewHeading,
  viewNeedsReturn,
  viewReturnLabel,
  type FeedView,
} from "./reseau-layout"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/**
 * Le rail RÉTRACTÉ d'une application hôte, en pixels — la mesure du socle
 * (82 px). La coque légère du moteur n'en pose aucun : c'est donc le cas le
 * plus contraint qu'une application puisse imposer, et les paliers doivent y
 * tenir.
 */
const HOST_COLLAPSED_RAIL_PX = 82

/**
 * Les états transitoires du volet « fil ». `activity` et `people` n'y figurent
 * plus depuis le 2026-08-06 : ce sont des VOLETS (`reseau-agent-nav.ts`), rendus par
 * une bascule visible à tous les paliers, et non plus des surfaces à quitter.
 */
const ALL_VIEWS: FeedView[] = [
  { kind: "feed" },
  { kind: "tag", tag: "numerique" },
  { kind: "search", query: "note" },
  { kind: "post", postId: "abc" },
]

describe("seuils de la grille", () => {
  it("n'affiche le rail droit qu'avec 680 px de lecture disponibles", () => {
    const twoColumnFeed = TWO_COLUMN_MIN - RAIL_END_WIDTH - RESEAU_COLUMN_GAP
    expect(twoColumnFeed).toBe(FEED_COLUMN_MIN)
    expect(FEED_COLUMN_MIN).toBeGreaterThanOrEqual(680)
    expect(FEED_COLUMN_MAX).toBeLessThanOrEqual(792)
  })

  it("borne la grille au fil maximal + rail + gouttière", () => {
    expect(GRID_MAX_WIDTH).toBe(
      FEED_COLUMN_MAX + RAIL_END_WIDTH + RESEAU_COLUMN_GAP
    )
  })

  it("réserve au menu vertical une colonne sans réduire la lecture", () => {
    expect(COLLAPSED_NAV_MIN).toBe(
      RESEAU_NAV_RAIL_MIN_WIDTH + RESEAU_COLUMN_GAP + COLLAPSED_FEED_MIN
    )
    expect(COLLAPSED_THREE_COLUMN_MIN).toBe(
      COLLAPSED_NAV_MIN + RESEAU_COLUMN_GAP + COLLAPSED_RAIL_END_MIN
    )
    expect(GRID_WITH_NAV_MAX_WIDTH).toBe(
      RESEAU_NAV_RAIL_WIDTH + RESEAU_COLUMN_GAP + GRID_MAX_WIDTH
    )
  })

  it("choisit la bonne composition à 1 470 px et 1 280 px, rail rétracté", () => {
    // Sous le bureau, .rp-scope conserve une gouttière de 16 px par côté.
    const containerAt = (viewport: number) => viewport - HOST_COLLAPSED_RAIL_PX - 32

    expect(containerAt(1470)).toBeGreaterThanOrEqual(
      COLLAPSED_THREE_COLUMN_MIN
    )
    expect(containerAt(1280)).toBeGreaterThanOrEqual(COLLAPSED_NAV_MIN)
    expect(containerAt(1280)).toBeGreaterThanOrEqual(
      COLLAPSED_THREE_COLUMN_MIN
    )
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE CSS DOIT IMPLÉMENTER CE QUE CE MODULE DÉCLARE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les constantes ci-dessus sont REDÉCLARÉES dans la feuille de style de la
 * coquille (une propriété personnalisée n'est pas utilisable dans une
 * condition `@container`) — et c'est très exactement là que les deux peuvent
 * diverger sans qu'aucun typage ne le voie. Ce cliquet lit donc la feuille de
 * style elle-même (la constante exportée par `mobile/mobile-styles.tsx`).
 *
 * ⚠️ Au socle, il lisait aussi la grille de la page de BUREAU
 * (`ReseauAgentPage.tsx`) et les volets qui se désignent comme collections ;
 * ces fichiers n'existent pas encore dans le moteur. Leurs vérifications
 * reviennent avec eux — celles de la coquille MOBILE, présente, restent.
 *
 * `cssOf` rend le CSS d'une feuille, et RIEN d'autre : les commentaires, qui
 * contiennent des noms de classe, sont retirés avant toute recherche.
 */
function cssOf(sheet: string): string {
  return sheet.replace(/\/\*[\s\S]*?\*\//g, "")
}

describe("une largeur de lecture par TÂCHE (R-15)", () => {
  it("le palier large de la tablette rejoint le plancher du bureau", () => {
    // C'est tout l'objet du palier : 959 → 960 ne doit plus faire tomber un
    // article de 935 px à 646 px.
    expect(TABLET_WIDE_COLUMN_MAX).toBe(FEED_COLUMN_MIN)
    expect(TABLET_COLUMN_MAX).toBeLessThan(TABLET_WIDE_COLUMN_MAX)
    expect(TABLET_COLUMN_MIN).toBeLessThan(TABLET_WIDE_MIN)
    // Une collection peut occuper la page, jamais plus qu'elle.
    expect(COLLECTION_COLUMN_MAX).toBeGreaterThan(FEED_COLUMN_MAX)
    expect(COLLECTION_COLUMN_MAX).toBe(GRID_MAX_WIDTH)
  })

  it("borne l'ARTICLE, laisse courir la COLLECTION", () => {
    const fil = (containerWidth: number, viewport: "mobile" | "desktop") =>
      readingWidth({ containerWidth, volet: "fil", viewport })
    const relations = (containerWidth: number, viewport: "mobile" | "desktop") =>
      readingWidth({ containerWidth, volet: "relations", viewport })

    expect(fil(320, "mobile")).toBe(320)
    expect(fil(600, "mobile")).toBe(600)
    expect(fil(700, "mobile")).toBe(TABLET_COLUMN_MAX)
    expect(fil(935, "mobile")).toBe(TABLET_WIDE_COLUMN_MAX)
    // 960 px de viewport, rail ouvert : la page ne reçoit que 646 px.
    expect(fil(646, "desktop")).toBe(646)
    expect(fil(1280, "desktop")).toBe(FEED_COLUMN_MAX)

    expect(relations(935, "mobile")).toBe(935)
    expect(relations(1280, "desktop")).toBe(COLLECTION_COLUMN_MAX)
    expect(relations(646, "desktop")).toBe(646)
    for (const volet of ["pages", "groupes", "enregistrements"]) {
      expect(isCollectionVolet(volet)).toBe(true)
      expect(readingWidth({ containerWidth: 1280, volet, viewport: "desktop" })).toBe(
        COLLECTION_COLUMN_MAX
      )
    }
    expect(isCollectionVolet("fil")).toBe(false)
  })

  it("RECETTE 959 → 960 → 959 : plus de chute de 935 à 646", () => {
    // À 959 px de viewport, le scroller mobile reçoit ~935 px ; à 960, la page
    // du bureau n'en reçoit que 646 (rail de 264 + gouttières).
    const avant = readingWidth({ containerWidth: 935, volet: "fil", viewport: "mobile" })
    const apres = readingWidth({ containerWidth: 646, volet: "fil", viewport: "desktop" })
    expect(avant - apres).toBeLessThanOrEqual(60)
    // Et le retour est symétrique : aucun état à reconstruire, seule la
    // largeur change.
    expect(avant).toBe(TABLET_WIDE_COLUMN_MAX)
  })

  it("PROPRIÉTÉ — monotone, et changer d'arbre ne rétrécit jamais", () => {
    for (const volet of ["fil", "relations"]) {
      let mobilePrecedent = 0
      let bureauPrecedent = 0
      for (let w = 280; w <= 1600; w += 6) {
        const mobile = readingWidth({ containerWidth: w, volet, viewport: "mobile" })
        const bureau = readingWidth({ containerWidth: w, volet, viewport: "desktop" })
        expect(mobile).toBeGreaterThanOrEqual(mobilePrecedent)
        expect(bureau).toBeGreaterThanOrEqual(bureauPrecedent)
        // À conteneur ÉGAL, le bureau n'est jamais plus étroit que la
        // tablette. Au-delà de 959 px les deux arbres ne coexistent pas
        // (`mobile-shell.ts`) : les comparer y serait comparer une largeur
        // qui n'arrive jamais.
        if (w <= RESEAU_MOBILE_MAX_PX) {
          expect(bureau).toBeGreaterThanOrEqual(mobile)
        }
        mobilePrecedent = mobile
        bureauPrecedent = bureau
      }
    }
  })

  it("une largeur non mesurée n'est pas « très étroit »", () => {
    for (const containerWidth of [0, -12, Number.NaN]) {
      expect(readingWidth({ containerWidth, volet: "fil", viewport: "mobile" })).toBe(0)
    }
  })
})

describe("la coquille mobile implémente les paliers de R-15", () => {
  const mobile = cssOf(RESEAU_MOBILE_CSS)

  it("la tablette borne la lecture sans borner les collections", () => {
    expect(mobile).toContain("container-name: rp-page rm-scroll")
    expect(mobile).toContain(
      `@container rm-scroll (min-width: ${TABLET_COLUMN_MIN}px)`
    )
    expect(mobile).toContain(
      `@container rm-scroll (min-width: ${TABLET_WIDE_MIN}px)`
    )
    expect(mobile).toContain(`max-width: ${TABLET_COLUMN_MAX}px`)
    expect(mobile).toContain(`max-width: ${TABLET_WIDE_COLUMN_MAX}px`)
    expect(mobile).toContain(".rm-column:has([data-collection])")
    expect(mobile).toContain("max-width: none")
  })

  it("le débordement des sous-menus se VOIT", () => {
    // Sept sous-menus sur un téléphone : sans dégradé, la dernière
    // destination est coupée net et rien ne dit qu'il y en a d'autres.
    expect(mobile).toContain("mask-image")
  })
})

describe("invariant du redimensionnement", () => {
  it("TOUTE vue autre que le fil expose un retour", () => {
    for (const view of ALL_VIEWS) {
      if (view.kind === "feed") {
        expect(viewNeedsReturn(view)).toBe(false)
        expect(viewReturnLabel(view, t)).toBeNull()
      } else {
        // Sans cela, passer de 375 à 1440 px pendant qu'une surface remplace
        // le fil laisserait l'écran bloqué sur un panneau que la largeur ne
        // justifie plus.
        expect(viewNeedsReturn(view)).toBe(true)
        expect(viewReturnLabel(view, t)).toBe("Revenir au fil")
      }
    }
  })

  it("chaque surface se nomme, sauf le fil qui est le lieu par défaut", () => {
    expect(viewHeading({ kind: "feed" }, t)).toBeNull()
    for (const view of ALL_VIEWS.filter((v) => v.kind !== "feed")) {
      const heading = viewHeading(view, t)
      expect(heading).not.toBeNull()
      expect((heading ?? "").length).toBeGreaterThan(0)
    }
    expect(viewHeading({ kind: "tag", tag: "numerique" }, t)).toContain(
      "#numerique"
    )
  })
})

describe("entrelacement des suggestions", () => {
  it("intercale après la 3ᵉ publication quand le fil est assez long", () => {
    expect(suggestionsInterleaveIndex(10)).toBe(SUGGESTIONS_AFTER)
    expect(suggestionsInterleaveIndex(4)).toBe(SUGGESTIONS_AFTER)
  })

  it("n'intercale pas dans un fil court — la carte passerait pour du contenu", () => {
    for (const count of [0, 1, 2, 3]) {
      expect(suggestionsInterleaveIndex(count)).toBeNull()
    }
  })

  it("ne place jamais la carte en tête", () => {
    for (let count = 0; count <= 30; count++) {
      const index = suggestionsInterleaveIndex(count)
      if (index !== null) {
        expect(index).toBeGreaterThan(0)
        expect(index).toBeLessThan(count)
      }
    }
  })
})

describe("prérequis bloquants remontés au-dessus du fil", () => {
  it("les invitations reçues remontent dès la première", () => {
    expect(shouldSurfaceInvitations(1)).toBe(true)
    expect(shouldSurfaceInvitations(0)).toBe(false)
    expect(shouldSurfaceInvitations(undefined)).toBe(false)
  })

  it("le bandeau dit de QUOI il s'agit, et s'accorde", () => {
    expect(invitationsBannerLabel(1, t)).toBe("1 invitation en attente")
    expect(invitationsBannerLabel(3, t)).toBe("3 invitations en attente")
  })
})

describe("composeSheetPose", () => {
  it("carte au bureau, plein écran au téléphone et au premier rendu", () => {
    expect(composeSheetPose(false)).toBe("card")
    expect(composeSheetPose(true)).toBe("fullscreen")
    // `null` = SSR / premier passage : se tromper vers la carte ferait
    // clignoter deux géométries au chargement du téléphone.
    expect(composeSheetPose(null)).toBe("fullscreen")
  })

  it("CLIQUET — la pose des actus et celle des publications ne peuvent pas diverger", () => {
    // Publier une actu, un statut ou une publication sont trois portes d'un
    // même geste : trois géométries d'ouverture seraient trois produits.
    // Tant que les deux fonctions coexistent (cf. l'en-tête de
    // `composeSheetPose`), ce test interdit qu'une seule bouge.
    for (const input of [true, false, null] as const) {
      expect(composeSheetPose(input)).toBe(storyComposePose(input))
    }
  })
})
