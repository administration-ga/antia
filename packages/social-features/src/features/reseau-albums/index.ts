// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/index.ts @ ad2e7fdc2 — adaptations : exports alignés sur le modèle traduit (les tables de libellés `ALBUM_STEP_LABELS`, `ALBUM_AUDIENCE_LABELS`, `ALBUM_AUDIENCE_HINTS`, `ALBUM_STATUS_LABELS` et la constante `ALBUM_WITHDRAW_NOTICE` deviennent les fonctions `albumStepLabel`, `albumAudienceLabel`, `albumAudienceHint`, `albumStatusLabel` et `albumWithdrawNotice`, qui prennent `t`) ; ajouts : `albumAddBatches`, `albumEngineErrorText`, `ALBUM_UPLOAD_USAGE` et les types tirés de l'API du moteur (`AlbumCover`, `AlbumId`, `AlbumItemId`, `AlbumListPage`) ; note d'import rapportée au paquet `@antia/social-features`.
/**
 * Tranche ALBUMS (R-09, ADR-0145) — albums de photos d'une personne, dans un
 * réseau.
 *
 * ⚠️ Le barrel est ce que les applications importent. Le champ `exports` de
 * `@antia/social-features` publie `./*` vers `./src/*.ts` : un import PROFOND
 * d'un composant (`…/reseau-albums/AlbumPage`, fichier `.tsx`) ne résout PAS,
 * et le seul symptôme est une erreur de résolution au build de l'application
 * hôte. Passer par ce barrel (`…/features/reseau-albums/index`, ou l'entrée
 * nommée du paquet quand elle est publiée).
 */

export { AlbumsSection } from "./AlbumsSection"
export type { AlbumsSectionProps } from "./AlbumsSection"
export { AlbumPage } from "./AlbumPage"
export type { AlbumPageProps } from "./AlbumPage"
export { AlbumComposer } from "./AlbumComposer"
export type { AlbumComposerProps, ReencodeImage, ReencodeResult } from "./AlbumComposer"

export {
  ALBUM_NEW_PARAM,
  ALBUM_REENCODE_QUALITY,
  ALBUM_STEPS,
  ALBUM_TAB_ID,
  ALBUM_TAB_PARAM,
  albumAddBatches,
  albumAudienceHint,
  albumAudienceLabel,
  albumBackHref,
  albumCountLabel,
  albumEngineErrorText,
  albumHref,
  albumsTabHref,
  albumReencodePlan,
  albumStatusLabel,
  albumStepBlocker,
  albumStepLabel,
  albumUploadProgress,
  albumWithdrawNotice,
  albumsEmptyText,
  moveAlbumItem,
  moveAnnouncement,
  nextAlbumStep,
  orderChanged,
  previousAlbumStep,
  reencodeFailureMessage,
  remainingSlots,
} from "./album-model"
export type {
  AlbumAudienceChoice,
  AlbumReencodePlan,
  AlbumStatusValue as AlbumModelStatus,
  AlbumStep,
  AlbumUploadProgress,
  AlbumUploadState,
} from "./album-model"

export { ALBUM_UPLOAD_USAGE, albumsApi, albumUploadUrlRef } from "./albums-api"
export type {
  AlbumAudienceValue,
  AlbumCover,
  AlbumDetail,
  AlbumId,
  AlbumItem,
  AlbumItemId,
  AlbumListPage,
  AlbumSummary,
  DeclaredAlbumItem,
} from "./albums-api"
