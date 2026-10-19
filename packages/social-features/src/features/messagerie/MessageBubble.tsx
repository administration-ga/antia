// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessageBubble.tsx @ ad2e7fdc2 — adaptations : iDocument retiré (`canSaveToVault`) ; fenêtre d'édition et réactions lues aux contrats du moteur (`@antsia/social-contracts/messaging`, `…/messageReactions`), noms des réactions par les clés de `MessageActionsSheet` (`reactionLabelKey`) ; libellés traduits (espace de noms `messagerie`, clés `messageBubble.*`), corps par `bubbleText(…, t)`, heure dans la langue courante (`bubbleTime(at, locale)`) ; geste de glissement du paquet (`shell/mobile/gestures`). ; PA6 : dates et jours civils dans le fuseau personnel du lecteur (repli appareil). ; P18b (A02) : la bulle n'est plus un bouton englobant — corps intégral lisible, précédé de son auteur pour les lecteurs d'écran (`messageBubble.speaker*`), citation, liens, vidéos et vocaux atteignables pour eux-mêmes, et un bouton d'actions distinct nommé par l'auteur (`messageBubble.actionsFrom` / `actionsMine`), invisible au repos et révélé au focus clavier ; clic, appui long et menu contextuel conservés sur la bulle, sauf sur ses propres contrôles. ; CC-5 : feuille d'actions injectable (`renderActionsSheet`, facultative) pour la conversation contextuelle — sans elle, `MessageActionsSheet` inchangée.
"use client"

/**
 * MessageBubble — UNE bulle, avec tout ce qui s'y accroche.
 *
 * Le rendu SEUL. Tout ce qui se décide vit ailleurs, dans des modules purs
 * testés sans DOM :
 *  · à qui elle est, où elle se coupe, quelle heure elle porte →
 *    `messagerie-bulles.ts` (`groupMessages`) ;
 *  · quel corps elle affiche → `bubbleText` (retrait, masquage, texte) ;
 *  · quelles actions elle offre → `message-actions.ts` (`actionsFor`) ;
 *  · quand un geste ABOUTIT → `shell/mobile/gestures/swipe.ts` (`shouldCommit`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX GESTES, ET POURQUOI CHACUN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · GLISSER VERS LA DROITE = répondre. C'est le geste de WhatsApp, Signal et
 *    Telegram — il ne s'apprend pas, il se retrouve. La bulle suit le doigt et
 *    revient toujours à sa place : un geste qui ne bouge rien ne se comprend
 *    pas, et un geste qui reste décalé passe pour une casse d'affichage.
 *  · APPUI LONG = la feuille d'actions. Elle porte aussi la réaction, si bien
 *    qu'un seul geste ouvre tout — deux gestes distincts (appui long pour les
 *    actions, double-appui pour la réaction) ne sont pas découvrables.
 *
 * ⚠️ L'offset du glissement N'EST PAS un état React. `usePointerSwipe` appelle
 * `onOffset` à la cadence des `pointermove` (jusqu'à 120 Hz) : re-rendre la
 * bulle à cette cadence ferait ramer un fil de cent messages. On écrit le
 * `transform` directement sur le nœud, par une ref — c'est le contrat du hook.
 *
 * ⚠️ L'appui long s'annule au MOUVEMENT. Sans cela, commencer à faire défiler
 * le fil en posant le doigt sur une bulle ouvre la feuille d'actions au bout
 * d'une demi-seconde, au milieu du défilement.
 *
 * ⚠️ La bulle N'EST PLUS un `<button>` (P18b, A02). Un bouton présente ses
 * enfants comme décoratifs et ne peut contenir aucun contrôle : le corps n'était
 * lu que par ses 60 premiers caractères, et la citation, les liens, les vidéos
 * et les vocaux s'y trouvaient enfermés. La bulle est donc un contenu lisible
 * (son auteur, puis son corps intégral), ses contrôles restent les siens, et un
 * BOUTON D'ACTIONS distinct — invisible au repos, révélé au focus clavier — ouvre
 * la même feuille que l'appui long : les actions existent toujours au clavier.
 */

import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { MESSAGE_EDIT_WINDOW_MS } from "@antsia/social-contracts/messaging"
import {
	MESSAGE_REACTION_EMOJI,
	MESSAGE_REACTION_KINDS,
	type MessageReactionKind,
} from "@antsia/social-contracts/messageReactions"
import { Check, CheckCheck, Ellipsis, Forward, Pin } from "lucide-react"
import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { usePointerSwipe } from "../../shell/mobile/gestures/usePointerSwipe"
import { bubbleText, bubbleTime, type BulleRow, type GroupableMessage } from "./messagerie-bulles"
import { MessageAttachment, type MessageAttachmentData } from "./MessageAttachment"
import { MessageActionsSheet, reactionLabelKey } from "./MessageActionsSheet"
import type { MessageActionId } from "./message-actions"
import { ReplyPreview, type ReplyPreviewData } from "./ReplyPreview"

