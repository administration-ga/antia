// Dupliqué de socle/packages/agent-features/src/features/notifications/index.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT sans rien de retiré — table centrale et onglet « Administration » (`AdministrationNotificationsList`, `AdministrationNotificationRow`, `notification-links`, `notification-presentation`, `notification-icons`, `notification-open`, `notification-routes-context`, `use-administration-notification-actions`) et onglets de la carte (`CENTER_TABS`, `CenterTab`, `defaultCenterTab`, `combineUnread`, `combinedUnreadLabel`, `tabBadgeLabel`, `selectNotificationCenterTab`) ; exports du moteur ajoutés (`unreadLabel`, `readFailureText`, `UnreadCount`, `NotificationRoutes`, `notificationRowSentence`, `notificationRowNote`, `targetCallback` et leurs types d'entrée).
/**
 * Tranche `notifications` — la cloche sociale du réseau (bouton + carte
 * flottante), sa liste et sa ligne, partagées par la coque et l'en-tête mobile.
 *
 * ⚠️ Un composant absent de ce barrel est INATTEIGNABLE depuis une application
 * (`exports: ./*` → `index.ts`) : tout export public passe ici.
 */

export { NotificationBell } from "./NotificationBell"
export type {
	NotificationBellProps,
	NotificationBellVariant,
} from "./NotificationBell"
export { NotificationsCenter } from "./NotificationsCenter"
export type { NotificationsCenterProps } from "./NotificationsCenter"
export {
	NOTIFICATIONS_PAGE_SIZE,
	NotificationsList,
} from "./NotificationsList"
export type {
	NotificationListItem,
	NotificationsListProps,
} from "./NotificationsList"
export {
	ConnectionInviteActions,
	NotificationRow,
} from "./ReseauNotificationRow"
export type { NotificationRowProps } from "./ReseauNotificationRow"
export {
	closeNotificationCenter,
	openNotificationCenter,
	readNotificationCenter,
	resetNotificationCenterForTests,
	toggleNotificationCenter,
	useNotificationCenter,
} from "./notification-center-store"
export type { NotificationCenterState } from "./notification-center-store"
export {
	readFailureText,
	tabBadge,
	unreadLabel,
} from "./notification-center-tabs"
export type { UnreadCount } from "./notification-center-tabs"
export {
	connectionInviteOutcome,
	notificationRowAction,
	notificationRowNote,
	notificationRowSentence,
	notificationTarget,
	targetCallback,
} from "./notification-targets"
export type {
	ConnectionInviteOutcome,
	ConnectionInviteState,
	NotificationNoteInput,
	NotificationRoutes,
	NotificationRowAction,
	NotificationSentenceInput,
	NotificationTargetInput,
	NotificationTargetKind,
	NotificationTargetRef,
	NotificationTargets,
} from "./notification-targets"
