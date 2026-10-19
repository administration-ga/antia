"use client"

/**
 * La feuille du fil immersif et de sa bascule de mode (lot P04), hors du JSX :
 * un littéral enfant de `<style>` passerait pour une chaîne d'interface
 * (cliquet `no-hardcoded-strings`). Jetons de la charte seulement (cliquets
 * `no-hardcoded-colors`, `theme-contract`).
 *
 * Ce qui porte la mécanique, et pourquoi :
 *  · `.fil-imm-scroller` défile NATIVEMENT, accroché (`scroll-snap-type: y
 *    mandatory`), et retient son geste (`overscroll-behavior-y: contain`) :
 *    aucun défilement ne fuit vers la page ;
 *  · chaque créneau a la hauteur EXACTE de la scène (`--fil-stage-h`, mesurée
 *    par le lecteur en style en ligne ; jeton LOCAL déclaré sur la scène à
 *    `100cqh` avant la première mesure) et s'arrête à chaque publication
 *    (`scroll-snap-stop: always`) ;
 *  · un créneau plus haut que l'écran défile À L'INTÉRIEUR (`overflow-y:
 *    auto`) : aucun arrêt forcé ne le tronque ; quand sa légende longue est
 *    ouverte (« Lire la suite », P03), son geste ne rejoint plus le fil
 *    (`:has(... [aria-expanded="true"])`) — le détail ne change pas de post ;
 *  · `content-visibility: auto` borne le RENDU des créneaux hors écran sans
 *    les retirer du DOM : l'ordre lu par les technologies d'assistance, le
 *    focus et la recherche dans la page restent intacts ;
 *  · le cadre média (P03, `.rpm-m-frame`) se réduit pour laisser l'auteur, les
 *    actions et la légende dans la même hauteur — jamais recadré ;
 *  · réduction des mouvements : aucun défilement animé.
 */
export const FEED_IMMERSION_CSS = `
      .fil-imm {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 0;
        min-height: 0;
        height: calc(100dvh - 8rem);
        padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px);
        box-sizing: border-box;
        background: var(--background);
      }
      .fil-imm-bar {
        display: flex;
        flex: 0 0 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sp-2);
        min-height: 48px;
        padding: 2px 0 var(--sp-2);
      }
      .fil-imm-bar-spacer { flex: 1 1 auto; }
      .fil-imm-notice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 4px 10px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--muted);
        color: var(--muted-foreground);
        font-size: 12.5px;
        font-weight: 600;
        line-height: 1.3;
      }
      .fil-imm-new {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid var(--esp-identity-fill, var(--primary));
        border-radius: 999px;
        background: var(--esp-identity-fill, var(--primary));
        color: var(--primary-fill-on, var(--primary-foreground));
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .fil-imm-new:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }
      .fil-imm-scroller {
        position: relative;
        flex: 1 1 0;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        scroll-snap-type: y mandatory;
        scrollbar-width: thin;
        outline: none;
        container-type: size;
        container-name: fil-stage;
        --fil-stage-h: 100cqh;
      }
      .fil-imm-scroller:focus-visible { box-shadow: inset 0 0 0 3px var(--ring); }
      .fil-imm-head {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 2px 0 12px;
        scroll-snap-align: start;
      }
      .fil-imm-slot {
        position: relative;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        height: var(--fil-stage-h, 100cqh);
        overflow-x: hidden;
        overflow-y: auto;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        padding-block: 4px;
        content-visibility: auto;
        outline: none;
      }
      .fil-imm-slot:focus-visible { box-shadow: inset 0 0 0 3px var(--ring); }
      .fil-imm-slot:has([data-post-caption] button[aria-expanded="true"]) { overscroll-behavior-y: contain; }
      .fil-imm-slot-inner {
        margin-block: auto;
        min-width: 0;
      }
      .fil-imm-status .fil-imm-slot-inner,
      .fil-imm-end .fil-imm-slot-inner {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: var(--sp-4) 0;
        text-align: center;
      }
      .fil-imm-end-text {
        margin: 0;
        color: var(--muted-foreground);
        font-size: 14px;
        line-height: 1.5;
      }
      .fil-imm-slot .rpm-m-frame {
        max-height: max(10rem, calc(var(--fil-stage-h, 100cqh) - 17rem));
      }
      .fil-mode {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding: 3px;
        /* Système épuré (ADR-0027) : fond de puce sans filet dans les thèmes qui
           le déclarent ; ailleurs, la carte et son filet. */
        border: 1px solid var(--esp-chip-border, var(--border));
        border-radius: 999px;
        background: var(--esp-chip-bg, var(--card));
      }
      .fil-mode-option {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 44px;
        min-height: 44px;
        padding: 0 12px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--muted-foreground);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .fil-mode-option[aria-pressed="true"] {
        /* Mode choisi : pastille tonale (ADR-0027), l'aplat d'identité en repli. */
        background: var(--esp-tab-active-bg, var(--primary));
        color: var(--esp-tab-active-fg, var(--primary-foreground));
      }
      .fil-mode-option[aria-disabled="true"] {
        cursor: not-allowed;
        opacity: 0.65;
      }
      .fil-mode-option:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }
      .fil-mode-note {
        flex: 1 1 100%;
        margin: 2px 10px 4px;
        color: var(--muted-foreground);
        font-size: 12.5px;
        line-height: 1.4;
      }
      .fil-mode-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: var(--sp-2);
      }
      @media (prefers-reduced-motion: reduce) {
        .fil-imm-scroller,
        .fil-imm-slot { scroll-behavior: auto; }
      }
    `

export function FeedImmersionStyles() {
  return (
    <style href="fil-immersion" precedence="default">{FEED_IMMERSION_CSS}</style>
  )
}
