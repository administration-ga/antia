// Réécrit d'après socle/packages/agent-features/src/features/messagerie/index.ts @ ad2e7fdc2 — barrel de la feature pour la COQUE du moteur : dock (`MessagerieDock`, `ICOM_AGENT_CALL_HOST_ID`), configurateur de stockage par réseau (`configureDockStorage`), aiguillage `MessagesRoute` et pages, invitations de groupe par lien, vues partagées et modules purs ; retirés : le hub administratif (`icom-hub-tabs`) et la source de poste (seule la source personnelle demeure dans `messagerie-source`) ; la barre basse d'iCom vit dans la coque (`shell/mobile/IcomMobileTabBar`).
/**
 * La messagerie (iCom) — ce que la coque et les autres surfaces en montent.
 *
 * ── La coque ──────────────────────────────────────────────────────────────
 *  · `MessagerieDock` : la carte iCom du bureau, UNE fois, sous `<Suspense>`
 *    (elle lit `useSearchParams`) et sous le `NetworkProvider` ;
 *  · `configureDockStorage(useNetwork().storagePrefix)` : le préfixe de
 *    stockage du réseau, donné au magasin du dock dès le `NetworkProvider` ;
 *  · `MessagesRoute` : le SEUL point d'entrée des quatre coquilles de route de
 *    la messagerie (liste, conversation, deux composeurs, sous la base
 *    `useRoutes().messages()`). C'est lui qui choisit entre la pose téléphone
 *    et la pose bureau ; les pages sont exportées pour un autre hôte, mais
 *    aucune coquille ne devrait les monter directement.
 */
export { MessagerieDock, ICOM_AGENT_CALL_HOST_ID } from "./MessagerieDock"
export {
	configureDockStorage,
	dockStorageKey,
	dockStoragePrefix,
	dockStore,
	icomFloatPlacementStorageKey,
	useDockState,
} from "./dock-store"
export { MessagesRoute } from "./MessagesRoute"
export type { MessagesRouteProps } from "./MessagesRoute"
export { MessagerieListPage } from "./MessagerieListPage"
export { MessagerieConversationPage } from "./MessagerieConversationPage"
export { MessagerieComposePage } from "./MessagerieComposePage"
// Compatibilité bureau : les adresses de la messagerie ouvrent le téléphone iCom détaché.
export { MessagerieDesktopPage } from "./MessagerieDesktopPage"
export * from "./icom-desktop-entry"

/** Les invitations de groupe par lien — la query de la liste, et l'écran qui la sert. */
export { MessagerieGroupeInvite } from "./MessagerieGroupeInvite"
export * from "./groupe-invitation-link"

/** Les trois vues partagées par la carte et les pages. */
export { MessagerieListView } from "./MessagerieListView"
export type { MessagerieListViewProps } from "./MessagerieListView"
export { MessagerieConversationView } from "./MessagerieConversationView"
export { MessagerieComposeView } from "./MessagerieComposeView"
export { MessagerieStyles } from "./messagerie-styles"
export * from "./messagerie-views"
export { useMessagerieRouterNav } from "./use-messagerie-router-nav"

/** Le panneau d'administration d'un groupe — poses page seulement. */
export { MessagerieGroupeInfos } from "./MessagerieGroupeInfos"
export type { MessagerieGroupeInfosProps } from "./MessagerieGroupeInfos"
export { useInfosPanneau } from "./use-infos-panneau"

/** Les composants de conversation, réutilisables hors de ce module. */
export { ConversationHeader } from "./ConversationHeader"
export { MessageBubble } from "./MessageBubble"
export type { BubbleMessage, MessageBubbleProps } from "./MessageBubble"
export { MessageComposer } from "./MessageComposer"
export type { UploadedAttachment } from "./MessageComposer"
export { MessageActionsSheet } from "./MessageActionsSheet"
export { MessageAttachment } from "./MessageAttachment"
export type { MessageAttachmentData } from "./MessageAttachment"
export { ReplyPreview } from "./ReplyPreview"
export type { ReplyPreviewData } from "./ReplyPreview"
export { NewMessagesPill } from "./NewMessagesPill"
export { VoiceRecorderButton } from "./VoiceRecorderButton"
export type { VoiceNoteResult } from "./VoiceRecorderButton"

/** Les modules PURS — ce qui décide, et ce qui se teste. */
export * from "./messagerie-dock"
export * from "./messagerie-typing"
export * from "./messagerie-routes"
export * from "./messagerie-bulles"
export * from "./conversation-scroll"
export * from "./voice-note"
export * from "./messagerie-composer"
export * from "./message-actions"
export * from "./call-actions"
export * from "./groupe-composeur"
export * from "./groupe-liste"
export * from "./groupe-gestion"
export * from "./icom-dock"
export * from "./icom-mobile-tabs"
/** IC-08 — qui appeler dans un fil plus grand qu'un appel. */
export * from "./groupe-appel-selection"
export {
	GroupCallInviteePicker,
	type GroupCallInviteePickerProps,
} from "./GroupCallInviteePicker"

/** D'où viennent les fils, et où partent les gestes — la source personnelle. */
export * from "./messagerie-source"
// Brouillons de médias d'un composeur (Lot 05 du socle) : conservés par cible, réconciliés au chargement.
export * from "./messagerie-media-draft"