/**
 * Distance de référence du glissement. `shouldCommit` valide à 25 % de cette
 * taille, soit 60 px — assez pour qu'un défilement oblique ne déclenche pas la
 * réponse, assez court pour se faire d'un pouce.
 */
const REPLY_SWIPE_SIZE = 240

/** Au-delà, la bulle ne suit plus : elle a dit ce qu'elle avait à dire. */
const REPLY_SWIPE_MAX_PX = 72

/** Un appui plus long que ça est une INTENTION, pas un clic maladroit. */
const LONG_PRESS_MS = 480

/**
 * Les contrôles PROPRES d'une bulle (citation, lien d'image, fichier, lecteurs
 * vidéo et vocal, bouton d'actions) : un clic sur eux reste le leur et n'ouvre
 * pas la feuille d'actions par-dessus.
 */
const BUBBLE_CONTROLS =
	"a[href], button, audio, video, input, select, textarea, summary, [role='button'], [role='link']"

/** Ce qu'une bulle sait montrer, quel que soit son fil d'origine. */
export interface BubbleMessage extends GroupableMessage {
	text: string | null
	masked?: boolean
	senderName?: string | null
	attachments?: readonly MessageAttachmentData[]
	reply?: ReplyPreviewData | null
	reactions?: {
		counts: Readonly<Record<MessageReactionKind, number>>
		mine: MessageReactionKind | null
	} | null
	/** Lu par le correspondant — `null` quand la notion n'a pas de sens ici. */
	readAt?: number | null
	/**
	 * Dernière modification par son auteur — `null`/absent s'il n'y en a pas.
	 * La bulle en porte la MENTION : un texte réécrit sans le dire réécrit
	 * l'histoire pour celui qui l'avait lu.
	 */
	editedAt?: number | null
	/** Message SYSTÈME (création de groupe, départ, appel) : une ligne, pas une bulle. */
	systemText?: string | null
	/**
	 * La copie d'un transfert, dont l'original est encore servi (ADR-0143) —
	 * la bulle porte la MENTION, jamais le contenu de l'original.
	 */
	forwarded?: boolean
	/** Ce message est l'ÉPINGLE du fil : la puce le dit à la lecture. */
	pinned?: boolean
}

export interface MessageBubbleProps {
	row: Extract<BulleRow<BubbleMessage>, { kind: "message" }>
	/** Le genre de fil — décide de « supprimer pour tout le monde ». */
	conversationKind: "chat" | "groupe" | "draft"
	/** Le nom de l'expéditeur s'affiche-t-il ? (groupes seulement) */
	showSender: boolean
	/** La citation est-elle possible ? `false` sur un brouillon. */
	canReply: boolean
	/**
	 * Le droit d'ÉPINGLER dans ce fil (1:1 : les deux ; groupe : le rôle de
	 * canal). Absent, le geste n'est pas offert — fail-closed (ADR-0143).
	 */
	canPin?: boolean
	onReply: (message: BubbleMessage) => void
	onReact: (message: BubbleMessage, kind: MessageReactionKind) => void
	onAction: (message: BubbleMessage, action: MessageActionId) => void
	/** Ramener au message cité. */
	onOpenQuoted?: (messageId: string) => void
	/**
	 * CC-5 (ADR-0025) : la feuille d'actions PROPRE à une autre famille de conversation (la
	 * conversation contextuelle : copier, retirer le sien, signaler — ni réaction, ni transfert,
	 * ni épingle). Le bouton d'actions, l'appui long et le clic ouvrent CETTE feuille-là ; la
	 * bulle reste la même (P18b). Absente, la feuille historique des fils personnels et des
	 * groupes (`MessageActionsSheet`) est rendue, inchangée.
	 */
	renderActionsSheet?: (control: { open: boolean; onOpenChange: (open: boolean) => void }) => ReactNode
}

