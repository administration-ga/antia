// Dupliqué de socle/packages/agent-features/src/features/iappel/index.ts @ ad2e7fdc2 — adaptations : réécrit pour la coque et la messagerie du moteur — retirés : `GroupCallLauncher` (lanceur de poste), `ringingFromListMine` et `MEETING_RING_WINDOW_MS` (repli et réunions iRéunion ; `CALL_RING_WINDOW_MS` vient du contrat du moteur), types `CallPriority` et `RoutedCall` (priorité et secrétariat de poste), réglages de poste ; ajoutés : la pastille de présence des relations (`presence-dot`, fichier `.tsx` joignable par ce seul barrel), `composeGroupCallTitle` (titre d'un appel sans fil composé par l'écran) et `refusalEndKind` ; documentation recadrée sur le réseau (espace agent et poste retirés).
/**
 * iAppel — le module d'appel du réseau.
 *
 * ⚠️ Ce barrel est la porte publique du module : le champ `exports` du paquet
 * ne publie que des fichiers `.ts` (`./*` → `./src/*.ts`), si bien qu'un
 * composant `.tsx` qui n'est pas réexporté ici est INJOIGNABLE depuis une
 * application — la route compile (TypeScript résout le chemin source) mais
 * rend une erreur à l'exécution, faute de sous-chemin publié. Toute nouvelle
 * surface s'y ajoute en même temps qu'elle est écrite.
 */

export type {
	AudioRouteIntent,
	CallAdmissionReason,
	CallDirection,
	CallEndKind,
	CallGroupIdentity,
	CallGroupInviteePreview,
	CallKind,
	CallMediaIntent,
	CallParticipantState,
	CallParticipantView,
	CallPeerIdentity,
	CallPhase,
	CallPlacementResult,
	CallScope,
	CallSlotKind,
	RingingCall,
} from "./call-types"

export {
	compareIncoming,
	planIncomingCalls,
	ringtoneVariantFor,
	type AudibleSignal,
	type InboxSlotView,
	type IncomingPlan,
	type IncomingPlanInput,
} from "./call-inbox"

export {
	planCallSurface,
	type CallPresentation,
	type CallSurfacePlan,
	type CallSurfacePlanInput,
	type SurfaceSlotView,
	type SurfaceViewport,
} from "./call-surface-plan"

/**
 * L'appel DANS le téléphone iCom (IC-01/IC-02/IC-06) : la décision pure et le
 * registre des cartes qui hébergent. La carte (`MessagerieDock`) se déclare ;
 * l'hôte global décide et publie.
 */
export {
	cardYieldsEscape,
	collapseRequiresMinimize,
	coverStarts,
	hostModeFor,
	pickCallHost,
	resolveCallHosting,
	shouldWakeForRinging,
	type CallHostingView,
	type CallHostMode,
	type CallHostPose,
	type CallHostView,
	type CallRingingView,
} from "./call-host"
export {
	publishCallHosting,
	publishCallRinging,
	registerCallHost,
	updateCallHostPose,
	useCallHostFor,
	useCallHostMode,
	useCallRinging,
	type CallHost,
	type CallHosting,
} from "./call-host-store"

export {
	callEndKindV2,
	deriveCallPhase,
	describeCallEnd,
	endLabel,
	isAdmissionRefusal,
	peerHoldsCall,
	refusalEndKind,
	type CallConnectionState,
	type CallEndCopy,
	type CallEndCopyInput,
	type CallMeetingSnapshot,
	type CallPhaseInput,
	type CallPhaseResult,
} from "./call-phase"

/**
 * Le média suit le STATUT du slot, pas seulement `activeSlotId` : c'est ce qui
 * rend la mise en attente RÉELLE (le seul appel tenu reste l'actif).
 */
export {
	shouldPublishMedia,
	type CallMediaLiveInput,
} from "./call-media-live"

export {
	classifyRemoteVideo,
	pickLocalCameraTrack,
	pickRemoteCameraTrack,
	probeOf,
	type CameraTrackLike,
	type RemoteVideoState,
	type TrackProbe,
} from "./remote-video"

