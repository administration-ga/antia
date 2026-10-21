/**
 * U02 — opt-in ANTSIA seulement, après RESEAU_DESKTOP_CSS.
 * U09 (épure) : MÊME cadre que les autres pages de membre (member-navigation-styles
 * d'ANTSIA) — 1 400 px au plus, marges 16 puis 24 px, écart 16 puis 24 px, 24 px
 * en tête — : le rail ne bouge pas d'une page à l'autre ; le fil se centre dans
 * l'espace restant.
 * La largeur du viewport choisit la pose ; le conteneur décide si le contexte
 * de 312 px tient réellement. Les pages ordinaires défilent dans le document.
 * Le lecteur immersif garde son défileur dédié et sa mesure existante.
 */
export const RESEAU_ADAPTIVE_CSS = `
  .rp-scope[data-navigation-layout="adaptive"] {
    --rp-adaptive-nav-width: 96px;
    /* Bornes structurelles existantes de reseau-layout.ts. Le jeton de thème
       --esp-desktop-main-max peut valoir none : il ne convient pas dans calc. */
    --rp-adaptive-main-max: 792px;
    --rp-stack-gap: 16px;
    --rp-adaptive-gutter: 16px;
    --rp-adaptive-gap: 16px;
    height: auto;
    min-height: 0;
    overflow: visible;
    padding: 24px var(--rp-adaptive-gutter) 0;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-grid {
    grid-template-columns: var(--rp-adaptive-nav-width) minmax(0, 1fr);
    grid-template-rows: auto;
    gap: var(--rp-adaptive-gap);
    align-items: start;
    flex: 0 0 auto;
    height: auto;
    min-height: 0;
    width: 100%;
    /* 1 400 px marges comprises, comme .antsia-member-frame (box-sizing: border-box). */
    max-width: calc(1400px - 2 * var(--rp-adaptive-gutter));
    margin-inline: auto;
    overflow: visible;
    padding-bottom: 48px;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-main-col {
    min-width: 0;
    min-height: 0;
    width: 100%;
    justify-self: center;
    max-width: var(--rp-adaptive-main-max);
    overflow: visible;
    padding-bottom: 0;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-grid:is([data-main="people"], [data-main="pages"], [data-main="groups"], [data-main="bookmarks"]) {
    --rp-adaptive-main-max: 1120px;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-identity-region {
    position: static;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-rail-start,
  .rp-scope[data-navigation-layout="adaptive"] .rp-rail-end {
    min-width: 0;
    min-height: 0;
    max-height: none;
    overflow: visible;
    padding-bottom: 0;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-rail-start {
    display: flex;
    position: sticky;
    top: var(--esp-sticky-header-inset, 64px);
    max-height: calc(100dvh - var(--esp-sticky-header-inset, 64px));
    overflow-y: auto;
    padding-bottom: 24px;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-rail-end {
    display: none;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-main .rp-tabs {
    display: none;
  }
  /* Annule aussi la règle historique !important à 1108 px de conteneur. */
  .rp-scope[data-navigation-layout="adaptive"] .rp-desktop-icom-link {
    display: inline-flex !important;
  }
  @media (min-width: 1200px) {
    .rp-scope[data-navigation-layout="adaptive"] {
      --rp-adaptive-nav-width: 248px;
      --rp-adaptive-gutter: 24px;
      --rp-adaptive-gap: 24px;
    }
  }
  /* 248 + 24 + 672 + 24 + 312 = 1280 : le contexte n'écrase pas le fil.
     Les deux conditions sont nécessaires, même dans un hôte au viewport large. */
  @media (min-width: 1400px) {
    @container rp-page (min-width: 1280px) {
      .rp-scope[data-navigation-layout="adaptive"] .rp-grid {
        grid-template-columns: var(--rp-adaptive-nav-width) minmax(0, 1fr) 312px;
        max-width: calc(1400px - 2 * var(--rp-adaptive-gutter));
      }
      .rp-scope[data-navigation-layout="adaptive"] .rp-rail-end {
        display: flex;
      }
      .rp-scope[data-navigation-layout="adaptive"] .rp-desktop-icom-link {
        display: none !important;
      }
    }
  }
`
