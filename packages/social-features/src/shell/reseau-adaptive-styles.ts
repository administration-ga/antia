/**
 * U02 — opt-in ANTSIA seulement, après RESEAU_DESKTOP_CSS.
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
    height: auto;
    min-height: 0;
    overflow: visible;
    padding: 14px 16px 0;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-grid {
    grid-template-columns: var(--rp-adaptive-nav-width) minmax(0, 1fr);
    grid-template-rows: auto;
    gap: 16px;
    align-items: start;
    flex: 0 0 auto;
    height: auto;
    min-height: 0;
    max-width: min(1400px, calc(var(--rp-adaptive-nav-width) + 16px + var(--rp-adaptive-main-max)));
    overflow: visible;
    padding-bottom: 48px;
  }
  .rp-scope[data-navigation-layout="adaptive"] .rp-main-col {
    min-width: 0;
    min-height: 0;
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
      --rp-adaptive-nav-width: clamp(224px, 18vw, 248px);
    }
  }
  /* 248 + 16 + 688 + 16 + 312 = 1280 : le contexte n'écrase pas le fil.
     Les deux conditions sont nécessaires, même dans un hôte au viewport large. */
  @media (min-width: 1400px) {
    @container rp-page (min-width: 1280px) {
      .rp-scope[data-navigation-layout="adaptive"] .rp-grid {
        grid-template-columns: var(--rp-adaptive-nav-width) minmax(0, 1fr) 312px;
        max-width: min(1400px, calc(var(--rp-adaptive-nav-width) + 32px + var(--rp-adaptive-main-max) + 312px));
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
