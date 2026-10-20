/** U05/U07 : deux colonnes seulement quand la fiche dispose elle-même de 832px. */
export const OFFER_DETAIL_CSS = `
[data-offer-detail-frame] { container: offer-detail / inline-size; min-width: 0; }
[data-offer-detail-frame] .offer-detail-layout { display: grid; grid-template-columns: minmax(0, 1fr); }
@container offer-detail (min-width: 832px) {
  [data-offer-detail-frame] .offer-detail-layout { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  [data-offer-detail-frame] .offer-detail-heading { grid-column: 2; grid-row: 1; }
  [data-offer-detail-frame] .offer-detail-media { grid-column: 1; grid-row: 1; }
  [data-offer-detail-frame] .offer-detail-full { grid-column: 1 / -1; }
}
`