export {
	availableCallControls,
	nextCameraDevice,
	qualityLabel,
	speakerControlAvailable,
	type CallControlsAvailability,
	type CallControlsInput,
	type ConnectionQualityLevel,
} from "./call-controls"

/**
 * Écouteur / haut-parleur : la DÉCISION, pure et testée. Le web ne sait
 * choisir qu'un périphérique énuméré — ce module dit quand c'est possible, et
 * quand la commande doit s'afficher en disant pourquoi elle ne l'est pas.
 */
export {
	ANDROID_INPUT_ROUTE_TRICK,
	ANDROID_NO_STRATEGY_REASON,
	DESKTOP_NO_SELECTION_REASON,
	DESKTOP_OUTPUTS_HIDDEN_REASON,
	DESKTOP_SINGLE_OUTPUT_REASON,
	IOS_AUDIO_ROUTE_REASON,
	audioDeviceLabel,
	detectAudioPlatform,
	nextOutputDevice,
	planSpeakerControl,
	speakerButtonLabel,
	type AudioDeviceInfo,
	type AudioPlatform,
	type SpeakerControlInput,
	type SpeakerControlPlan,
	type SpeakerPickerOption,
} from "./audio-route"

export { CALL_RING_WINDOW_MS, vibrationPatternFor } from "./ringing-signal"

export {
	isLikelyIdentityHash,
	peerDisplayName,
	peerInitials,
	peerSubtitle,
	scopeBadgeLabel,
} from "./call-peer"

export {
	describeCallMediaError,
	describeCameraError,
	describeCameraFailure,
	describeMicBlockedInCall,
	describeMicError,
	isMediaAccessError,
	isPermissionDenied,
} from "./media-errors"

export {
	desiredLineState,
	forgottenLines,
	lineAckFor,
	planLineSync,
	type LineSlotView,
	type LineSyncOp,
	type LineWant,
} from "./call-line-sync"
export { useCallLineSync } from "./use-call-line-sync"

export {
	clampToFrame,
	cornerPosition,
	defaultPlacement,
	hasEngaged,
	nearestCorner,
	nudge,
	parseStoredPlacement,
	reanchor,
	serializePlacement,
	settleToCorner,
	SURFACE_DRAG_HYSTERESIS_PX,
	SURFACE_DRAG_MARGIN,
	type DragBox,
	type DragInsets,
	type DragPoint,
	type DragViewport,
	type StoredPlacement,
	type SurfaceCorner,
} from "./surface-drag"
export { useSurfaceDrag, type SurfaceDrag } from "./use-surface-drag"
export { useSurfaceInsets } from "./use-surface-insets"

export { elapsedSince, formatClockTime, formatElapsed } from "./call-timer"

export {
	categorizeCallRow,
	groupCallJournal,
	journalEntryOf,
	type CallHistoryRow,
	type CallJournalCategory,
	type JournalEntry,
} from "./call-journal"

// ─── Surface d'appel ─────────────────────────────────────────────
export { CallSurface, type CallSurfaceProps } from "./CallSurface"
export { CallStage, type CallStageProps } from "./CallStage"
export { CallEndScreen, type CallEndScreenProps } from "./CallEndScreen"
export {
	CallMinimizedPill,
	type CallMinimizedPillProps,
} from "./CallMinimizedPill"
export { CallControlButton } from "./CallControlButton"
export {
	SpeakerPickerPanel,
	type SpeakerPickerPanelProps,
} from "./SpeakerPickerPanel"
export { CallConnectionQuality } from "./CallConnectionQuality"
export { LocalPip, nextPipCorner, type PipCorner } from "./LocalPip"
export { RemoteVideoStage } from "./RemoteVideoStage"
export { HeldCallChips, type HeldCallView } from "./HeldCallChips"
export { CallWaitingChip } from "./CallWaitingChip"
export {
	GroupCallGrid,
	type GroupCallConference,
	type GroupCallGridProps,
} from "./GroupCallGrid"
export {
	avatarSizeFor,
	compareParticipants,
	composeGroupCallTitle,
	groupCallSubtitle,
	isLiveParticipant,
	MIN_STRIP_TILE_WIDTH,
	MIN_TILE_HEIGHT,
	MIN_TILE_WIDTH,
	participantStatusLabel,
	pickStageIdentity,
	planGroupGrid,
	reservesGridSeat,
	shortGroupLabel,
	type GroupGridLayout,
} from "./group-stage"

