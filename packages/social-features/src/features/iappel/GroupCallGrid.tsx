// Dupliqué de socle/packages/agent-features/src/features/iappel/GroupCallGrid.tsx @ ad2e7fdc2 — adaptations : libellés, états de vidéo, puce « Appelant » et noms accessibles traduits (i18n `iappel`, nom interpolé) ; `participantStatusLabel` et `conferenceHintCopy` reçoivent `t` en dernier paramètre ; compte exempté retiré de la conférence (`exempt` : aucun compte sans plafond dans le moteur).
"use client"

/**
 * GroupCallGrid — LA GRILLE D'UN APPEL DE GROUPE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE COMPOSANT EST CE QUI MANQUAIT POUR QUE L'APPEL RESTE UN APPEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'appel à plusieurs partait sur le canal iRÉUNION pour une seule raison :
 * « seule la scène de réunion sait afficher vingt personnes ». Le canal
 * portait donc le poids d'une lacune d'affichage — et avec lui tout le
 * vocabulaire de la réunion, sa sonnerie de cinq minutes, et un bouton
 * « agrandir » pointant vers une route que l'espace agent n'a pas.
 *
 * D'où ce composant : une grille d'appel, dans la surface d'appel, sous le
 * `RoomContext` du pool global. Il ne monte AUCUN `<LiveKitRoom>` et AUCUN
 * `RoomAudioRenderer` — le pool s'en charge, et un second attacherait un
 * deuxième `<audio>` aux mêmes pistes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE VIGNETTE PAR PERSONNE CONVIÉE — MÊME CELLES QUI NE RÉPONDENT PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La grille ne se construit PAS sur les participants LiveKit présents, mais
 * sur la liste des personnes conviées (`listParticipants`, côté serveur). La
 * différence est tout le sujet : quelqu'un qui n'a pas encore décroché n'est
 * dans aucune salle, et une grille bâtie sur le SFU le ferait disparaître —
 * l'appelant ne saurait pas s'il sonne, s'il a refusé, ou s'il n'a jamais été
 * appelé.
 *
 * Chaque vignette porte donc son ÉTAT (`Sonne…`, `A refusé`, `Indisponible`),
 * et la piste vidéo vient s'y poser QUAND elle arrive.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA CLÉ D'UNE VIGNETTE EST LE `userId` — PAS L'IDENTITÉ LIVEKIT (2026-09-13)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'identité LiveKit vaut `{subject}::{nonce}`, unique par CONNEXION ; la
 * grille, elle, est bâtie sur des `userId`. Les deux ne se sont jamais égalés
 * : ma vignette montrait mon avatar pendant que ma caméra tournait ailleurs,
 * et les caméras des autres restaient des initiales (capture du propriétaire,
 * appel « Cyber & Digital »). `CallStage` range désormais pistes, micros
 * coupés et « qui parle » PAR `userId` (le jeton le porte,
 * `participant-identity.ts`), et ma propre vignette est reconnue par `isMe`
 * avant toute clé — elle prend `localTrack` même face à un jeton muet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE MODÈLE : WHATSAPP (captures du 2026-09-13)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les captures d'appels vidéo de groupe WhatsApp (3, 4, 6 et 8 personnes)
 * montrent quatre règles, reprises ici :
 *  · les vignettes REMPLISSENT la scène — deux colonnes sur téléphone, des
 *    lignes de hauteur égale, aucune bande vide (`--iappel-grid-rows`) ;
 *  · à nombre IMPAIR, la première case prend toute la largeur, en haut
 *    (`data-span="row"`, décidé par `planGroupGrid`) ;
 *  · JE SUIS dans la grille, en DERNIÈRE case et en MIROIR — pas une
 *    incrustation posée par-dessus (`compareParticipants`, `data-me`) ;
 *  · le nom et le micro coupé se lisent en bas à gauche de chaque case.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DE 2 À 11 AU TÉLÉPHONE iCom (ADR-0149, 2026-09-14)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · une VRAIE grille CSS à pistes (`--iappel-grid-tracks`) : le reste de la
 *    division va sur la première ligne — dix sur trois colonnes, une case
 *    pleine largeur ; onze, deux demi-cases (`planGroupGrid`) ;
 *  · « Ajouter » n'est plus jamais une cellule, c'est une barre ; au dernier
 *    siège, la ligne T3 « Appel complet » la REMPLACE, à la même place ;
 *  · toucher une vignette l'ÉPINGLE et bascule en scène + bande ; la retoucher
 *    rend la grille ;
 *  · l'auteur de l'appel porte une puce « Appelant » — c'est ce qu'un invité
 *    cherche d'abord en décrochant.
 */

