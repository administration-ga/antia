// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-layout.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; seuils et décisions inchangés ; libellés par l'i18n — `viewReturnLabel`, `viewHeading` et `invitationsBannerLabel` reçoivent `t` en DERNIER paramètre (clés qualifiées `reseau:reseauLayout.*`, pluriel par `count`) ; commentaires rapportés à la coque légère du moteur (plus de barre latérale de l'espace).
/**
 * reseau-layout — ce que la mise en page du fil DÉCIDE, hors de tout composant.
 *
 * Ce qui reste dans le corps d'un composant n'est vérifiable qu'à l'œil : les
 * décisions ci-dessous n'y restent donc pas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES SEUILS SE MESURENT SUR LE CONTENEUR, PAS SUR L'ÉCRAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le fil est rendu DANS le chrome de l'application hôte, qui peut confisquer
 * une barre latérale, auxquels s'ajoute le rembourrage de la page. Mesuré au
 * socle : à 882 px de viewport, sous une barre de 264 px, la page ne recevait
 * que 618 px.
 *
 * Conséquence, et c'est LA raison des container queries : un seuil
 * `@media (min-width: 960px)` donnait au fil une colonne de 300 px — plus
 * étroite que sur un iPhone SE. Le défaut n'était pas le chiffre, c'était
 * l'unité de mesure.
 *
 * Ces constantes sont exportées pour être LUES par les tests et par les
 * commentaires ; le CSS les redéclare, parce qu'une propriété personnalisée
 * n'est pas utilisable dans une condition `@container`.
 */

import type { TFunction } from "i18next"

/** Largeur du rail droit (découverte, activité). LinkedIn : 300 px. */
export const RAIL_END_WIDTH = 312
/** Largeur de lecture du fil, bornée comme une colonne sociale de bureau. */
export const FEED_COLUMN_MIN = 680
export const FEED_COLUMN_MAX = 792
/** Gouttière entre le fil et le rail de découverte. */
export const RESEAU_COLUMN_GAP = 16
/** Largeur du menu vertical du réseau quand le rail de l'hôte est rétracté. */
export const RESEAU_NAV_RAIL_WIDTH = 224
/** Planchers compacts : trois colonnes restent utiles à 1 280 px. */
export const RESEAU_NAV_RAIL_MIN_WIDTH = 176
export const COLLAPSED_FEED_MIN = 620
export const COLLAPSED_RAIL_END_MIN = 280
/** Au-delà : fil lisible + rail droit. En dessous, le rail reste retiré. */
export const TWO_COLUMN_MIN =
  FEED_COLUMN_MIN + RESEAU_COLUMN_GAP + RAIL_END_WIDTH
/**
 * À partir de ce palier, le rail rétracté peut céder 224 px au menu du réseau
 * tout en conservant une colonne de lecture complète. Le rail droit se retire
 * jusqu'au palier suivant : navigation et lecture priment sur la découverte.
 */
export const COLLAPSED_NAV_MIN =
  RESEAU_NAV_RAIL_MIN_WIDTH + RESEAU_COLUMN_GAP + COLLAPSED_FEED_MIN
/** Le menu, le fil et la découverte tiennent tous les trois. */
export const COLLAPSED_THREE_COLUMN_MIN =
  COLLAPSED_NAV_MIN + RESEAU_COLUMN_GAP + COLLAPSED_RAIL_END_MIN
/**
 * Le fil ne s'étale pas indéfiniment : au-delà, on ne lit plus une ligne.
 *
 * ⚠️ Valeur alignée sur le CSS le 2026-08-12 (elle annonçait 1200 quand la
 * feuille de style bornait à 1280). Ces constantes ne sont pas décoratives :
 * un cliquet de `reseau-layout.test.ts` confronte désormais chacune d'elles au
 * texte de la feuille de style, faute de quoi elles décrivent une mise en page
 * qui n'existe pas — ce fut le cas du palier à trois colonnes.
 */
export const GRID_MAX_WIDTH =
  FEED_COLUMN_MAX + RESEAU_COLUMN_GAP + RAIL_END_WIDTH
/** Borne de la grille lorsque le menu vertical rejoint les deux colonnes. */
export const GRID_WITH_NAV_MAX_WIDTH =
  RESEAU_NAV_RAIL_WIDTH + RESEAU_COLUMN_GAP + GRID_MAX_WIDTH

