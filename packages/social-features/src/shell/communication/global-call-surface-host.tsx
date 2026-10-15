// Dupliqué de socle/packages/agent-features/src/shell/global-call-surface-host.tsx @ ad2e7fdc2 — adaptations : branche v2 seule (disjoncteur `FEATURES.iappelV2` et les quatre hôtes de la branche v1 — alerte, pilule, salle et fenêtre sortante — retirés) ; retirés aussi : poste (carte iCom de poste, `useIcomPosteHosted`, appel de poste `callUser`, renvoi au secrétariat), organisation (`useOptionalOrg`), invitations de réunion iRéunion (`useActiveMeetingConnection`, `joinMeeting`, ticket de réunion), fermeture vocale d'iAsted ; fonctions du moteur sur le réseau courant (`calls.lifecycle.getCall` et `setCallRinging`, `calls.groupCalls.listParticipants`, `calls.direct.callMember` pour le rappel) ; ma personne lue dans `useNetwork()` (plus de `users.getMe`) ; conviés d'un appel de groupe nommés par leur libellé (`counterpartLabel`) ; adresse d'écriture composée sur la base de messagerie injectée (`useRoutes().messages()`) ; la création de conférence (`ConferenceLaunchHost`, lot `live`) n'est pas montée : la ligne T3 informe sans proposer ; libellés traduits (i18n `iappel`), modules purs appelés avec `t` en dernier paramètre.
"use client"

/**
 * GlobalCallSurfaceHost — le point de montage UNIQUE de la couche d'appel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QU'IL ASSEMBLE, ET POURQUOI EN UN SEUL ENDROIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · le POOL de salles (invisible) — les connexions LiveKit y vivent, et y
 *    survivent aux changements de page ;
 *  · le CONNECTEUR — donne sa salle à chaque appel posé dans le store ;
 *  · les ENTRANTS — ce qui sonne, comment, et une seule sonnerie ;
 *  · la SURFACE — plein écran, fenêtre ou pilule.
 *
 * Au socle, ces rôles avaient d'abord été répartis entre trois composants qui
 * montaient CHACUN leur propre `<LiveKitRoom>` : la fenêtre d'appel sortant,
 * l'alerte d'appel entrant, et le pool du centre d'appels. Fermer une fenêtre
 * raccrochait, et deux appels simultanés ouvraient deux salles concurrentes
 * dont une seule était audible. Le moteur ne garde que cette charpente-ci.
 *
 * Monté UNE fois par la coque (`CommunicationShell`), sous `NetworkProvider` ;
 * c'est elle qui pose le préfixe de stockage du magasin d'appel
 * (`configureCallStoreStorage`).
 */

import { api } from "@antia/api/engine"
import type { Id } from "@antia/api/engine"
import { useAuthenticatedConvexQuery, useConvexMutationQuery } from "@antia/api/hooks"
import { useNetwork, useRoutes } from "@antia/api/network"
import { useRouter } from "@antia/api/routing"
import { callCapacityOf } from "@antia/social-contracts/groupCapacity"
import { useIsReseauMobile } from "@antia/ui/overlay"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AddToCallPanel } from "../../features/iappel/AddToCallPanel"
import { CallEndScreen } from "../../features/iappel/CallEndScreen"
import { CallRoomPool } from "../../features/iappel/CallRoomMount"
import { CallStage } from "../../features/iappel/CallStage"
import { CallSurface } from "../../features/iappel/CallSurface"
import { CallWaitingChip } from "../../features/iappel/CallWaitingChip"
import { HeldCallChips } from "../../features/iappel/HeldCallChips"
import { IncomingCallBanner } from "../../features/iappel/IncomingCallBanner"
import { IncomingCallCard } from "../../features/iappel/IncomingCallCard"
import { VoicemailRecorder } from "../../features/iappel/VoicemailRecorder"
import { callErrorMessage, livekitRoomErrorMessage } from "../../features/iappel/call-errors"
import { hostModeFor, resolveCallHosting } from "../../features/iappel/call-host"
import { publishCallHosting, publishCallRinging, useCallHostFor } from "../../features/iappel/call-host-store"
import { deriveEffectiveCallKind, planSlotReconciliation } from "../../features/iappel/call-kind-reconcile"
import { peerDisplayName } from "../../features/iappel/call-peer"
import { deriveCallPhase, refusalEndKind } from "../../features/iappel/call-phase"
import { planCallSurface } from "../../features/iappel/call-surface-plan"
import type { CallParticipantView } from "../../features/iappel/call-types"
import { composeGroupCallTitle, shortGroupLabel } from "../../features/iappel/group-stage"
import { useRingtoneMutedPref } from "../../features/iappel/hooks/use-ringtone-muted-pref"
import { describeCallMediaError } from "../../features/iappel/media-errors"
import { useCallLineSync } from "../../features/iappel/use-call-line-sync"
import { useCallSlotConnector } from "../../features/iappel/use-call-slot-connector"
import { useIappelActions } from "../../features/iappel/use-iappel-actions"
import { useIncomingCalls } from "../../features/iappel/use-incoming-calls"
import { draftKey } from "../../features/messagerie/messagerie-dock"
import { conversationHref } from "../../features/messagerie/messagerie-routes"
import { installAudioUnlock } from "../../lib/livekit/audio-unlock"
import { LIVEKIT_DIRECT_CALL_ROOM_OPTIONS } from "../../lib/livekit/room-options"
import { useBusyTone } from "../../lib/livekit/use-busy-tone"
import { useHoldTone } from "../../lib/livekit/use-hold-tone"
import { useRingback } from "../../lib/livekit/use-ringback"
import { callStore, useCallStore } from "../../stores/call-store"
import { ESCAPE_PRIORITY } from "../floating-surface/escape-stack"
import { useEscapeLayer } from "../floating-surface/use-escape-layer"