import { VideoTrack, type TrackReference } from "@livekit/components-react"
import { MicOff, Pin, UserPlus } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar } from "../reseau-personnel/Avatar"
import type { CallParticipantView } from "./call-types"
import { ConferenceHintCard } from "./ConferenceHintCard"
import {
	conferenceHintCopy,
	planConferenceHint,
	type ConferenceHintContext,
} from "./conference-hint"
import {
	avatarSizeFor,
	compareParticipants,
	isLiveParticipant,
	participantStatusLabel,
	pickStageIdentity,
	planGroupGrid,
	reservesGridSeat,
} from "./group-stage"
import { classifyRemoteVideo, probeOf, type CameraTrackLike } from "./remote-video"
import { useStageSize } from "./use-stage-size"

/**
 * Une piste distante PUBLIÉE mais pas encore REÇUE. Le `<video>` est monté
 * quand même — c'est ce qui déclenche l'envoi sous `adaptiveStream` (cf.
 * `remote-video.ts`) — mais il est noir pendant une seconde ou deux : la
 * vignette le DIT, plutôt que de laisser croire à une panne. Une référence
 * sans publication (harnais, forme réduite) est tenue pour vivante.
 */
function isConnectingTrack(track: TrackReference): boolean {
	const ref = track as Partial<CameraTrackLike>
	if (ref.publication === undefined || ref.participant === undefined) return false
	return (
		classifyRemoteVideo(
			probeOf({ participant: ref.participant, publication: ref.publication }),
		) === "connecting"
	)
}

/**
 * Ce que la scène sait de la CONFÉRENCE (ADR-0149) — de quoi dire « l'appel
 * est complet » et proposer la sortie, au lieu de retirer « Ajouter » sans un
 * mot.
 */
export interface GroupCallConference {
	/** Plafond de l'APPEL, appelant compris — lu du serveur, jamais la constante. */
	capacity: number
	/** Places restantes dans l'appel ; `null` tant qu'on ne sait pas. */
	remaining: number | null
	/** D'où part l'appel : le mot qui nomme l'audience de la conférence. */
	context: ConferenceHintContext
	/** Ouvre la création de la conférence ; `null` ⇒ la ligne informe seulement. */
	onLaunch: (() => void) | null
}

export interface GroupCallGridProps {
	participants: readonly CallParticipantView[]
	/**
	 * Pistes caméra des AUTRES, indexées par PERSONNE — le `userId` que le
	 * jeton porte (`participant-identity.ts`), c'est-à-dire la clé même de
	 * `participants[].userId`. Une clé qui serait l'identité LiveKit brute ne
	 * retrouve aucune vignette : c'est le défaut du 2026-09-13.
	 *
	 * ⚠️ La piste LOCALE n'y figure pas — elle arrive par `localTrack`. Elle y
	 * était, et la scène la rendait DEUX fois : une dans ma vignette (`isMe`),
	 * une dans l'incrustation `LocalPip` posée par-dessus.
	 */
	tracksByIdentity: ReadonlyMap<string, TrackReference>
	/** Ma propre caméra — rendue une seule fois, dans MA vignette. */
	localTrack?: TrackReference | null
	/**
	 * La caméra est DEMANDÉE mais rien n'est encore publié (permission en
	 * cours, périphérique qui démarre, salle en connexion). Ma vignette le dit
	 * — « Caméra en cours… » — au lieu d'un avatar muet sous un bouton allumé.
	 */
	localCameraPending?: boolean
	/**
	 * Ma clé (mon `userId`), pour placer `localTrack`. Ma vignette est de
	 * toute façon reconnue par `isMe` : cette clé n'est qu'un second chemin.
	 */
	localIdentity?: string | null
	/** Personnes (clés `userId`) dont le micro est coupé — la vignette le dit. */
	mutedIdentities?: ReadonlySet<string>
	/** Qui parle en ce moment (clés `userId`) — la vignette s'entoure. */
	speakingIdentities?: ReadonlySet<string>
	/** Repli quand le conteneur n'a pas encore été mesuré. */
	viewport: "mobile" | "desktop"
	/**
	 * Ouvre le sélecteur « Ajouter une personne » (ADR-0099). Toujours une
	 * BARRE sous la grille (ADR-0149) — absente (`null`/`undefined`) quand
	 * l'hôte ne la donne pas : une commande indisponible se masque, elle ne se
	 * rend jamais inerte.
	 */
	onAdd?: (() => void) | null
	/**
	 * La conférence (ADR-0149). `remaining === 0` ⇒ plus de barre « Ajouter » :
	 * la ligne T3 prend sa place. Un siège qui se libère fait revenir
	 * « Ajouter ».
	 */
	conference?: GroupCallConference | null
	/** Puces, bandeaux d'appel entrant… posés PAR-DESSUS la grille. */
	children?: React.ReactNode
}

