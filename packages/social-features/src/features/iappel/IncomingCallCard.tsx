// Dupliqué de socle/packages/agent-features/src/features/iappel/IncomingCallCard.tsx @ ad2e7fdc2 — adaptations : branches retirées — poste (liseré institutionnel, emblème, fonction, administration, prop `orgEmblemUrl`), transmission au secrétariat, invitation de réunion iRéunion, appel prioritaire (aucune priorité dans le moteur) ; libellés et noms accessibles traduits (i18n `iappel`) ; `peerDisplayName` et `incomingGroupSummary` reçoivent `t` en dernier paramètre ; couleurs par fonction (ADR-0027) : « Message » (refuser avec un message) à l'aplat des messages (`data-role="message"`, pilule discrète en repli).
"use client"

/**
 * IncomingCallCard — l'appel entrant, au téléphone, en plein écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE EN UNE DEMI-SECONDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Qui appelle, et — pour un appel de groupe — avec qui : on décroche
 * autrement selon la réponse, et on la lit souvent sans avoir le temps
 * d'aller au bout d'une ligne de texte.
 *
 * ── Ce que l'écran offre, et dans quel ordre de priorité ──────────────────
 * Deux ronds de décision (refuser / répondre), et seulement eux, dans la zone
 * du pouce. Au-dessus, deux actions secondaires en pilules : répondre en
 * vidéo, et refuser AVEC un mot. Ce dernier compte : un refus muet se lit
 * comme un rejet, alors que « je vous rappelle dans 10 minutes » est une
 * réponse.
 */

import { BellOff, MessageSquare, Phone, PhoneOff, Users, Video } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar } from "../reseau-personnel/Avatar"
import { CallControlButton } from "./CallControlButton"
import { peerDisplayName, peerSubtitle } from "./call-peer"
import type { RingingCall } from "./call-types"
import { incomingGroupSummary } from "./incoming-group"

export interface IncomingCallCardProps {
	call: RingingCall
	/** Réponses rapides du destinataire, servies avec la sonnerie. */
	quickReplies?: readonly string[]
	onAnswer: (mediaType: "audio" | "video") => void
	onDecline: (note?: string) => void
	/**
	 * L'audio est bloqué par la politique autoplay (aucun geste depuis
	 * l'ouverture de l'onglet) : la carte le DIT — la bannière de bureau le
	 * disait déjà, le téléphone sonnait en silence sans un mot (S1).
	 */
	audioBlocked?: boolean
	/** La sonnerie est COUPÉE par la préférence de la personne : la carte le dit. */
	ringtoneMuted?: boolean
	/** Appels supplémentaires qui sonnent en même temps, en compact. */
	children?: React.ReactNode
	/**
	 * `compact` : la carte sonne dans le corps d'une carte iCom MOYENNE
	 * (≈ 360 px de haut, cf. `call-host.ts`) — avatar réduit, respirations
	 * resserrées, pour que « Refuser » et « Répondre » restent visibles.
	 * `phone` (défaut) : l'écran entier du téléphone, réel ou détaché.
	 */
	density?: "phone" | "compact"
}

