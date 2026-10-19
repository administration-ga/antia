/**
 * Coque légère du moteur (remplace AppShell du socle) : ce qu'une application
 * monte autour de ses pages de membre, sous `NetworkProvider`.
 */
export { CommunicationShell } from "./communication-shell"
// P04 (18/10/2026) : la coque persistante d'une application qui déclare le fil
// immersif monte le coordinateur de lecture de la session et la frontière de
// la mémoire de retour du fil (purgée au changement de personne ou de réseau).
export { MediaPlaybackProvider } from "../features/media-playback/MediaPlaybackProvider"
export { FeedReturnSessionBoundary } from "../features/feed-immersion/FeedReturnSessionBoundary"
export { usePresenceHeartbeat } from "./presence/use-presence-heartbeat"
export { MyPresenceRow } from "./account/my-presence-row"

export { AppearanceProvider, AppearanceControl, AppearanceToggle, useOptionalAppearance } from "./appearance"
export { PostHogProvider, resolvePostHogConfiguration } from "./analytics"
