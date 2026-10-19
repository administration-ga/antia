/**
 * Fil immersif et mode Liste (lot P04 de l'étude social-commerce du
 * 18/10/2026) : décisions pures, mode mémorisé par réseau, lecteur, créneaux,
 * mémoire de retour de l'onglet et bascule.
 */
export * from "./feed-mode"
export * from "./immersive-reader-model"
export {
  activateFeedReturnSession,
  clearFeedReturnSession,
  FEED_RETURN_MAX_DEPTH,
  FEED_RETURN_MAX_ENTRIES,
  FEED_RETURN_TTL_MS,
  feedReturnOwner,
  feedReturnScope,
  forgetFeedReturn,
  readFeedReturn,
  writeFeedReturn,
  type FeedOffsetKind,
  type FeedReturnEntry,
} from "./feed-return-memory"
export { useFeedMode, type FeedModeState } from "./use-feed-mode"
export { useFeedImmersion, type FeedImmersion } from "./use-feed-immersion"
export { FeedReturnSessionBoundary } from "./FeedReturnSessionBoundary"
export { FeedPostMemoryScope, FeedSurfaceMemoryProvider, useOptionalFeedPostMemory, type FeedPostMemory, type FeedSurfaceMemory } from "./feed-post-memory"
export {
  IMMERSIVE_END_KEY,
  IMMERSIVE_HEAD_KEY,
  ImmersiveFeedReader,
  ImmersiveFeedSlot,
  ImmersiveStatusSlot,
  useImmersiveFeedReader,
  useImmersiveFrozenHead,
  useImmersivePageReport,
  type FeedAnchor,
  type FeedRestoreTarget,
  type ImmersiveFeedReaderProps,
  type ImmersiveLoadReason,
  type ImmersivePageReport,
} from "./ImmersiveFeedReader"
export { FeedModeToggle } from "./FeedModeToggle"
export { FeedListReturn, listAnchorOf } from "./FeedListReturn"
export { FEED_IMMERSION_CSS, FeedImmersionStyles } from "./immersive-styles"
export { availableHeightFor, findScrollContainer, IMMERSIVE_MIN_STAGE_HEIGHT, useFillAvailableHeight } from "./layout-measure"
