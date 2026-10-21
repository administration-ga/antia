// Dupliqué de socle/packages/agent-features/src/features/notifications/ReseauNotificationRow.tsx @ ad2e7fdc2 — adaptations : ligne = le DTO de la cloche du moteur (`notifications.bell.paginateNotifications`, type tiré de l'API : sujet `{ kind, id }`, acteur par mini-profil au nom NULLABLE, état vivant d'une invitation et d'un fichier retenu) au lieu de la forme à colonnes `subject…Id` ; phrase de TOUS les genres du moteur (`notificationRowSentence` : ceux de `shared.notificationSentence` et ceux que le moteur ajoute, nom neutre sans profil publié ; la page d'un `page_post` NOMMÉE avec son badge calculé) ; ligne de résultat par `notificationRowNote` (invitation tranchée, fichier libéré ou de nouveau analysé) ; cible composée sur les adresses injectées (`useRoutes()`) ; rappel de l'hôte par `targetCallback` (plus de cible « direct ») ; décision d'invitation sur `graph.connections.{pendingState, respondToConnection}` du réseau courant (`useNetwork()`), un refus qui ne dit rien de l'invitation (débit, adhésion) se dit par son code (`errors:<code>`) et garde les boutons ; libellés, dates relatives et refus traduits (espace `notifications`, clés `reseauNotificationRow.…`) ; commentaires sans l'onglet « Administration » ni le volet « Activité » de l'espace agent. ; PA6 : dates et jours civils dans le fuseau personnel du lecteur (repli appareil) ; couleurs par fonction (ADR-0027) : Accepter une relation en variante `social`.
"use client"

/**
 * ReseauNotificationRow — UNE ligne de la cloche sociale du réseau, et la
 * décision sur place d'une invitation de relation. La carte sous la cloche et
 * toute page qui monte la liste rendent la même ligne.
 *
 * Deux règles :
 *   · toute NAVIGATION depuis la ligne (lien, rappel de l'hôte) ferme d'abord
 *     la carte de notifications — `useModalA11y` inerte tout ce qui est sous
 *     une carte ouverte, la destination le serait aussi. Hors de la carte, la
 *     fermeture est sans effet ;
 *   · une invitation TRANCHÉE ailleurs mais restée NON LUE garde « Marquer
 *     lu » : sans lui, elle tiendrait la pastille allumée sans aucun geste
 *     pour l'éteindre, hors « Tout marquer lu ».
 *
 * Elle ne montre JAMAIS le contenu du sujet : le serveur ne le lui donne pas
 * (le DTO ne porte que le genre, l'acteur et une référence).
 */