/**
 * L'appel de groupe s'arrête à onze, la conférence est dite AVANT le refus
 * (ADR-0149) : le compteur partagé, la décision des cartes T1/T2/T3 et leurs
 * mots, la carte dessinée, et le geste « Lancer une conférence » — le direct
 * du réseau (lot `live`).
 */
export {
	correspondentsCounter,
	effectiveCapacity,
	isSelectionComplete,
	maxCorrespondents,
} from "./group-call-capacity"
export {
	conferenceHintCopy,
	planConferenceHint,
	type ConferenceHintContext,
	type ConferenceHintCopy,
	type ConferenceHintInput,
	type ConferenceHintKind,
	type ConferenceHintMoment,
} from "./conference-hint"
export {
	ConferenceHintCard,
	type ConferenceHintCardProps,
} from "./ConferenceHintCard"
export {
	useLaunchConference,
	CONFERENCE_LAUNCH_AVAILABLE,
	type ConferenceLaunchRequest,
} from "./use-launch-conference"
export {
	CONFERENCE_CARRIED_CALL_STATES,
	conferenceInviteesFromCall,
	conferenceLaunchRefusalMessage,
	consumeConferenceLaunch,
	getConferenceLaunchRequest,
	planConferenceLaunch,
	requestConferenceLaunch,
	subscribeConferenceLaunch,
	useConferenceLaunchRequest,
	type ConferenceCallParticipant,
	type ConferenceLaunchPlan,
	type ConferenceLaunchRefusal,
	type ConferenceLaunchState,
} from "./conference-launch-store"
export {
	INCOMING_PILE_MAX_FACES,
	incomingGroupBannerLabel,
	incomingGroupSummary,
	type IncomingGroupSummary,
} from "./incoming-group"
export { IncomingCallCard } from "./IncomingCallCard"
export { IncomingCallBanner } from "./IncomingCallBanner"
export { IappelJournal, type IappelJournalProps } from "./IappelJournal"
export {
	VoicemailRecorder,
	type VoicemailRecorderProps,
} from "./VoicemailRecorder"

/**
 * La pastille de présence de MES RELATIONS (En ligne / Occupé / Ne pas
 * déranger / Hors ligne) et son hook — partagés par la messagerie, le profil
 * et le menu avatar de la coque.
 */
export {
	PRESENCE_COLOR,
	PRESENCE_LABEL_KEY,
	PresenceDot,
	presenceLabel,
	useConnectionsPresence,
	type PresenceState,
} from "./presence-dot"

// ─── Hooks ────────────────────────────────────────────────────────
export { useCallSlotConnector } from "./use-call-slot-connector"
export { useStageSize, type StageSize } from "./use-stage-size"
/**
 * La pile Échap (IC-12) — réexportée ICI parce que les surfaces d'appel en
 * sont les premières usagères, et qu'un consommateur externe ne doit pas
 * avoir à connaître le dossier `shell/floating-surface/`.
 */
export {
	createEscapeStack,
	escapeStack,
	ESCAPE_PRIORITY,
	type EscapeLayer,
	type EscapePriority,
} from "../../shell/floating-surface/escape-stack"
export {
	useEscapeLayer,
	type UseEscapeLayerOptions,
} from "../../shell/floating-surface/use-escape-layer"
export { useIappelActions, type IappelActions } from "./use-iappel-actions"
export { useIncomingCalls, type IncomingCallsState } from "./use-incoming-calls"
export { useRingVibration } from "./use-ring-vibration"
export { useSpeakerOutput, type SpeakerOutput } from "./use-speaker-output"
export { useCameraFlip, type CameraFlip } from "./use-camera-flip"