// ═══════════════════════════════════════════════════════════════════════════
// UNE LARGEUR DE LECTURE PAR TÂCHE — R-15
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La borne des COLLECTIONS au bureau : relations, pages, groupes,
 * enregistrements.
 *
 * 792 px est la largeur d'un ARTICLE — une ligne de texte qui reste lisible.
 * Une galerie de vignettes ou un catalogue de relations n'est pas un article :
 * la même borne y fabrique deux colonnes de tuiles là où l'écran en tient
 * quatre. La valeur reprend celle de `.rp-grid` (1120 px), déjà la borne de la
 * page entière : une collection peut occuper toute la page, jamais plus.
 */
export const COLLECTION_COLUMN_MAX = 1120

/**
 * Les paliers TABLETTE, mesurés sur le conteneur du scroller (`rm-scroll`).
 *
 * Sans eux, `.rm-column` est pleine largeur jusqu'à 959 px : mesuré le
 * 2026-09-06, un article de 935 px précédait immédiatement un article de
 * 646 px au premier pixel du bureau. Ce n'est pas un palier, c'est une chute.
 */
export const TABLET_COLUMN_MIN = 600
export const TABLET_COLUMN_MAX = 640
export const TABLET_WIDE_MIN = 820
/**
 * ⚠️ Le palier large de la tablette vaut exactement le PLANCHER de lecture du
 * bureau : c'est ce qui rend la bascule 959 → 960 continue (680 → 646 avec le
 * rail ouvert, au lieu de 935 → 646). Le dériver, plutôt que de le recopier,
 * interdit qu'un des deux bouge seul.
 */
export const TABLET_WIDE_COLUMN_MAX = FEED_COLUMN_MIN

/** Les volets qui sont des COLLECTIONS, et non des articles. */
export const COLLECTION_VOLETS: readonly string[] = Object.freeze([
  "relations",
  "pages",
  "groupes",
  "enregistrements",
])

export function isCollectionVolet(volet: string): boolean {
  return COLLECTION_VOLETS.includes(volet)
}

/**
 * La largeur SERVIE au contenu, pour une largeur de conteneur donnée.
 *
 * ⚠️ `viewport` ne dit pas la largeur de l'écran : il dit quel ARBRE est monté
 * (`mobile-shell.ts`, 959 px). Les deux arbres ne servent pas le même
 * conteneur au même moment — le bureau en cède 264 au rail —, et c'est
 * précisément pourquoi la continuité se vérifie ici et pas à l'œil.
 *
 * Une largeur non mesurée rend 0 : « pas encore de mise en page », jamais
 * « très étroit ».
 */
export function readingWidth(args: {
  containerWidth: number
  volet: string
  viewport: "mobile" | "desktop"
}): number {
  const { containerWidth, volet, viewport } = args
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0
  const collection = isCollectionVolet(volet)
  if (viewport === "desktop") {
    return Math.min(
      collection ? COLLECTION_COLUMN_MAX : FEED_COLUMN_MAX,
      containerWidth
    )
  }
  // Téléphone et tablette : la collection prend tout, l'article se borne.
  if (collection) return containerWidth
  if (containerWidth >= TABLET_WIDE_MIN) {
    return Math.min(TABLET_WIDE_COLUMN_MAX, containerWidth)
  }
  if (containerWidth >= TABLET_COLUMN_MIN) {
    return Math.min(TABLET_COLUMN_MAX, containerWidth)
  }
  return containerWidth
}

/**
 * Ce qu'on regarde DANS le volet « fil » — ses états transitoires.
 *
 * ⚠️ `activity` et `people` en faisaient partie jusqu'au 2026-08-06 : c'étaient
 * les SURFACES qui remplaçaient le fil sur une colonne, faute de rail. Ce sont
 * désormais des VOLETS à part entière (`reseau-agent-nav.ts`), rendus par une
 * bascule visible à tous les paliers — et non plus par deux boutons logés dans
 * les actions de l'en-tête. Le mécanisme est le même, généralisé et nommé.
 *
 * Ce type ne décrit donc plus que ce qui FILTRE le fil : un mot-clic, une
 * recherche, une publication ouverte. Tous se lèvent par « Revenir au fil ».
 */