export function GroupCallGrid({
	participants,
	tracksByIdentity,
	localTrack,
	localCameraPending,
	localIdentity,
	mutedIdentities,
	speakingIdentities,
	viewport,
	onAdd,
	conference,
	children,
}: GroupCallGridProps) {
	const { t } = useTranslation("iappel")
	// L'ordre est une décision, pas un hasard : ceux à qui je parle d'abord,
	// celui qui a raccroché garde sa place mais recule, et MOI en dernier —
	// la case « Vous » de WhatsApp, ancrée en bas à droite.
	const ordered = useMemo(
		() => [...participants].sort(compareParticipants),
		[participants],
	)

	// L'appel est-il PLEIN ? La décision appartient au module pur, pas à un
	// `=== 0` recopié ici : T3 est un ÉTAT (il ne se ferme pas) — la borne de
	// structure vaut pour tout appel.
	const hint =
		conference != null
			? planConferenceHint({
					moment: "in_call",
					capacity: conference.capacity,
					seats: conference.remaining,
				})
			: null
	const callFull = hint?.kind === "T3"
	const canAdd = !callFull && Boolean(onAdd)
	// La ligne T3 prend EXACTEMENT la place de la barre : la grille garde sa
	// réserve, et rien ne se rebat au moment où le dernier siège est pris.
	const reservesBar = canAdd || callFull

	// ⚠️ La disposition se mesure sur CETTE surface, pas sur le navigateur : la
	// fenêtre flottante fait 400 px de large sur un écran de 1920 (IC-10).
	const stageRef = useRef<HTMLDivElement | null>(null)
	const measured = useStageSize(stageRef)
	const layout = planGroupGrid({
		count: ordered.length,
		// ⚠️ Le plafond de lisibilité se juge sur les SIÈGES : un refus garde sa
		// vignette sans tenir de place, et onze sièges plus un refus ne doivent
		// pas faire basculer la scène à 390 px (fiche §4).
		seats: ordered.filter(reservesGridSeat).length,
		width: measured?.width,
		height: measured?.height,
		hasAddTile: reservesBar,
		viewport,
	})

	/**
	 * Épinglé par l'usager — un choix explicite ne se fait pas déloger. On
	 * retient aussi l'ÉTAT de la personne au moment du geste (cf. l'épingle
	 * effective, plus bas).
	 */
	const [pinned, setPinned] = useState<{
		identity: string
		state: CallParticipantView["state"]
	} | null>(null)
	/** Le dernier à avoir parlé : sans lui, la scène sauterait à chaque silence. */
	const [lastSpeaker, setLastSpeaker] = useState<string | null>(null)
	// MOI exclu : ma propre voix ne me met pas en scène (cf. `pickStageIdentity`).
	const speakingKey = useMemo(() => {
		const mine = new Set(
			ordered.filter((participant) => participant.isMe).map((p) => String(p.userId)),
		)
		return [...(speakingIdentities ?? [])]
			.filter((identity) => !mine.has(identity))
			.sort()
			.join("|")
	}, [speakingIdentities, ordered])
	useEffect(() => {
		if (speakingKey.length === 0) return
		const first = speakingKey.split("|")[0]
		if (first !== undefined && first.length > 0) setLastSpeaker(first)
	}, [speakingKey])

	/**
	 * Scène + bande : quand la grille ne tient plus (`compact`), OU quand
	 * l'usager a ÉPINGLÉ quelqu'un (ADR-0149). Épingler est un geste
	 * volontaire — « je veux voir celui-là en grand » — et une grille où
	 * l'épinglé resterait une case parmi onze ne répondrait pas au geste.
	 *
	 * ⚠️ Un DÉPART défait l'épingle. Un participant qui raccroche, refuse ou
	 * devient injoignable GARDE sa ligne (`compareParticipants`) : une garde sur
	 * la seule présence dans la liste laissait la scène ouverte sur un avatar
	 * grisé « A quitté », les correspondants en ligne relégués dans la bande.
	 * L'épingle ne compte donc que si la personne est vivante ou sonne — OU
	 * n'a pas changé d'état depuis le geste : épingler délibérément quelqu'un
	 * qui a déjà refusé reste possible, sinon sa vignette serait un bouton
	 * inerte. Tout se calcule : aucun effet ne réécrit l'état.
	 */
	const pinnedParticipant =
		pinned === null
			? undefined
			: ordered.find((participant) => String(participant.userId) === pinned.identity)
	const effectivePinned =
		pinned !== null &&
		pinnedParticipant !== undefined &&
		(isLiveParticipant(pinnedParticipant) ||
			pinnedParticipant.state === "ringing" ||
			pinnedParticipant.state === pinned.state)
			? pinned.identity
			: null
	const pinnedPresent = effectivePinned !== null
	const stageMode = layout.compact || pinnedPresent
	const stageIdentity = stageMode
		? pickStageIdentity({
				ordered,
				speaking: speakingIdentities,
				pinned: effectivePinned,
				lastSpeaker,
			})
		: null

	/**
	 * Le focus SUIT la vignette épinglée ou détachée.
	 *
	 * ⚠️ Passer de la grille à la scène (et retour) change de branche : le
	 * bouton activé est DÉMONTÉ, et le focus retombait sur `<body>` — hors de la
	 * carte iCom, qui n'est pas modale. Le Tab suivant repartait du haut de la
	 * page. On ne ramène le focus que si l'usager l'avait sur la vignette : un
	 * changement de scène venu de la parole ne vole rien.
	 */
	const restoreFocusRef = useRef<string | null>(null)
	useLayoutEffect(() => {
		const wanted = restoreFocusRef.current
		if (wanted === null) return
		restoreFocusRef.current = null
		// Comparer le dataset plutôt que construire un sélecteur : pas besoin
		// d'échapper un identifiant.
		const target = Array.from(
			stageRef.current?.querySelectorAll<HTMLButtonElement>("button.iappel-tile") ?? [],
		).find((element) => element.dataset.userId === wanted)
		target?.focus({ preventScroll: true })
	}, [effectivePinned, stageIdentity])

	/**
	 * La piste d'une vignette. MA vignette est reconnue par `isMe` AVANT toute
	 * clé : c'est ce qui la garde vivante face à un jeton qui ne porterait pas
	 * mon `userId` (serveur LiveKit antérieur à la v1.6).
	 */
	const trackOf = (participant: CallParticipantView): TrackReference | null => {
		const key = String(participant.userId)
		if (participant.isMe || (localIdentity != null && key === localIdentity)) {
			return localTrack ?? null
		}
		return tracksByIdentity.get(key) ?? null
	}

	const renderTile = (
		participant: CallParticipantView,
		options: {
			strip?: boolean
			stage?: boolean
			/** Vignette pleine largeur (seule en tête d'une grille à plusieurs colonnes). */
			span?: boolean
			/** Vignette de la première ligne. */
			firstRow?: boolean
			/** Pistes CSS couvertes par la vignette, en grille. */
			tileSpan?: number
		},
	) => {
		const identity = String(participant.userId)
		const track = trackOf(participant)
		const live = isLiveParticipant(participant)
		// L'état de la PERSONNE d'abord (« Sonne… », « A refusé »…) ; sinon
		// celui de sa VIDÉO, qui explique un avatar ou un cadre noir passager.
		const videoStatus =
			participant.isMe && track === null && localCameraPending === true
				? t("groupCallGrid.cameraPending")
				: !participant.isMe && track !== null && isConnectingTrack(track)
					? t("groupCallGrid.videoConnecting")
					: null
		const status = participantStatusLabel(participant, t) ?? videoStatus
		const epingle = effectivePinned === identity
		const muet = mutedIdentities?.has(identity) === true && live
		const variant = options.stage === true ? "stage" : options.strip === true ? "strip" : "grid"
		// La puce « Appelant » : sur la scène et en grille, jamais dans la bande
		// (96 px n'y portent que le nom), et jamais sur MA vignette — l'appelant
		// sait qu'il a appelé.
		const appelant =
			participant.isCaller === true && participant.isMe !== true && options.strip !== true
		// `appelant` exclut `isMe` : une seule mention au plus après le nom.
		const nomAnnonce = t(
			appelant ? "groupCallGrid.announceCaller" : participant.isMe ? "groupCallGrid.announceMe" : "groupCallGrid.announce",
			{ name: participant.name ?? t("groupCallGrid.thisPeer") },
		)
		// Ce que la vignette MONTRE et que l'`aria-label` masquerait : l'état de
		// la personne ou de sa vidéo, et le micro coupé.
		const etatAnnonce = [status, muet ? t("groupCallGrid.mutedState") : null]
			.filter((part): part is string => part !== null)
			.join(", ")
		const gesteAnnonce = t(epingle ? "groupCallGrid.unpin" : "groupCallGrid.pin", { name: nomAnnonce })
		// ⚠️ Pas de balise dynamique (`const Tag = … ? "button" : "div"`) : le
		// typage n'accepte pas `type` sur un `div`, et un `as any` masquerait
		// exactement le genre d'erreur qu'on veut voir.
		//
		// Aucune proportion inline : en grille, la case se déduit des pistes et
		// des lignes (feuille de style, `--iappel-grid-tracks/rows` et
		// `--iappel-tile-span`) ; en scène elle occupe la place ; en bandeau
		// elle a sa taille fixe.
		const commonProps = {
			className:
				options.strip === true
					? "iappel-tile iappel-strip-tile"
					: "iappel-tile",
			"data-user-id": identity,
			"data-live": live ? "true" : "false",
			"data-speaking":
				speakingIdentities?.has(identity) === true ? "true" : "false",
			"data-pinned": epingle ? "true" : undefined,
			"data-me": participant.isMe ? "true" : undefined,
			"data-caller": appelant ? "true" : undefined,
			"data-span": options.span === true ? "row" : undefined,
			"data-first-row": options.firstRow === true ? "true" : undefined,
			style:
				options.tileSpan !== undefined
					? ({ "--iappel-tile-span": options.tileSpan } as React.CSSProperties)
					: undefined,
		}
		const corps = (
			<>
				{track !== null ? (
					<VideoTrack trackRef={track} className="iappel-video" />
				) : (
					<div className="iappel-tile-body">
						<Avatar
							displayName={participant.name ?? "?"}
							avatarUrl={participant.avatarUrl}
							size={avatarSizeFor(layout.tileWidth, variant, layout.tileHeight, {
								caller: appelant,
							})}
						/>
					</div>
				)}

				{appelant && (
					<span className="iappel-tile-caller" aria-hidden="true">
						{t("groupCallGrid.caller")}
					</span>
				)}

				{/* Le nom et l'état, TOUJOURS — y compris par-dessus la vidéo :
				    une grille de visages sans nom oblige à deviner qui parle. Le
				    micro coupé se lit à côté du nom, là où WhatsApp le met. */}
				<div className="iappel-tile-foot">
					<span className="iappel-tile-foot-row">
						{muet && (
							<span className="iappel-tile-mute" aria-label={t("groupCallGrid.muted")}>
								<MicOff aria-hidden="true" className="h-2.5 w-2.5" />
							</span>
						)}
						<span className="iappel-tile-name">
							{participant.isMe
								? t("groupCallGrid.meName", { name: participant.name ?? t("groupCallGrid.peer") })
								: (participant.name ?? t("groupCallGrid.peer"))}
						</span>
					</span>
					{status !== null && (
						<span className="iappel-tile-state">{status}</span>
					)}
				</div>

				{epingle && (
					<span className="iappel-tile-mic" aria-hidden="true">
						<Pin className="h-3 w-3" />
					</span>
				)}
			</>
		)

		// TOUTE vignette est un bouton — en grille aussi depuis ADR-0149 :
		// toucher un visage le met en grand (scène + bande), le retoucher rend
		// la grille. Une vignette de grille inerte ne laissait aucun moyen de
		// regarder quelqu'un de près à onze.
		return (
			<button
				key={identity}
				type="button"
				{...commonProps}
				onClick={(event) => {
					if (document.activeElement === event.currentTarget) {
						restoreFocusRef.current = identity
					}
					setPinned(
						effectivePinned === identity
							? null
							: { identity, state: participant.state },
					)
				}}
				aria-pressed={epingle}
				// ⚠️ L'`aria-label` REMPLACE TOUT le contenu du bouton pour un
				// lecteur d'écran : la puce « Appelant », « (vous) », l'état
				// (« Sonne… », « A refusé »…) et le micro coupé n'y seraient jamais
				// lus. Ils sont donc redits ici — depuis que la vignette de GRILLE
				// est un bouton (ADR-0149), c'était onze cases muettes.
				aria-label={
					etatAnnonce.length > 0
						? t("groupCallGrid.labelWithState", { action: gesteAnnonce, state: etatAnnonce })
						: gesteAnnonce
				}
			>
				{corps}
			</button>
		)
	}

	/**
	 * Sous la grille : « Ajouter » tant qu'il reste un siège, la ligne T3 au
	 * dernier — jamais les deux, jamais un bouton inerte (ADR-0149).
	 *
	 * ⚠️ T3 est rendu par `ConferenceHintCard`, qui se positionne lui-même
	 * comme la barre (`.iappel-hint-line`) : pas de portail, la ligne reste
	 * DANS la scène, donc dans le téléphone (ADR-0148).
	 */
	const underGrid =
		callFull && conference != null ? (
			<ConferenceHintCard
				kind="T3"
				tone="immersive"
				copy={conferenceHintCopy(
					"T3",
					{
						capacity: conference.capacity,
						context: conference.context,
					},
					t,
				)}
				onPrimary={conference.onLaunch}
			/>
		) : canAdd && onAdd ? (
			<button
				type="button"
				className="iappel-add-bar"
				onClick={onAdd}
				aria-label={t("groupCallGrid.addLabel")}
			>
				<UserPlus aria-hidden="true" className="h-4 w-4" />
				<span>{t("groupCallGrid.add")}</span>
			</button>
		) : null

	const stageParticipant =
		stageIdentity === null
			? null
			: (ordered.find(
					(participant) => String(participant.userId) === stageIdentity,
				) ?? null)

	return (
		<div className="iappel-stage" ref={stageRef}>
			{stageParticipant !== null ? (
				/* ── SCÈNE + BANDEAU ────────────────────────────────────────────
				   Le mode « compact » n'était qu'un `gap` plus serré : toutes les
				   vignettes restaient en grille, simplement plus petites. À sept
				   dans 400 px, cela donnait des bandes où l'on ne reconnaît
				   personne — et l'appel de cent personnes du 2026-08-28 était
				   proprement illisible. */
				<div
					className="iappel-grid"
					data-layout="stage"
					data-compact="true"
					data-add={reservesBar ? "bar" : undefined}
				>
					<div className="iappel-stage-main">
						{renderTile(stageParticipant, { stage: true })}
					</div>
					{/* MA vignette ferme la bande (`compareParticipants`) et s'y
					    ANCRE à droite (feuille de style, `data-me` en sticky) : on
					    défile parmi les autres sans jamais perdre son retour. */}
					<div
						className="iappel-strip"
						role="list"
						aria-label={t("groupCallGrid.others")}
					>
						{ordered
							.filter(
								(participant) => String(participant.userId) !== stageIdentity,
							)
							.map((participant) => renderTile(participant, { strip: true }))}
					</div>
				</div>
			) : (
				/* ── GRILLE PLEINE (modèle WhatsApp) ────────────────────────────
				   Une vraie grille CSS à PISTES (ADR-0149) : `tracks` =
				   ppcm(colonnes, cases de tête). Chaque case couvre
				   `tracks / columns` pistes, celles de la première ligne
				   `tracks / firstRowTiles` — onze sur trois colonnes font six
				   pistes, deux demi-cases de trois puis des cases de deux. Les
				   lignes sont égales et remplissent la scène.
				   `--iappel-grid-cols` reste posé : il nomme la disposition, et
				   les tests le lisent. */
				<div
					className="iappel-grid"
					data-layout="grid"
					data-compact={layout.compact ? "true" : "false"}
					data-add={reservesBar ? "bar" : undefined}
					style={
						{
							"--iappel-grid-cols": layout.columns,
							"--iappel-grid-rows": layout.rows,
							"--iappel-grid-tracks": layout.tracks,
						} as React.CSSProperties
					}
				>
					{ordered.map((participant, index) => {
						const firstRow = index < layout.firstRowTiles
						return renderTile(participant, {
							firstRow,
							span: firstRow && layout.spanFirst,
							tileSpan: firstRow
								? layout.tracks / layout.firstRowTiles
								: layout.tracks / layout.columns,
						})
					})}
				</div>
			)}
			{underGrid}
			{children}
		</div>
	)
}