export function IncomingCallCard({
	call,
	quickReplies = [],
	onAnswer,
	onDecline,
	audioBlocked = false,
	ringtoneMuted = false,
	children,
	density = "phone",
}: IncomingCallCardProps) {
	const { t } = useTranslation("iappel")
	const [repliesOpen, setRepliesOpen] = useState(false)
	const name = peerDisplayName(call.caller, undefined, t)
	// L'adresse de réseau (`@handle`) quand elle est connue.
	const subtitle = peerSubtitle(call.caller, call.scope)
	const isVideo = call.mediaType === "video"
	/**
	 * ⚠️ Un appel de GROUPE doit se reconnaître AVANT qu'on décroche.
	 *
	 * L'écran nomme l'appelant, comme pour un tête-à-tête — c'est juste, c'est
	 * bien Marie qui appelle. Mais décrocher fait entrer dans une conversation
	 * à cinq, et l'ignorer serait une surprise désagréable : on répond
	 * autrement quand on sait qu'on ne sera pas seul à l'autre bout.
	 */
	const isGroup = call.kind === "group"
	const groupTitle = call.group?.title?.trim()
	/**
	 * Avec QUI, et à combien (fiche « appels de groupe de 2 à 11 », point de
	 * vue B) : la ligne « Appel de groupe · N personnes » et la pile des
	 * conviés. Le décompte est celui du serveur, la pile quatre visages au
	 * plus — la règle vit dans `incoming-group.ts`, testée par table.
	 */
	const groupSummary = incomingGroupSummary({ kind: call.kind, group: call.group }, t)
	const pileSize = density === "compact" ? 22 : 28

	return (
		<div
			className="call-hero-dark iappel-incoming iappel-enter h-full w-full select-none"
			data-call-media={call.mediaType}
			data-density={density}
		>
			{/* Haut : de quoi il s'agit. */}
			<div className="flex flex-col items-center gap-4 pt-2">
				<span
					className="iappel-eyebrow"
					style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.7 }}
				>
					{isGroup
						? isVideo
							? t("incomingCallCard.groupVideo")
							: t("incomingCallCard.group")
						: isVideo
							? t("incomingCallCard.incomingVideo")
							: t("incomingCallCard.incoming")}
				</span>

				{/* Un silence s'ANNONCE : autoplay bloqué ou sonnerie coupée, la
				    carte le dit — les deux états sont exclusifs par construction
				    (mute ⇒ plus rien d'audible à bloquer). */}
				{audioBlocked ? (
					<p
						className="flex items-center gap-1.5 text-[12.5px]"
						style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.7 }}
						role="status"
					>
						<BellOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
						{t("incomingCallCard.audioBlocked")}
					</p>
				) : null}
				{ringtoneMuted ? (
					<p
						className="flex items-center gap-1.5 text-[12.5px]"
						style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.7 }}
						role="status"
					>
						<BellOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
						{t("incomingCallCard.ringtoneMuted")}
					</p>
				) : null}

				{/* Le groupe, NOMMÉ, quand il a un titre (fil de groupe). Sans titre,
				    plus de puce « Marie et 5 autres » : la ligne de groupe et sa
				    pile, sous l'appelant, disent la même chose en mieux. */}
				{isGroup && groupTitle !== undefined && groupTitle.length > 0 && (
					<span
						className="iappel-chip"
						style={{ maxWidth: "min(88vw, 30ch)" }}
					>
						<Users aria-hidden="true" className="h-3.5 w-3.5" />
						{groupTitle}
					</span>
				)}

			</div>

			{/* Milieu : qui appelle. */}
			<div className="flex flex-col items-center gap-5">
				<div className="av-ring" style={{ color: "var(--primary)" }}>
					<Avatar
						displayName={name}
						avatarUrl={call.caller.avatarUrl}
						size={density === "compact" ? 72 : 128}
					/>
				</div>

				<div className="flex flex-col items-center gap-1.5 text-center">
					<h1
						className="text-[17px] leading-tight font-medium text-pretty"
						style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.85 }}
					>
						{name}
					</h1>
					{/* Le sous-titre sous le nom : sinon l'écran n'aurait plus qu'un nom nu. */}
					<p
						className="text-[14px]"
						style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.65 }}
					>
						{subtitle ?? t("incomingCallCard.personal")}
					</p>
				</div>

				{/* Sous l'appelant — qui reste nommé : décrocher
				    fait entrer dans une conversation à plusieurs, et l'on répond
				    autrement quand on sait avec qui. La pile est UNE image pour un
				    lecteur d'écran (« Avec Marie Ndong, Paul Obame et 3 autres ») :
				    cinq pastilles d'initiales lues une à une ne diraient rien. */}
				{groupSummary !== null ? (
					<div className="flex flex-col items-center gap-2">
						<p className="iappel-group-line">{groupSummary.label}</p>
						{groupSummary.shown.length > 0 ? (
							<div
								className="iappel-pile"
								role="img"
								aria-label={groupSummary.accessibleLabel}
							>
								{groupSummary.shown.map((invitee) => (
									<span
										key={invitee.userId}
										className="iappel-pile-avatar"
										data-testid="incoming-pile-avatar"
									>
										<Avatar
											displayName={invitee.name ?? ""}
											avatarUrl={invitee.avatarUrl}
											hasIdentity={invitee.name !== null}
											size={pileSize}
										/>
									</span>
								))}
								{groupSummary.rest > 0 ? (
									<span
										className="iappel-pile-more"
										aria-hidden="true"
										style={{ width: pileSize, height: pileSize }}
									>
										+{groupSummary.rest}
									</span>
								) : null}
								{/* « vous compris », comme sur la planche : le « +k » compte
								    l'invité qui regarde, et le dire évite de chercher son
								    propre visage dans la pile. Muet pour un lecteur d'écran :
								    le libellé de l'image le porte déjà. */}
								<span className="iappel-pile-note" aria-hidden="true">
									{t("incomingCallCard.includingYou")}
								</span>
							</div>
						) : null}
					</div>
				) : null}

				{children}
			</div>

			{/* Bas : décider. Les deux ronds d'abord dans le pouce, le reste au-dessus. */}
			<div className="flex flex-col items-center gap-4">
				{repliesOpen ? (
					<div
						className="flex w-full flex-col gap-2"
						role="group"
						aria-label={t("incomingCallCard.declineWithMessage")}
					>
						{quickReplies.map((reply) => (
							<button
								key={reply}
								type="button"
								className="iappel-soft-action w-full justify-center"
								onClick={() => onDecline(reply)}
							>
								{reply}
							</button>
						))}
						<button
							type="button"
							className="iappel-soft-action w-full justify-center"
							onClick={() => setRepliesOpen(false)}
						>
							{t("incomingCallCard.cancel")}
						</button>
					</div>
				) : (
					<div className="flex flex-wrap items-center justify-center gap-2">
						{quickReplies.length > 0 && (
							<button
								type="button"
								className="iappel-soft-action"
								data-role="message"
								onClick={() => setRepliesOpen(true)}
							>
								<MessageSquare aria-hidden="true" className="h-4 w-4" />
								{t("incomingCallCard.message")}
							</button>
						)}
						{/* Répondre dans l'AUTRE média que celui demandé : un appel
						    vidéo qu'on prend en audio (on n'est pas présentable), un
						    appel audio qu'on prend en vidéo (on veut montrer). */}
						<button
							type="button"
							className="iappel-soft-action"
							onClick={() => onAnswer(isVideo ? "audio" : "video")}
						>
							{isVideo ? (
								<Phone aria-hidden="true" className="h-4 w-4" />
							) : (
								<Video aria-hidden="true" className="h-4 w-4" />
							)}
							{isVideo ? t("incomingCallCard.answerAudio") : t("incomingCallCard.answerVideo")}
						</button>
					</div>
				)}

				<div className="flex items-start justify-center gap-12">
					<CallControlButton
						icon={PhoneOff}
						label={t("incomingCallCard.decline")}
						onClick={() => onDecline()}
						tone="hangup"
						size="lg"
					/>
					<CallControlButton
						icon={isVideo ? Video : Phone}
						label={t("incomingCallCard.answer")}
						onClick={() => onAnswer(call.mediaType)}
						tone="answer"
						size="lg"
					/>
				</div>
			</div>
		</div>
	)
}