export type FeedView =
  | { kind: "feed" }
  | { kind: "tag"; tag: string }
  | { kind: "search"; query: string }
  | { kind: "post"; postId: string }

/**
 * INVARIANT du redimensionnement : toute vue autre que le fil expose un retour.
 *
 * Sans lui, passer de 375 à 1440 px alors qu'un filtre remplace le fil
 * laisserait l'écran bloqué sur un contenu que la largeur ne justifie plus.
 * Le bouton de retour existant n'est donc masqué à AUCUN palier.
 */
export function viewNeedsReturn(view: FeedView): boolean {
  return view.kind !== "feed"
}

/** Ce que le retour annonce, selon ce qu'on quitte. */
export function viewReturnLabel(view: FeedView, t: TFunction): string | null {
  return viewNeedsReturn(view) ? t("reseau:reseauLayout.returnToFeed") : null
}

/** Titre du filtre courant — vide pour le fil, qui est le lieu par défaut. */
export function viewHeading(view: FeedView, t: TFunction): string | null {
  switch (view.kind) {
    case "feed":
      return null
    case "tag":
      return t("reseau:reseauLayout.heading.tag", { tag: view.tag })
    case "search":
      return t("reseau:reseauLayout.heading.search")
    case "post":
      return t("reseau:reseauLayout.heading.post")
  }
}

/**
 * Après combien de publications intercaler les suggestions, sur une colonne.
 *
 * C'est ce que font LinkedIn (« Ajouter à votre fil ») et Facebook
 * (« Suggestions pour vous ») : la découverte se consomme AU FIL du
 * défilement, jamais après lui — un bloc posé sous un fil infini n'est jamais
 * atteint.
 *
 * `null` quand le fil est trop court : intercaler après la 3ᵉ d'un fil qui en
 * compte deux poserait la carte en tête, là où elle passerait pour du contenu.
 */
export const SUGGESTIONS_AFTER = 3

export function suggestionsInterleaveIndex(postCount: number): number | null {
  return postCount > SUGGESTIONS_AFTER ? SUGGESTIONS_AFTER : null
}

/**
 * Les invitations reçues remontent-elles au-dessus du fil ?
 *
 * Une invitation est une action attendue DE MOI : elle ne dort pas derrière
 * une surface qu'il faut penser à ouvrir. LinkedIn la remonte aussi.
 */
export function shouldSurfaceInvitations(
  pendingCount: number | undefined
): boolean {
  return (pendingCount ?? 0) > 0
}

/** « 3 invitations en attente » — le nombre seul ne dit pas de quoi. */
export function invitationsBannerLabel(pendingCount: number, t: TFunction): string {
  return t("reseau:reseauLayout.invitationsBanner", { count: pendingCount })
}

// ═══════════════════════════════════════════════════════════════════════════
// LA POSE D'UN COMPOSEUR — plein écran né mobile, carte flottante au bureau
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Comment une surface de COMPOSITION se pose.
 *
 * Le téléphone impose le plein écran : le clavier prend la moitié de la
 * hauteur, et seule la surface immersive suit `--kb-inset`. Au bureau, un
 * formulaire étiré sur 1 600 px n'est pas une carte — d'où la carte flottante
 * compacte, sur le voile.
 *
 * `null` (rendu serveur / premier passage client) vaut plein écran : se
 * tromper vers la carte ferait clignoter deux géométries au chargement du
 * téléphone, quand l'inverse ne coûte qu'un voile tardif au bureau.
 *
 * ⚠️ `storyComposePose` (`stories/story-create.ts`) porte le MÊME arbitrage
 * pour le composeur d'actus. Les deux surfaces doivent s'ouvrir de la même
 * façon — un statut, une actu et une publication ne peuvent pas avoir trois
 * géométries. La fusion n'a pas été faite dans ce lot parce qu'une autre
 * session réécrit `story-create.ts` au même moment ; un test-cliquet
 * (`reseau-layout.test.ts`) verrouille l'égalité des deux fonctions en
 * attendant, de sorte qu'aucune ne peut dériver seule.
 */
export function composeSheetPose(
  isMobile: boolean | null
): "fullscreen" | "card" {
  return isMobile === false ? "card" : "fullscreen"
}
