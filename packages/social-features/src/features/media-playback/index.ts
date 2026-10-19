/**
 * Coordination de lecture des vidéos de publication (lot P04 de l'étude
 * social-commerce du 18/10/2026) : décisions pures, coordinateur sans React,
 * fournisseur de session et branchement d'une vidéo.
 */
export * from "./media-playback-policy"
export {
  createMediaPlaybackCoordinator,
  IDLE_PLAYBACK_SNAPSHOT,
  type MediaPlaybackCoordinator,
  type MediaPlaybackSnapshot,
  type MediaPlaybackStatus,
  type PlaybackEventType,
  type PlaybackTarget,
} from "./media-playback-coordinator"
export {
  readAutoplayCapability,
  readDataSaver,
  readDocumentHidden,
  subscribeDataSaver,
  subscribeDocumentVisibility,
} from "./media-playback-environment"
export { MediaRoleProvider, useMediaRole } from "./media-role-context"
export { MediaPlaybackScope, useOptionalMediaPlayback } from "./media-playback-context"
export { hasCallInProgress, MediaPlaybackProvider, PlaybackEnvironmentBridge } from "./MediaPlaybackProvider"
export { effectiveVideoRole, useCoordinatedVideo, type CoordinatedVideo } from "./use-coordinated-video"
export { CoordinatedVideoControls, MEDIA_PLAYBACK_CSS, MediaPlaybackStyles } from "./CoordinatedVideoControls"