import { themedActionStyle } from "../themed-action-style"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useNetwork, useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { Badge, Button } from "@antsia/ui"
import { useConvex, useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { pageBadgeView } from "../reseau-personnel/pages-panel"
import { formatRelativeDate } from "../reseau-personnel/shared"
import { closeNotificationCenter } from "./notification-center-store"
import {
	connectionInviteOutcome,
	notificationRowAction,
	notificationRowNote,
	notificationRowSentence,
	type NotificationTargets,
	targetCallback,
} from "./notification-targets"

/**
 * Une ligne telle que le moteur la rend — le type est TIRÉ de l'API : un champ
 * ajouté ou renommé côté serveur se voit ici à la compilation.
 */
export type NotificationListItem = FunctionReturnType<
	typeof api.modules.notifications.bell.paginateNotifications
>["page"][number]

export interface NotificationRowProps {
	item: NotificationListItem
	now: number
	compact: boolean
	targets: NotificationTargets
	/** Accompagne une ouverture ou une décision : silencieux en cas d'échec. */
	onMarkRead: (notificationId: Id<"notifications">) => void
	/** Le bouton « Marquer lu » : son échec se dit. */
	onMarkReadExplicitly: (notificationId: Id<"notifications">) => void
}

function NotificationPageBadge({ badge }: { badge: Parameters<typeof pageBadgeView>[0] }) {
	const { t } = useTranslation("notifications")
	const view = pageBadgeView(badge)
	return (
		<span style={{ display: "inline-flex", marginTop: 4 }}>
			<Badge tone={view.tone} size="sm" icon={view.icon}>
				{t(view.labelKey)}
			</Badge>
		</span>
	)
}

export function NotificationRow({
	item,
	now,
	compact,
	targets,
	onMarkRead,
	onMarkReadExplicitly,
}: NotificationRowProps) {
	const { t } = useTranslation("notifications")
	const timeZone = useViewerTimeZone()
	const routes = useRoutes()
	const action = notificationRowAction(item, routes, targets, t)
	// Ce que l'invitation (ou le fichier retenu) est DEVENU. Une demande de
	// relation tranchée le porte dans son action ; les autres genres gardent
	// leur ouverture et disent le résultat EN PLUS.
	const resultText = notificationRowNote(item, action, t)

	const open = () => {
		// La carte se ferme AVANT de suivre la cible (idempotent : sans effet
		// hors de la carte, où aucune n'est ouverte).
		closeNotificationCenter()
		onMarkRead(item.notificationId)
		if (action.mode !== "callback") return
		targetCallback(action.kind, targets)?.(action.id)
	}

	// « Marquer lu » : rien d'autre à faire sur la ligne, et elle n'est pas
	// lue. Une invitation tranchée ailleurs en fait partie : le résultat se
	// dit, mais la ligne restait non lue sans aucun geste.
	const offersMarkRead =
		(action.mode === "none" || action.mode === "resolved") &&
		item.readAt === null

	return (
		<li
			style={{
				display: "flex",
				gap: 8,
				alignItems: "flex-start",
				paddingLeft: 11,
				borderLeft: `${compact ? 2 : 3}px solid ${
					compact
						? "var(--ink-200)"
						: item.readAt === null
							? "var(--primary-500)"
							: "transparent"
				}`,
			}}
		>
			<div style={{ minWidth: 0, flex: 1 }}>
				<p
					style={{
						margin: 0,
						fontSize: `var(--esp-content-font-size, ${compact ? 12.5 : 13}px)`,
						lineHeight: "var(--esp-content-line-height, 1.5)",
						color: "var(--ink-800)",
						overflowWrap: "anywhere",
					}}
				>
					{notificationRowSentence(item, t)}
				</p>
				{/* La page qui publie porte son badge CALCULÉ : face à une page qui
				    emprunterait le nom d'une institution, l'absence d'« Officiel » ne
				    suffit pas, il faut voir ce qu'elle est. */}
				{item.page ? <NotificationPageBadge badge={item.page.badge} /> : null}
				<p
					style={{
						margin: 0,
						color: compact ? "var(--ink-400)" : "var(--ink-600)",
						fontFamily: compact ? "var(--font-mono)" : "inherit",
						fontSize: compact ? 11 : 12,
					}}
				>
					<time dateTime={new Date(item.createdAt).toISOString()}>
						{formatRelativeDate(item.createdAt, now, t, timeZone)}
					</time>
				</p>
				{resultText !== null ? (
					<p
						style={{
							margin: "6px 0 0",
							fontSize: 12.5,
							color: "var(--ink-600)",
						}}
					>
						{resultText}
					</p>
				) : null}
				{!compact && action.mode === "connection" ? (
					<ConnectionInviteActions
						connectionId={action.connectionId}
						onSettled={() => onMarkRead(item.notificationId)}
					/>
				) : null}
			</div>
			{compact ? null : action.mode === "callback" ? (
				<Button variant="link" size="sm" onClick={open}>
					{action.label}
				</Button>
			) : action.mode === "link" ? (
				<Link
					href={action.href}
					onClick={() => {
						// Fermer la carte AVANT que le lien ne navigue : la page
						// d'arrivée ne doit pas s'ouvrir inerte sous elle.
						closeNotificationCenter()
						onMarkRead(item.notificationId)
					}}
					style={{ fontSize: 13, color: "var(--primary-700)" }}
				>
					{action.label}
				</Link>
			) : offersMarkRead ? (
				<Button
					variant="link"
					size="sm"
					onClick={() => onMarkReadExplicitly(item.notificationId)}
				>
					{t("reseauNotificationRow.markRead")}
				</Button>
			) : null}
		</li>
	)
}

/**
 * Accepter ou refuser une invitation de relation, APRÈS relecture.
 *
 * L'ordre est le contrat : `pendingState` → `respondToConnection`. Sans la
 * première lecture, un second client ayant déjà accepté ferait échouer la
 * mutation (`conflict`) — la ligne dirait « ça n'a pas marché » là où elle doit
 * dire « déjà traitée ».
 *
 * Une réponse ENREGISTRÉE n'est suivie d'aucun `markRead` : la transaction qui
 * tranche résout aussi la notification et la marque lue. Le marquage ne sert
 * plus que là où rien n'a été décidé ici — invitation déjà traitée, annulée,
 * ou réponse refusée par le serveur.
 */
export function ConnectionInviteActions({
	connectionId,
	onSettled,
}: {
	connectionId: string
	onSettled: () => void
}) {
	const { t } = useTranslation("notifications")
	const { networkId } = useNetwork()
	const convex = useConvex()
	const respond = useMutation(api.modules.graph.connections.respondToConnection)
	const [busy, setBusy] = useState(false)
	const [notice, setNotice] = useState<string | null>(null)

	const decide = async (accept: boolean) => {
		setBusy(true)
		// Le sujet générique du moteur porte l'identifiant en chaîne ; le
		// serveur le revalide (`v.id("connections")`) et refuse une référence
		// inventée.
		const id = connectionId as Id<"connections">
		try {
			const state = await convex.query(
				api.modules.graph.connections.pendingState,
				{ networkId, connectionId: id },
			)
			const outcome = connectionInviteOutcome(state, t)
			if (!outcome.actionable) {
				setNotice(outcome.message)
				onSettled()
				return
			}
			await respond({ networkId, connectionId: id, accept })
			// Le serveur a tranché ET résolu la ligne dans la même transaction :
			// on dit le résultat en place, sans marquage à ajouter.
			const done = accept
				? t("reseauNotificationRow.accepted")
				: t("reseauNotificationRow.declined")
			toast.success(done)
			setNotice(done)
		} catch (error) {
			// Le serveur reste l'arbitre : entre la relecture et la réponse, un
			// autre client a pu trancher (`conflict`) ou la demande disparaître
			// (`notFound`). On le DIT, on ne réessaie pas. Un refus qui ne dit
			// RIEN de l'invitation (débit, adhésion) se dit par son code, et les
			// boutons restent : la demande attend toujours une réponse.
			const code = engineErrorCode(error)
			if (code !== null && code !== "conflict" && code !== "notFound") {
				toast.error(t(`errors:${code}`))
				return
			}
			setNotice(t("reseauNotificationRow.alreadyHandled"))
			onSettled()
		} finally {
			setBusy(false)
		}
	}

	if (notice !== null) {
		return (
			<p
				style={{
					margin: "6px 0 0",
					fontSize: 12.5,
					color: "var(--ink-600)",
				}}
			>
				{notice}
			</p>
		)
	}

	return (
		<div style={{ display: "flex", gap: 8, marginTop: 6 }}>
			{/* Accepter : couleur des relations (ADR-0027). */}
			<Button style={themedActionStyle("success", "social")}
				size="sm"
				variant="success"
				disabled={busy}
				onClick={() => void decide(true)}
			>
				{t("reseauNotificationRow.accept")}
			</Button>
			<Button style={themedActionStyle("danger", "secondary")}
				size="sm"
				variant="danger"
				disabled={busy}
				onClick={() => void decide(false)}
			>
				{t("reseauNotificationRow.decline")}
			</Button>
		</div>
	)
}