export function MessageBubble({
	row,
	conversationKind,
	showSender,
	canReply,
	canPin = false,
	onReply,
	onReact,
	onAction,
	onOpenQuoted,
	renderActionsSheet,
}: MessageBubbleProps) {
	const { t, i18n } = useTranslation("messagerie")
	const timeZone = useViewerTimeZone()
	const { message, mine, first, last, showTime } = row
	const [sheetOpen, setSheetOpen] = useState(false)
	const glissable = useRef<HTMLDivElement>(null)
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const annulerAppuiLong = useCallback(() => {
		if (longPressRef.current !== null) {
			clearTimeout(longPressRef.current)
			longPressRef.current = null
		}
	}, [])

	const appliquerOffset = useCallback((offset: number) => {
		const node = glissable.current
		if (node === null) return
		// Vers la DROITE seulement : glisser vers la gauche ne veut rien dire ici,
		// et laisser la bulle partir de ce côté suggère une action qui n'existe pas.
		const borne = Math.max(0, Math.min(offset, REPLY_SWIPE_MAX_PX))
		node.style.transform = borne === 0 ? "" : `translateX(${borne}px)`
		// Un mouvement engagé n'est plus un appui : la feuille ne doit pas s'ouvrir
		// au milieu d'un geste.
		if (borne > 4) annulerAppuiLong()
	}, [annulerAppuiLong])

	const swipe = usePointerSwipe({
		axis: "x",
		size: REPLY_SWIPE_SIZE,
		disabled: !canReply || message.deleted === true,
		onOffset: appliquerOffset,
		onCommit: (direction) => {
			// Convention de `swipe.ts` : offset POSITIF (vers la droite) rend -1.
			if (direction === -1) onReply(message)
			const node = glissable.current
			if (node !== null) node.style.transform = ""
		},
	})

	// Un message SYSTÈME n'est pas une parole : ni bulle, ni actions, ni gestes.
	if (message.systemText !== null && message.systemText !== undefined) {
		return <span className="msg-system">{message.systemText}</span>
	}

	const corps = bubbleText(
		{
			deleted: message.deleted,
			masked: message.masked,
			text: message.text,
		},
		t,
	)
	const pieces = message.attachments ?? []
	const compteurs = message.reactions?.counts ?? null
	const maReaction = message.reactions?.mine ?? null
	const reactionsVisibles =
		compteurs === null
			? []
			: MESSAGE_REACTION_KINDS.filter((kind) => (compteurs[kind] ?? 0) > 0)
	// QUI parle, pour un lecteur d'écran : la bulle ne le montre qu'à la
	// première d'une salve de groupe, et jamais en tête-à-tête.
	const auteur = (message.senderName ?? "").trim()
	const locuteur = mine
		? t("messageBubble.speakerMine")
		: auteur.length > 0
			? t("messageBubble.speaker", { name: auteur })
			: null
	const nomDesActions = mine
		? t("messageBubble.actionsMine")
		: auteur.length > 0
			? t("messageBubble.actionsFrom", { name: auteur })
			: t("messageBubble.actions")

	// Le clic (souris) sur la bulle ouvre la feuille, comme l'appui long — sauf
	// sur ses propres contrôles, qui gardent leur geste.
	const ouvrirDepuisLaBulle = (event: ReactMouseEvent<HTMLDivElement>) => {
		const cible = event.target
		if (cible instanceof Element) {
			const controle = cible.closest(BUBBLE_CONTROLS)
			if (controle !== null && event.currentTarget.contains(controle)) return
		}
		setSheetOpen(true)
	}

	return (
		<div
			className="msg-line"
			data-mine={mine ? "true" : "false"}
			data-first={first ? "true" : "false"}
		>
			{showSender && !mine && first ? (
				// Masqué aux aides techniques : chaque bulle dit déjà son auteur.
				<span className="msg-sender" aria-hidden="true">{message.senderName ?? ""}</span>
			) : null}

			<div
				ref={glissable}
				// Les gestes du pointeur (glissement, appui long, clic, menu
				// contextuel) vivent ici ; le clavier passe par le bouton d'actions.
				role="presentation"
				style={{
					position: "relative",
					maxWidth: "100%",
					// `transform` seul est animé : c'est la propriété que le compositeur
					// traite sans reflow. Le retour est court et sortant (ease-out).
					transition: "transform 160ms ease-out",
					touchAction: swipe.touchAction,
				}}
				onPointerDown={(event) => {
					swipe.onPointerDown(event)
					annulerAppuiLong()
					longPressRef.current = setTimeout(() => setSheetOpen(true), LONG_PRESS_MS)
				}}
				onPointerMove={swipe.onPointerMove}
				onPointerUp={(event) => {
					annulerAppuiLong()
					swipe.onPointerUp(event)
				}}
				onPointerCancel={(event) => {
					annulerAppuiLong()
					swipe.onPointerCancel(event)
				}}
				onClick={ouvrirDepuisLaBulle}
				onContextMenu={(event) => {
					// Le menu contextuel du navigateur recouvrirait le nôtre.
					event.preventDefault()
					setSheetOpen(true)
				}}
			>
				<div className="msg-bubble-btn">
					<span
						className="msg-bubble"
						data-mine={mine ? "true" : "false"}
						data-first={first ? "true" : "false"}
						data-last={last ? "true" : "false"}
						data-deleted={
							message.deleted === true || message.masked === true
								? "true"
								: "false"
						}
					>
						{locuteur !== null ? <span className="sr-only">{locuteur}</span> : null}

						{message.reply !== null && message.reply !== undefined ? (
							<ReplyPreview
								reply={message.reply}
								place="bubble"
								onOpen={onOpenQuoted}
							/>
						) : null}

						{message.forwarded === true && message.deleted !== true ? (
							<span className="msg-forwarded">
								<Forward aria-hidden="true" size={11} />
								{t("messageBubble.forwarded")}
							</span>
						) : null}

						{pieces.length > 0 ? (
							<span className="msg-attachments">
								{pieces.map((piece, index) => (
									<MessageAttachment
										key={`${piece.filename}-${String(index)}`}
										attachment={piece}
									/>
								))}
							</span>
						) : null}

						{corps.length > 0 ? <span>{corps}</span> : null}

						{message.pinned === true && message.deleted !== true ? (
							<span
								className="msg-bubble-pin"
								role="img"
								aria-label={t("messageBubble.pinned")}
							>
								<Pin aria-hidden="true" size={11} />
							</span>
						) : null}

					{/* « (modifié) » vit DANS la bulle, pas dans la ligne d'heure :
					    cette dernière n'est rendue que sur la dernière bulle d'un
					    groupe (`showTime`), et la mention disparaîtrait sur toutes
					    les autres. */}
					{message.editedAt !== null &&
					message.editedAt !== undefined &&
					message.deleted !== true ? (
						<span className="msg-file-meta">
							{" "}
							{t("messageBubble.edited")}
						</span>
					) : null}
					</span>
				</div>

				{/* Le bouton d'actions, DISTINCT de la bulle : invisible au repos
				    (`.msg-actions-btn`), il apparaît au focus clavier à côté d'elle
				    et ouvre la même feuille que l'appui long. */}
				<button
					type="button"
					className="msg-actions-btn"
					aria-haspopup="dialog"
					aria-label={nomDesActions}
					onClick={() => setSheetOpen(true)}
				>
					<Ellipsis aria-hidden="true" size={16} />
				</button>
			</div>

			{reactionsVisibles.length > 0 ? (
				<span className="msg-reactions">
					{reactionsVisibles.map((kind) => (
						<button
							key={kind}
							type="button"
							className="msg-reaction-chip"
							data-mine={maReaction === kind ? "true" : "false"}
							aria-pressed={maReaction === kind}
							aria-label={t("messageBubble.reactionCount", {
								reaction: t(reactionLabelKey(kind)),
								total: compteurs?.[kind] ?? 0,
							})}
							onClick={() => onReact(message, kind)}
						>
							<span aria-hidden="true">{MESSAGE_REACTION_EMOJI[kind]}</span>
							<span aria-hidden="true" className="msg-reaction-count">
								{compteurs?.[kind] ?? 0}
							</span>
						</button>
					))}
				</span>
			) : null}

			{showTime ? (
				<span className="msg-time msg-time-row">
					{bubbleTime(message.createdAt, i18n.language, timeZone)}
					{/* La double coche ne vaut que pour MES messages, et seulement
					    quand le serveur porte l'information : une coche affichée par
					    défaut affirmerait une lecture qui n'a pas eu lieu. */}
					{mine &&
					message.readAt !== undefined &&
					message.readAt !== null &&
					conversationKind === "chat" ? (
						<span className="msg-receipt" data-read="true">
							<CheckCheck aria-hidden="true" size={13} />
							<span className="sr-only">{t("messageBubble.read")}</span>
						</span>
					) : mine && message.readAt === null && conversationKind === "chat" ? (
						<span className="msg-receipt" data-read="false">
							<Check aria-hidden="true" size={13} />
							<span className="sr-only">{t("messageBubble.sent")}</span>
						</span>
					) : null}
				</span>
			) : null}

			{renderActionsSheet !== undefined ? renderActionsSheet({ open: sheetOpen, onOpenChange: setSheetOpen }) : <MessageActionsSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				context={{
					conversationKind,
					mine,
					deleted: message.deleted === true,
					hasAttachments: pieces.length > 0,
					canReply,
					hasText: (message.text ?? "").trim().length > 0,
					// ADR-0143 : le transfert ne s'offre pas sur un corps masqué ;
					// l'épingle se propose au droit près, jamais par défaut.
					masked: message.masked === true,
					pinned: message.pinned === true,
					canPin,
					// La FENÊTRE de l'auteur se juge ici, pas après l'appui : le
					// serveur refuse « modifier » et « supprimer pour tout le monde »
					// passé ce délai (`MESSAGE_EDIT_WINDOW_MS`, la valeur qu'il
					// applique lui-même).
					createdAt: message.createdAt,
					now: Date.now(),
					editWindowMs: MESSAGE_EDIT_WINDOW_MS,
				}}
				myReaction={maReaction}
				onReact={(kind) => onReact(message, kind)}
				onAction={(action) => {
					if (action === "repondre") {
						onReply(message)
						return
					}
					onAction(message, action)
				}}
			/>}
		</div>
	)
}
