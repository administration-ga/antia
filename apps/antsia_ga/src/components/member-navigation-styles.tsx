/**
 * U02 : styles propres à ANTSIA ; les thèmes et les seuils des autres réseaux restent intacts.
 * U09 (épure) : un seul cadre pour toutes les pages de membre ET le fil (reseau-adaptive-styles
 * du moteur) — 1 400 px au plus, marges 12/16/24 px, écart 16/24 px, 24 px en tête dès 768 px —,
 * et la barre du haut aligne ses bords sur ce cadre.
 */
const MEMBER_NAVIGATION_CSS = `
  .antsia-topbar-row {
    box-sizing: border-box;
    width: 100%;
    max-width: 1400px;
    margin-inline: auto;
    padding-inline: 12px;
  }
  .antsia-member-frame {
    box-sizing: border-box;
    width: 100%;
    max-width: 1400px;
    min-width: 0;
    margin-inline: auto;
    padding-inline: 12px;
  }
  .antsia-member-rail { display: none; }
  .antsia-member-content {
    min-width: 0;
    padding-block: 16px;
  }
  .antsia-member-frame[data-with-navigation] > .antsia-member-content {
    padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px));
  }
  .antsia-member-frame[data-workspace] {
    flex: 1 1 auto;
    min-height: 0;
  }
  .antsia-member-frame[data-workspace] > .antsia-member-content {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding-block: 0;
  }
  /* La barre globale remplace la barre locale d'iCom en U02. Ses trois vues
     restent accessibles dans leur navigation, y compris sur téléphone. */
  .antsia-member-workspace .icom-messages-page[data-mobile="true"] .icom-page-navigation {
    display: flex;
  }
  @media (min-width: 768px) {
    .antsia-topbar-row { padding-inline: 16px; }
    .antsia-member-frame { padding-inline: 16px; }
    .antsia-member-frame[data-with-navigation] {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      align-items: start;
      gap: 16px;
    }
    .antsia-member-rail {
      display: block;
      position: sticky;
      top: var(--esp-sticky-header-inset, 64px);
      min-width: 0;
      max-height: calc(100dvh - var(--esp-sticky-header-inset, 64px));
      overflow-y: auto;
      overscroll-behavior-y: auto;
      padding-block: 24px;
    }
    .antsia-member-content,
    .antsia-member-frame[data-with-navigation] > .antsia-member-content {
      padding-block: 24px;
    }
    .antsia-member-frame[data-workspace] > .antsia-member-content { padding-block: 0; }
    .antsia-member-frame[data-workspace] > .antsia-member-rail {
      height: 100%;
      max-height: 100%;
      padding-block: 16px;
    }
    .antsia-member-workspace .icom-messages-page[data-mobile="true"] { height: 100%; }
  }
  @media (min-width: 1200px) {
    .antsia-topbar-row { padding-inline: 24px; }
    .antsia-member-frame { padding-inline: 24px; }
    .antsia-member-frame[data-with-navigation] {
      grid-template-columns: 248px minmax(0, 1fr);
      gap: 24px;
    }
  }
`

/** Monté une fois dans NetworkShell, sans envelopper ou déplacer l'hôte d'appel. */
export function MemberNavigationStyles() {
  return <style href="antsia-member-navigation" precedence="default">{MEMBER_NAVIGATION_CSS}</style>
}