export function GlobalCallSurfaceHost() {
	const { t } = useTranslation("iappel")
	const { networkId, personId } = useNetwork()
	const routes = useRoutes()

	const isMobile = useIsReseauMobile()
	const router = useRouter()
	const { slots, activeSlotId, micMuted, micBlocked, cameraEnabled, minimized } =
		useCallStore()
	const actions = useIappelActions()
	useCallSlotConnector()
	// Donne au serveur l'état de ligne voulu par le magasin — pour TOUS les
	// chemins qui parquent un appel, pas seulement le décrochage.
	useCallLineSync()
	// Déverrouillage audio (S1) : le premier geste de la journée arme le
	// contexte partagé — sans lui, la sonnerie d'un onglet jamais cliqué est
	// muette. Posé ICI, à l'hôte de la couche d'appel, et nulle part ailleurs.
	useEffect(() => installAudioUnlock(), [])

	const incoming = useIncomingCalls({ isMobile: isMobile === true })

	type IncomingRinging = NonNullable<typeof incoming.primary>
	const answerIncoming = useCallback(
		(call: IncomingRinging, mediaType: "audio" | "video") => {
			actions.answer({
				meetingId: call.meetingId,
				mediaType,
				peer: call.caller,
				scope: call.scope,
				callKind: call.kind,
				group: call.group ?? null,
			})
		},
		[actions],
	)
	const declineIncoming = useCallback(
		(call: IncomingRinging, note?: string) => {
			incoming.dismiss(call.meetingId)
			void actions.decline(call.meetingId, note)
		},
		[actions, incoming],
	)

	/**
	 * LE plan de surface — calculé une fois, ici, et passé plus bas.
	 *
	 * ⚠️ L'appel de tête ne se lit PAS dans `activeSlotId`. Les deux
	 * répondaient différemment à la même question : `planCallSurface` écarte un
	 * actif parqué, l'hôte non. On composait donc régulièrement un écran que la
	 * surface n'affichait pas — et réciproquement.
	 */
	const plan = useMemo(
		() =>
			planCallSurface({
				slots: slots.map((s) => ({
					meetingId: s.meetingId as string,
					status: s.status,
					kind: s.kind,
					heldSince: s.heldSince,
					joinedAt: s.joinedAt,
				})),
				activeSlotId: activeSlotId as string | null,
				minimized,
				viewport: isMobile === null ? "unknown" : isMobile ? "mobile" : "desktop",
			}),
		[slots, activeSlotId, minimized, isMobile],
	)

	const frontSlot = useMemo(
		() => slots.find((s) => (s.meetingId as string) === plan.front) ?? null,
		[slots, plan.front],
	)

	/**
	 * OÙ l'appel se dessine (IC-01/IC-02/IC-06) : dans la carte iCom qui
	 * s'est déclarée hôte, ou, sans carte, sur la surface libre.
	 *
	 * L'hôte DÉCIDE ici (une seule réponse, comme pour l'appel de tête) et
	 * PUBLIE le mode : la carte se met en forme en le lisant, elle ne calcule
	 * rien. Un appel qui s'achève (`hidden`) ou le téléphone réel
	 * (`fullscreen`) publient `null` : la carte reprend sa vie.
	 */
	const host = useCallHostFor(frontSlot?.scope ?? "personnel")
	const hostMode = hostModeFor(plan.presentation, host)
	const hosted = hostMode === "none" ? null : host

	/**
	 * L'appel ENTRANT sonne dans le téléphone iCom, lui aussi (2026-09-13).
	 * Ce qui sonne = l'entrant de tête, au bureau, hors « appel en attente »
	 * (celui-là vit déjà dans la bande de la scène hébergée).
	 * `resolveCallHosting` arbitre avec l'appel en cours et publie une seule
	 * réponse. La sonnerie est publiée à part : une carte FERMÉE n'est pas
	 * déclarée et ne peut donc pas être choisie — elle lit la sonnerie,
	 * s'ouvre, se déclare, puis l'hôte la couvre.
	 */
	const ringingScope =
		isMobile === false && incoming.primary !== null && !incoming.callWaiting
			? incoming.primary.scope
			: null
	const ringingHost = useCallHostFor(ringingScope ?? "personnel")
	const hosting = resolveCallHosting({
		presentation: plan.presentation,
		callHost: host,
		ringing: ringingScope === null ? null : { scope: ringingScope },
		ringingHost: ringingScope === null ? null : ringingHost,
	})
	const ringingHosted =
		hosting !== null &&
		hosting.mode === "cover" &&
		hosted === null &&
		ringingHost !== null &&
		hosting.id === ringingHost.id
			? ringingHost
			: null
	const hostingId = hosting?.id ?? null
	const hostingMode = hosting?.mode ?? null
	useEffect(() => {
		publishCallHosting(
			hostingId === null || hostingMode === null
				? null
				: { id: hostingId, mode: hostingMode },
		)
	}, [hostingId, hostingMode])
	useEffect(() => {
		publishCallRinging(ringingScope === null ? null : { scope: ringingScope })
	}, [ringingScope])
	useEffect(
		() => () => {
			publishCallHosting(null)
			publishCallRinging(null)
		},
		[],
	)
	// Les puces suivent le PLAN, pas le magasin : le plan retire de la liste
	// l'appel de tête, qui est déjà à l'écran.
	const heldSlots = useMemo(
		() =>
			plan.held
				.map((id) => slots.find((s) => (s.meetingId as string) === id))
				.filter((s): s is (typeof slots)[number] => s !== undefined),
		[plan.held, slots],
	)

	// L'APPEL de tête, relu sur le serveur : c'est lui qui porte la machine
	// d'états (sonne / décroché / terminé), la raison d'une fin, l'attente.
	const { data: call } = useAuthenticatedConvexQuery(
		api.modules.calls.lifecycle.getCall,
		frontSlot ? { networkId, callId: frontSlot.meetingId } : "skip",
	)
	/**
	 * Le document tel que les modules de décision le lisent : `callKind` est
	 * le nom que `call-phase` et `call-kind-reconcile` donnent au genre de
	 * l'appel (`kind` côté moteur). `undefined` tant qu'il n'est pas arrivé,
	 * `null` pour un appel inconnu ou hors de portée.
	 */
	const meeting = useMemo(
		() => (call === undefined ? undefined : call === null ? null : { ...call, callKind: call.kind }),
		[call],
	)

	/**
	 * Le genre EFFECTIF de l'appel de tête (IC-02) — lu sur l'appel
	 * canonique, pas sur la photographie du slot.
	 *
	 * `slot.callKind` est décidé à la création du slot et n'était jamais
	 * re-dérivé : quand A ajoutait C à son tête-à-tête avec B, le serveur
	 * promouvait l'appel, mais A et B restaient en vue 1:1 pendant que C
	 * entrait dans une salle de groupe. Toute la surface branche désormais
	 * sur cette valeur — la query des conviés, le nom, la grille, les places,
	 * le rappel — et le slot est RÉCONCILIÉ (ci-dessous) pour que le reste du
	 * magasin (refus, actions) le sache aussi.
	 */
	const effectiveCallKind = deriveEffectiveCallKind({
		slotCallKind: frontSlot?.callKind,
		meetingCallKind: meeting?.callKind,
	})

	useEffect(() => {
		if (!frontSlot) return
		const patch = planSlotReconciliation(frontSlot, meeting, t)
		// `null` presque toujours : le magasin n'est écrit — et la surface
		// re-rendue — que lorsque l'appel dit quelque chose de neuf. Un slot
		// PARQUÉ promu pendant l'attente ne l'apprend qu'à sa reprise
		// (`getCall` n'est souscrit que pour l'appel de tête) : accepté.
		if (patch !== null) callStore.reconcileSlotFromMeeting(frontSlot.meetingId, patch)
	}, [frontSlot, meeting, t])

	/**
	 * Les personnes CONVIÉES à l'appel de tête, quand c'en est un de groupe.
	 *
	 * ⚠️ `"skip"` dès que l'appel n'est pas de groupe : cette query n'a rien à
	 * dire d'un tête-à-tête (elle rend `null`), et l'appeler à chaque appel
	 * direct paierait une lecture pour rien sur le chemin le plus fréquenté.
	 */
	const { data: groupCall } = useAuthenticatedConvexQuery(
		api.modules.calls.groupCalls.listParticipants,
		frontSlot && effectiveCallKind === "group"
			? { networkId, callId: frontSlot.meetingId }
			: "skip",
	)
	/**
	 * Les conviés tels que la grille les rend : la personne, et son nom choisi
	 * ou publié (`counterpartLabel`) — `null` quand il n'y a rien à nommer,
	 * l'écran dit alors le libellé neutre.
	 */
	const groupParticipants = useMemo<CallParticipantView[] | undefined>(
		() =>
			groupCall?.participants.map((participant) => ({
				userId: participant.personId,
				name: participant.label.displayName,
				avatarUrl: participant.label.avatarUrl,
				handle: participant.label.handle,
				state: participant.state,
				reason: participant.reason,
				isMe: participant.isMe,
				isCaller: participant.isCaller,
			})),
		[groupCall],
	)

	/**
	 * Le plafond de l'appel affiché — celui que le SERVEUR appliquera.
	 *
	 * ⚠️ Il se lit sur la projection de l'appel, jamais sur une constante : un
	 * 1:1 encore non promu n'en porte pas, et `callCapacityOf` replie alors sur
	 * le défaut. Un plafond deviné ici afficherait « plafond atteint » sur un
	 * appel qui a encore des places — le geste perdu au moment où il compte.
	 */
	const callCapacity = callCapacityOf(groupCall)

	/**
	 * MA personne — elle distingue « j'ai mis en attente » de « on m'a mis en
	 * attente » dans le `heldBy` de l'appel. Sans elle, le REPRENEUR verrait
	 * « Mis en attente » le temps d'un aller-retour, puisque son correspondant
	 * reste dans le tableau. Le réseau la connaît déjà : aucune lecture.
	 */
	const myUserId: string = personId

	const { mutateAsync: setCallRinging } = useConvexMutationQuery(
		api.modules.calls.lifecycle.setCallRinging,
	)
	const { mutateAsync: callMember } = useConvexMutationQuery(
		api.modules.calls.direct.callMember,
	)
	const ringingMarked = useRef(new Set<string>())
	/** L'appel pour lequel on est en train d'enregistrer un message vocal. */
	const [voicemailFor, setVoicemailFor] = useState<Id<"calls"> | null>(null)
	/** Le sélecteur « Ajouter une personne » est-il ouvert ? (ADR-0099) */
	const [addOpen, setAddOpen] = useState(false)
	/** L'ancien slot reste visible jusqu'à ce que le serveur ait créé le nouveau. */
	const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null)

	// Le panneau d'ajout suit SON appel : changer d'appel de tête (bascule,
	// fin) le referme — le laisser ouvert ajouterait à un autre appel.
	const frontMeetingKey = (frontSlot?.meetingId as string | undefined) ?? null
	useEffect(() => {
		setAddOpen(false)
	}, [frontMeetingKey])

	// Transition `initiating → ringing`, une seule fois par appel : sans elle,
	// le destinataire ne reçoit jamais la sonnerie.
	useEffect(() => {
		if (!frontSlot || frontSlot.direction !== "outgoing") return
		if (!frontSlot.token) return
		const key = frontSlot.meetingId as string
		if (ringingMarked.current.has(key)) return
		ringingMarked.current.add(key)
		void setCallRinging({ networkId, callId: frontSlot.meetingId }).catch(() => {
			// Idempotent côté serveur, et sans conséquence si l'appel a déjà
			// changé d'état : on n'alarme pas l'usager pour autant.
		})
	}, [frontSlot, setCallRinging, networkId])

	// Échap réduit la fenêtre de bureau. Jamais raccrocher : une frappe
	// malheureuse coûterait la conversation, sans rattrapage possible.
	//
	// ⚠️ Depuis IC-12, l'hôte ne s'abonne PLUS à `window` pour son compte : il
	// s'inscrit dans la pile Échap au palier le plus BAS (`SURFACE`). Son
	// écouteur, posé au montage, courait avant celui du sélecteur d'ajout monté
	// par-dessus : une seule frappe fermait le panneau ET réduisait l'appel.
	// Sans appel actif, la couche DÉCLINE (`false`) pour que la frappe descende.
	useEscapeLayer({
		id: "call-surface",
		priority: ESCAPE_PRIORITY.SURFACE,
		enabled: isMobile === false,
		onEscape: () => {
			if (!callStore.getActiveSlotId()) return false
			callStore.setMinimized(true)
		},
	})

	/**
	 * Le nom que porte la surface : pilule réduite, `aria-label` de la fenêtre,
	 * titre du plein écran.
	 *
	 * ⚠️ `peerDisplayName(slot.peer)` ne sait nommer qu'UN correspondant, et un
	 * appel de groupe n'en a pas — il aurait rendu un libellé générique et une
	 * initiale creuse, exactement le défaut constaté en production le
	 * 2026-08-22 sur `calleeName`. Un appel de groupe se nomme par son GROUPE.
	 */
	/**
	 * Le TITRE d'un appel de groupe : celui du fil d'où il part (`getCall`) ;
	 * sans fil — un tête-à-tête promu —, les noms des autres conviés, composés
	 * ici dans la langue de l'écran (le moteur ne stocke aucun titre) ; à
	 * défaut, celui que le slot a reçu au lancement.
	 */
	const composedTitle = useMemo(() => {
		// Les AUTRES conviés : leurs noms publiés, et leur nombre total — un
		// convié sans nom compte quand même dans le « +k ».
		const others = (groupParticipants ?? []).filter((participant) => !participant.isMe)
		const names = others
			.map((participant) => participant.name ?? "")
			.filter((name) => name.length > 0)
		return names.length > 0 ? composeGroupCallTitle({ names, total: others.length }, t) : null
	}, [groupParticipants, t])
	const groupTitle = meeting?.title ?? composedTitle ?? frontSlot?.group?.title ?? null
	const surfaceName =
		frontSlot !== null && effectiveCallKind === "group"
			? shortGroupLabel(
					{
						title: groupTitle,
						memberCount:
							groupCall?.summary.invited ?? frontSlot.group?.memberCount ?? null,
					},
					t,
				)
			: peerDisplayName(frontSlot?.peer, undefined, t)

	const onDisconnected = useCallback(
		(meetingId: Id<"calls">) => {
			void actions.hangUp(meetingId)
		},
		[actions],
	)

	const phase = deriveCallPhase(
		{
			direction: frontSlot?.direction ?? "outgoing",
			meeting: meeting ?? null,
			connection: frontSlot?.token ? "connected" : "connecting",
			hasRemote: false,
			isHeld: frontSlot?.status === "held",
			hasError: Boolean(frontSlot?.connectError ?? frontSlot?.roomError),
			answeredAtLocal: frontSlot?.answeredAt ?? null,
			myUserId,
		},
		t,
	)

	/**
	 * LES DEUX TONALITÉS de l'appelant. `deriveCallPhase` ne rend « ringing »
	 * que pour un appel SORTANT en attente de décrochage — mais il le rend AUSSI
	 * sur ses valeurs par défaut (aucun appel de tête, document pas encore
	 * chargé) : les deux gardes sur le slot évitent de sonner sans appel, ou
	 * pendant que l'écran de fin attend la mise à jour du document. Elles
	 * sonnent aussi RÉDUITES en pilule : un téléphone dans la poche sonne encore.
	 *
	 * Laquelle des deux (2026-09-01, modèle téléphonie) :
	 *  · appelé LIBRE → tonalité de RETOUR (ton long) ;
	 *  · appelé DÉJÀ EN COMMUNICATION (`calleeEngagedAtCreate`, photographié
	 *    par la mutation) → tonalité « OCCUPÉ » en continu, pendant que le
	 *    second appel se présente discrètement chez lui ;
	 *  · REFUS d'admission (slot posé `ended` par `openRefusedCall`) → rafale
	 *    « occupé » bornée sur l'écran de refus, quelle que soit la raison.
	 */
	const outgoingRinging =
		frontSlot !== null &&
		frontSlot.status !== "ended" &&
		phase.phase === "ringing"
	const calleeEngaged = meeting?.calleeEngagedAtCreate === true
	useRingback(outgoingRinging && !calleeEngaged)
	useBusyTone(outgoingRinging && calleeEngaged)
	useBusyTone(
		frontSlot !== null &&
			frontSlot.status === "ended" &&
			frontSlot.refusedAtPlacement === true,
		{ maxCycles: 3 },
	)
	/**
	 * LA TROISIÈME TONALITÉ : le correspondant m'a mis en attente.
	 *
	 * Le silence d'une attente est ambigu — il se confond avec une ligne
	 * coupée, un micro mort, un correspondant parti. Un double bip discret
	 * toutes les 4 s dit que la ligne vit. Mêmes gardes que les deux autres :
	 * un appel de tête, pas terminé, et la phase qui le justifie.
	 */
	useHoldTone(
		frontSlot !== null &&
			frontSlot.status !== "ended" &&
			phase.phase === "peer_held",
	)

	// Le mute ne coupe PAS la tonalité de retour (c'est MON appel), mais il
	// explique le silence des sonneries ENTRANTES : les surfaces le disent.
	const { muted: ringtoneMuted } = useRingtoneMutedPref()

	/**
	 * Le pool de salles, rendu dans TOUTES les branches ci-dessous : il survit
	 * à l'appel qui le remplit — réduit, terminé, ou parqué.
	 *
	 * ⚠️ La création d'une conférence (`ConferenceLaunchHost`, ADR-0149) vivait
	 * à côté du pool, pour la même raison. Elle appartient au lot `live`, qui
	 * n'est pas encore là : elle n'est PAS montée, et la ligne T3 d'un appel
	 * plein informe sans proposer (`onLaunch: null`, plus bas) — une demande
	 * que personne ne lit serait un bouton mort. Le lot `live` la remonte ici,
	 * et rebranche le geste (`useLaunchConference`).
	 */
	const pool = (
		<CallRoomPool
			slots={slots}
			activeSlotId={activeSlotId}
			options={LIVEKIT_DIRECT_CALL_ROOM_OPTIONS}
			onDisconnected={onDisconnected}
			onError={(meetingId, error) =>
				callStore.setSlotError(meetingId, {
					// `error.message` était rangé tel quel — donc en anglais, et
					// « Permission denied » pour un micro bloqué. Ce champ finit
					// sous les yeux de l'usager (`errorMessage` de `CallStage`) :
					// il doit porter une phrase, pas un code.
					roomError:
						describeCallMediaError(error, { video: cameraEnabled }, t) ??
						livekitRoomErrorMessage(error, t),
				})
			}
		/>
	)

	// L'appel entrant mis en avant, quand je ne suis pas déjà en ligne : au
	// téléphone il prend l'écran ; au bureau il prend le CORPS de la carte iCom
	// quand elle est là (`ringingHosted`, même écran qu'au téléphone — c'est un
	// téléphone), sinon il se pose en bannière.
	const incomingSurface =
		incoming.primary !== null && !incoming.callWaiting ? (
			isMobile || ringingHosted !== null ? (
				<IncomingCallCard
					call={incoming.primary}
					quickReplies={incoming.quickReplies}
					audioBlocked={incoming.audioBlocked && incoming.audible !== null}
					ringtoneMuted={ringtoneMuted}
					// Dans une carte MOYENNE (≈ 360 px de corps), l'écran se
					// resserre pour que Refuser et Répondre restent visibles ;
					// le téléphone (réel ou détaché) garde l'écran entier.
					density={
						ringingHosted !== null && ringingHosted.pose !== "phone"
							? "compact"
							: "phone"
					}
					onAnswer={(mediaType) =>
						incoming.primary && answerIncoming(incoming.primary, mediaType)
					}
					onDecline={(note) => {
						if (!incoming.primary) return
						declineIncoming(incoming.primary, note)
					}}
				>
					{/* Les appels SECONDAIRES restent visibles, en compact : le
					    second appelant ne doit pas sonner dans le vide. */}
					{incoming.secondary.map((secondary) => (
						<button
							key={secondary.meetingId as string}
							type="button"
							className="iappel-chip"
							onClick={() => answerIncoming(secondary, secondary.mediaType)}
						>
							{t("globalCallSurfaceHost.answerSecondary", {
								name: peerDisplayName(secondary.caller, undefined, t),
							})}
						</button>
					))}
				</IncomingCallCard>
			) : (
				<>
					<IncomingCallBanner
						call={incoming.primary}
						quickReplies={incoming.quickReplies}
						audioBlocked={incoming.audioBlocked && incoming.audible !== null}
						ringtoneMuted={ringtoneMuted}
						onAnswer={(mediaType) =>
							incoming.primary && answerIncoming(incoming.primary, mediaType)
						}
						onDecline={(note) => {
							if (!incoming.primary) return
							declineIncoming(incoming.primary, note)
						}}
					/>
					{incoming.secondary[0] && (
						<IncomingCallBanner
							call={incoming.secondary[0]}
							rank={2}
							onAnswer={(mediaType) => {
								const second = incoming.secondary[0]
								if (!second) return
								answerIncoming(second, mediaType)
							}}
							onDecline={() => {
								const second = incoming.secondary[0]
								if (!second) return
								declineIncoming(second)
							}}
						/>
					)}
				</>
			)
		) : null

	// Un appel entrant SANS aucun appel en cours : la carte plein écran suffit,
	// la surface n'a rien à montrer. C'est le PLAN qui le dit — se fier à
	// `frontSlot === null` faisait disparaître la surface entière dès que tous
	// les appels étaient parqués, conversations LiveKit encore vivantes.
	if (frontSlot === null || plan.presentation === "hidden") {
		return (
			<>
				{pool}
				{incomingSurface !== null && ringingHosted !== null ? (
					/* DANS le téléphone iCom : l'écran d'appel entrant couvre le
					   corps de la carte (elle s'est dépliée ou ouverte pour lui),
					   à la place de la bannière au viewport. */
					createPortal(
						<section
							className="iappel-hosted"
							role="region"
							aria-label={t("globalCallSurfaceHost.incomingRegion")}
						>
							{incomingSurface}
						</section>,
						ringingHosted.element,
					)
				) : incomingSurface !== null && isMobile ? (
					<div className="iappel-layer fixed inset-0">{incomingSurface}</div>
				) : (
					incomingSurface
				)}
			</>
		)
	}

	const ended = frontSlot.status === "ended" || phase.endKind !== null

	// Enregistrement d'un message vocal : il remplace l'écran de fin le temps
	// de la prise, sur la même surface — ouvrir une seconde fenêtre par-dessus
	// ferait perdre de vue à qui l'on parle.
	if (ended && voicemailFor === frontSlot.meetingId) {
		return (
			<>
				{pool}
				<CallSurface
					isMobile={isMobile}
					plan={plan}
					frontId={frontSlot.meetingId}
					peerName={surfaceName}
					pillState={{ timerStart: null, label: phase.label }}
					host={hosted}
					onToggleMic={() => callStore.setMicMuted(!micMuted)}
					onRestore={actions.restore}
					onHangUp={(meetingId) => void actions.hangUp(meetingId)}
				>
					<div className="call-hero-dark flex h-full w-full items-center justify-center px-8">
						<VoicemailRecorder
							meetingId={frontSlot.meetingId}
							peerName={surfaceName}
							onSent={() => {
								setVoicemailFor(null)
								callStore.removeSlot(frontSlot.meetingId)
							}}
							onCancel={() => setVoicemailFor(null)}
						/>
					</div>
				</CallSurface>
			</>
		)
	}

	/**
	 * Ce qui se pose PAR-DESSUS l'écran, quel qu'il soit : la puce « Prendre »
	 * d'un appel qui sonne pendant qu'on est en ligne, et les appels parqués.
	 *
	 * ⚠️ Composé une seule fois et servi AUX DEUX écrans. L'écran de fin n'en
	 * recevait aucun : quand le correspondant raccrochait pendant qu'un
	 * troisième appelait, la bannière d'entrant était supprimée (un appel
	 * vivant dans le magasin rend `callWaiting` vrai) et l'écran de fin ne
	 * montrait rien — plus aucun moyen de décrocher.
	 */
	const incrustations = (
		<>
			{incoming.callWaiting && incoming.primary && (
				<CallWaitingChip
					call={incoming.primary}
					onAccept={() => {
						const waiting = incoming.primary
						if (!waiting) return
						answerIncoming(waiting, waiting.mediaType)
					}}
					onDecline={() => {
						const waiting = incoming.primary
						if (!waiting) return
						declineIncoming(waiting)
					}}
				/>
			)}
			<HeldCallChips
				calls={heldSlots.map((slot) => ({
					meetingId: slot.meetingId as string,
					name: peerDisplayName(slot.peer, undefined, t),
					heldSince: slot.heldSince ?? null,
				}))}
				onResume={(meetingId) => void actions.swap(meetingId as Id<"calls">)}
				onHangUp={(meetingId) => void actions.hangUp(meetingId as Id<"calls">)}
			/>
			{/* Le sélecteur « Ajouter une personne » (ADR-0099). Il reçoit la
			    PROJECTION serveur des conviés et en tire lui-même les places
			    (IC-03/IC-04, `projectCallSeats`) ; le serveur reste l'arbitre du
			    plafond et du périmètre. */}
			{addOpen && !ended && (
				<AddToCallPanel
					meetingId={frontSlot.meetingId}
					callKind={effectiveCallKind}
					participants={groupParticipants}
					// Sans projection encore arrivée sur un groupe, l'effectif
					// annoncé par le slot tient lieu de places prises — jamais
					// moins que les deux d'un tête-à-tête.
					fallbackOccupied={
						effectiveCallKind === "group"
							? Math.max(2, frontSlot.group?.memberCount ?? 2)
							: 2
					}
					maxParticipants={callCapacity}
					// Téléphone → FEUILLE au-dessus du clavier ; bureau → panneau
					// ancré sur la scène (IC-11). Tant que le format est inconnu
					// (`null` au rendu serveur), la feuille : se tromper vers elle
					// laisse le panneau atteignable, l'ancrage le sortirait de l'écran.
					pose={isMobile === false ? "anchored" : "sheet"}
					onClose={() => setAddOpen(false)}
				/>
			)}
		</>
	)

	const retryAvailable =
		effectiveCallKind !== "group" && frontSlot.peer?.userId !== undefined
	const writeHref =
		effectiveCallKind !== "group" && frontSlot.peer?.handle
			? conversationHref(draftKey(frontSlot.peer.handle), routes.messages())
			: null

	const retryCall = async () => {
		if (!retryAvailable || !frontSlot.peer?.userId) return
		const oldMeetingId = frontSlot.meetingId
		const mediaType = frontSlot.mediaType ?? "audio"
		const scope = frontSlot.scope ?? "personnel"
		const peer = frontSlot.peer
		const peerUserId = frontSlot.peer.userId
		setRetryingMeetingId(oldMeetingId as string)
		try {
			const placed = await callMember({
				networkId,
				target: { personId: peerUserId },
				mediaType,
			})

			callStore.removeSlot(oldMeetingId)
			if (placed.admitted === false) {
				callStore.openRefusedCall({
					meetingId: placed.callId,
					callee: peer,
					scope,
					mediaType,
					endKind: refusalEndKind(placed.reason),
					voicemailOffered: placed.voicemailOffered,
				})
				return
			}

			callStore.openOutgoingCall({
				meetingId: placed.callId,
				participantUserId: peerUserId,
				mediaType,
				startedAt: Date.now(),
				scope,
				callee: peer,
			})
		} catch (err) {
			toast.error(callErrorMessage(err, t), { duration: 8000 })
		} finally {
			setRetryingMeetingId(null)
		}
	}

	const writeToPeer = () => {
		if (!writeHref) return
		router.push(writeHref)
		callStore.removeSlot(frontSlot.meetingId)
	}

	const body = ended ? (
		<CallEndScreen
			kind={frontSlot.endKind ?? phase.endKind ?? "ended"}
			peer={frontSlot.peer ?? null}
			// Le mot laissé par le destinataire quand il refuse à la main ; le
			// moteur ne compose aucune phrase de refus d'admission : l'écran la
			// compose depuis la raison (`describeCallEnd`).
			note={
				frontSlot.endKind === "declined"
					? (frontSlot.endNote ?? meeting?.declineNote ?? null)
					: null
			}
			voicemailOffered={frontSlot.voicemailOffered === true}
			retryAvailable={retryAvailable}
			retrying={retryingMeetingId === (frontSlot.meetingId as string)}
			writeAvailable={writeHref !== null}
			onRetry={() => void retryCall()}
			onWrite={writeToPeer}
			onLeaveVoicemail={() => setVoicemailFor(frontSlot.meetingId)}
			onClose={() => callStore.removeSlot(frontSlot.meetingId)}
		>
			{incrustations}
		</CallEndScreen>
	) : (
		<CallStage
			peer={frontSlot.peer ?? null}
			direction={frontSlot.direction ?? "outgoing"}
			meeting={meeting ?? null}
			isHeld={frontSlot.status === "held"}
			/* Ce qui distingue « j'ai mis en attente » de « on m'a mis en
			   attente » : sans lui, le repreneur verrait « Mis en attente » le
			   temps d'un aller-retour. */
			myUserId={myUserId}
			hasError={Boolean(frontSlot.connectError ?? frontSlot.roomError)}
			errorMessage={frontSlot.connectError ?? frontSlot.roomError ?? null}
			micMuted={micMuted}
			micBlocked={micBlocked}
			cameraEnabled={cameraEnabled}
			onToggleMic={() => callStore.setMicMuted(!micMuted)}
			onToggleCamera={() => callStore.setCameraEnabled(!cameraEnabled)}
			onHangUp={() => void actions.hangUp(frontSlot.meetingId)}
			onMinimize={actions.minimize}
			onHold={() => void actions.hold(frontSlot.meetingId)}
			onResume={() => void actions.resume(frontSlot.meetingId)}
			onAddParticipant={() => setAddOpen(true)}
			/* ── Appel de GROUPE ──────────────────────────────────────────────
			   Le titre vient de l'appel ou des conviés, à défaut du magasin
			   (posé au lancement, donc affiché IMMÉDIATEMENT) ; l'effectif et les
			   états viennent du serveur. Attendre le serveur pour tout laisserait
			   l'écran anonyme pendant toute la première seconde — précisément
			   quand on regarde à qui l'on est en train de téléphoner. */
			group={
				effectiveCallKind === "group"
					? {
							title: groupTitle ?? t("globalCallSurfaceHost.groupFallbackTitle"),
							memberCount:
								groupCall?.summary.invited ?? frontSlot.group?.memberCount ?? 0,
						}
					: null
			}
			participants={groupParticipants}
			/* ── La borne d'un appel de groupe (ADR-0149, T3) ─────────────────
			   Les places restantes viennent de la MÊME projection serveur que
			   la grille (`summary.remaining`) : c'est le chiffre qu'`addInvitee`
			   compare. Inconnues (projection pas encore arrivée) ⇒ `null`, et
			   la scène garde « Ajouter » — mieux vaut un bouton que le serveur
			   refusera qu'une ligne « complet » qui affirme le faux.
			   `onLaunch: null` : la conférence (lot `live`) n'est pas encore
			   montée — la ligne informe sans proposer (voir `pool`). */
			conference={
				effectiveCallKind === "group"
					? {
							capacity: callCapacity,
							remaining: groupCall?.summary.remaining ?? null,
							context: "thread",
							onLaunch: null,
						}
					: null
			}
			// Dans le corps d'une carte iCom, la scène a la largeur d'un
			// téléphone : la disposition mobile est la bonne avant même que la
			// grille se soit mesurée (IC-03).
			viewport={hostMode === "cover" || isMobile === true ? "mobile" : "desktop"}
		>
			{incrustations}
		</CallStage>
	)

	return (
		<>
			{pool}
			<CallSurface
				isMobile={isMobile}
				plan={plan}
				frontId={frontSlot.meetingId}
				peerName={surfaceName}
				pillState={{ timerStart: phase.timerStart, label: phase.label }}
				// Une grille de groupe dans 400 px ne montre personne : la
				// fenêtre s'élargit pour le groupe, et pour lui seul (IC-10).
				callKind={effectiveCallKind === "group" ? "group" : "direct"}
				host={hosted}
				onToggleMic={() => callStore.setMicMuted(!micMuted)}
				onRestore={actions.restore}
				onHangUp={(meetingId) => void actions.hangUp(meetingId)}
			>
				{body}
			</CallSurface>
			{/* ⚠️ Plus de garde `!isMobile`. Au téléphone, l'écran de fin occupe
			    tout le champ : masquer l'entrant y rendait l'appel qui sonne
			    totalement invisible. */}
			{incomingSurface}
		</>
	)
}
