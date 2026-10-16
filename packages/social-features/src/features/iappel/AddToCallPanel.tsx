// Dupliqué de socle/packages/agent-features/src/features/iappel/AddToCallPanel.tsx @ ad2e7fdc2 — adaptations : relations SEULES — liste de poste (`AddToCallPosteList`), annuaire institutionnel (`useContactSearch`, `contactGroupsToCandidates`) et props `scope` / `orgId` retirés ; ajout par `calls.groupCalls.addInvitee` du réseau courant (`callId`, `personId`) ; appel `Id<"calls">` ; un refus du moteur se dit par sa règle (`rules:*`), sinon le message générique (plus de phrase serveur lue dans `error.data`) ; libellés, toasts et noms accessibles traduits (i18n `iappel`) ; `participantStatusLabel` et `describeCallSeats` reçoivent `t` en dernier paramètre.
"use client"

/**
 * AddToCallPanel — AJOUTER UNE PERSONNE À L'APPEL EN COURS (ADR-0099).
 *
 * Le sélecteur de l'escalade 1:1 → groupe, sur la surface d'appel. Chaque
 * clic appelle `groupCalls.addInvitee` : le TICKET fait sonner l'ajouté comme
 * n'importe quel appel entrant, et un refus d'admission (ne pas déranger,
 * hors relations) se DIT au lieu de passer pour un succès.
 *
 * NI `Sheet` NI `Dialog` — le cliquet du dossier les interdit
 * (`iappel-surface.ratchet.test.ts` : `data-[side=bottom]:h-auto` de
 * SheetContent avait réduit la scène vidéo à zéro pixel). Panneau positionné
 * maison, patron du lanceur d'appel de groupe du socle : mêmes classes `iappel-launcher-*`
 * (jetons de rôle, aucune couleur en dur), fermé par Échap et clic extérieur.
 * L'ajout est UNITAIRE (une personne à la fois, spinner par ligne) : on
 * agrandit un appel vivant, on ne compose pas une liste.
 *
 * Le périmètre AFFICHÉ : mes connexions ACCEPTÉES du réseau
 * (`usePersonalConnections`), et le serveur reste l'arbitre (refus
 * indistincts, plafond, admission par ligne). Au socle, le panneau a d'abord
 * lu l'annuaire institutionnel (IC-01) : des inconnus, pas mes relations, et
 * « Chargement… » pour toujours hors d'une organisation.
 *
 * Les places (IC-03/IC-04) se lisent dans UNE projection — `projectCallSeats` —
 * qui unit la projection serveur et les seuls ajouts optimistes non encore
 * acquittés, et où un refus, un manqué ou un « ne pas déranger » libèrent la
 * place et restent RÉINVITABLES.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useConvexMutationQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { engineErrorRule } from "@antsia/social-contracts/errors"
import { useModalA11y } from "@antsia/ui"
import { Loader2, RotateCcw, UserPlus, X } from "lucide-react"
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { callStore } from "../../stores/call-store"
import { ESCAPE_PRIORITY } from "../../shell/floating-surface/escape-stack"
import { useEscapeLayer } from "../../shell/floating-surface/use-escape-layer"
import { filterRelationRecipients } from "../messagerie/messagerie-recipients"
import { ReseauQueryError } from "../../shell/ReseauQueryError"
import { usePersonalConnections } from "../reseau-personnel/use-dual-connection-pagination"
import {
	candidateSubtitle,
	shouldAutoLoadMore,
	toCallCandidates,
	type AddToCallCandidate,
} from "./add-to-call-candidates"
import { describeCallSeats, projectCallSeats } from "./call-seats"
import type {
	CallAdmissionReason,
	CallKind,
	CallParticipantState,
	CallParticipantView,
} from "./call-types"
import { participantStatusLabel } from "./group-stage"

export interface AddToCallPanelProps {
	/** L'appel en cours (`Id<"calls">`) — le nom du champ est celui du socle. */
	meetingId: Id<"calls">
	/** Plafond fourni par le serveur pour cet appel. */
	maxParticipants: number
	/** Le genre EFFECTIF de l'appel, réconcilié depuis l'appel (IC-02). */
	callKind: CallKind
	/**
	 * La projection serveur des conviés (`listParticipants`) — `undefined`
	 * pour un tête-à-tête non promu, ou tant qu'elle n'est pas arrivée.
	 */
	participants: readonly CallParticipantView[] | undefined
	/** Places présumées occupées SANS projection (2 : un tête-à-tête). */
	fallbackOccupied?: number
	/**
	 * La POSE du panneau (IC-11) — le même composant, deux positions, jamais
	 * deux composants parallèles :
	 *
	 *  · `sheet` — feuille collée au bas de l'écran, bornée par le viewport
	 *    VISUEL (`--vv-height`) pour rester au-dessus du clavier logiciel ;
	 *  · `anchored` — panneau ancré en haut à droite de la scène d'appel.
	 *
	 * Le positionnement vit dans la feuille de style (`[data-pose=…]`), plus
	 * dans un `style` en ligne : un `position: fixed` posé en dur ignorait le
	 * clavier et sortait de l'écran sur un téléphone.
	 */
	pose?: "sheet" | "anchored"
	onClose: () => void
}

/** Une ligne de la liste — rendue par le parent, qui seul connaît les places. */
type RowRenderer = (person: AddToCallCandidate) => ReactNode

export function AddToCallPanel({
	meetingId,
	maxParticipants,
	callKind,
	participants,
	fallbackOccupied,
	pose = "anchored",
	onClose,
}: AddToCallPanelProps) {
	const { t } = useTranslation("iappel")
	const { networkId } = useNetwork()
	const rootRef = useRef<HTMLDivElement | null>(null)
	/**
	 * Le champ de recherche de la liste — le focus initial y entre.
	 *
	 * ⚠️ La ref est tenue par le PARENT et descendue en prop : la liste
	 * plaçait son propre focus dans un effet d'enfant, qui court AVANT celui du
	 * parent. `useModalA11y` photographiait alors le champ lui-même comme
	 * « élément actif précédent », et la fermeture ne rendait plus le focus au
	 * déclencheur — il partait au `<body>`.
	 */
	const searchRef = useRef<HTMLInputElement | null>(null)
	const [pendingId, setPendingId] = useState<string | null>(null)
	/**
	 * Ajoutés PENDANT cette ouverture et pas encore acquittés — réservés
	 * d'office, puis ACQUITTÉS (retirés d'ici) dès que la projection dit autre
	 * chose que ce qu'elle disait au clic (IC-03). La valeur est cet état-là
	 * (`null` : la personne n'y figurait pas) : un refusé qu'on réinvite est
	 * déjà porté « declined » par une projection qui n'a rien vu encore.
	 */
	const [justAdded, setJustAdded] = useState<
		ReadonlyMap<string, CallParticipantState | null>
	>(new Map())
	/** Écartés par LEURS réglages pendant cette ouverture — libellés, sans réserver. */
	const [unavailable, setUnavailable] = useState<
		ReadonlyMap<string, CallAdmissionReason | null>
	>(new Map())

	const { mutateAsync: addInvitee } = useConvexMutationQuery(
		api.modules.calls.groupCalls.addInvitee,
	)

	// UNE projection des places, la même que le serveur compare.
	const seats = useMemo(
		() => projectCallSeats({ participants, optimistic: justAdded, fallbackOccupied, max: maxParticipants }),
		[participants, justAdded, fallbackOccupied, maxParticipants],
	)

	// L'ACQUITTEMENT de l'optimisme : ce que le serveur porte désormais ne
	// compte plus ici — sinon la personne était comptée deux fois.
	useEffect(() => {
		if (seats.acknowledged.length === 0) return
		setJustAdded((current) => {
			const next = new Map(current)
			for (const id of seats.acknowledged) next.delete(id)
			return next
		})
	}, [seats.acknowledged])

	const byUser = useMemo(() => {
		const map = new Map<string, CallParticipantView>()
		for (const participant of participants ?? []) {
			map.set(String(participant.userId), participant)
		}
		return map
	}, [participants])

	/**
	 * Focus initial dans le champ, restitution au déclencheur à la fermeture —
	 * par la primitive du dépôt, plus à la main (IC-11).
	 *
	 * ⚠️ `trapFocus: false` : le panneau N'EST PAS modal. Un appel vit derrière
	 * lui, et piéger Tab rendrait « Raccrocher » inatteignable au clavier. Dans
	 * ce mode, Échap n'appartient pas non plus au hook : il vient de la pile
	 * (ci-dessous), qui seule sait qui est au-dessus de qui.
	 * `skipInert: true` pour la même raison — inerter la scène couperait les
	 * commandes de l'appel.
	 */
	useModalA11y({
		containerRef: rootRef,
		initialFocusRef: searchRef,
		onClose,
		trapFocus: false,
		skipInert: true,
	})

	// Échap ferme le panneau — et LUI SEUL. Sans la pile, la même frappe
	// réduisait aussi l'appel : l'hôte, monté avant, s'abonnait avant (IC-12).
	useEscapeLayer({
		id: "add-to-call",
		priority: ESCAPE_PRIORITY.OVERLAY,
		onEscape: onClose,
	})

	// Fermer au clic extérieur — le panneau n'est pas modal : l'appel continue
	// derrière, et on doit pouvoir le piloter.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const root = rootRef.current
			if (root !== null && !root.contains(event.target as Node)) onClose()
		}
		window.addEventListener("mousedown", onClick)
		return () => window.removeEventListener("mousedown", onClick)
	}, [onClose])

	const complet = seats.remaining <= 0

	const handleAdd = async (userId: string) => {
		if (pendingId !== null || complet) return
		// L'état que le serveur donne à cette personne AU CLIC — la clé de
		// l'acquittement : la projection acquitte quand elle dit autre chose.
		const priorState = byUser.get(userId)?.state ?? null
		setPendingId(userId)
		try {
			const added = await addInvitee({
				networkId,
				callId: meetingId,
				personId: userId as Id<"persons">,
			})
			if (added.alreadyIn) {
				// Rien n'a changé côté serveur : rien ne change ici non plus —
				// ajouter à l'optimisme compterait une place qui n'existe pas.
				toast.info(t("addToCallPanel.alreadyIn"))
			} else if (added.admitted) {
				toast.success(t("addToCallPanel.ringing"))
				setJustAdded((current) => new Map(current).set(userId, priorState))
				setUnavailable((current) => {
					if (!current.has(userId)) return current
					const next = new Map(current)
					next.delete(userId)
					return next
				})
				if (added.promoted) {
					// IC-02 : le tête-à-tête vient de devenir un groupe. La grille
					// s'ouvre sans attendre le prochain instantané de l'appel — le
					// titre arrive par la query. B, qui n'a rien muté, est couvert
					// par sa propre souscription (`getCall`, hôte).
					callStore.reconcileSlotFromMeeting(meetingId, { callKind: "group", group: null })
				}
			} else {
				// Écarté par SES réglages : l'appel continue — le taire ferait
				// croire qu'il va décrocher. La ligne le dit, sans réserver.
				toast.info(t("addToCallPanel.unavailable"))
				setUnavailable((current) => new Map(current).set(userId, added.reason ?? null))
			}
		} catch (error) {
			// Le moteur lève un CODE, jamais une phrase : une règle connue (appel
			// complet, invitations épuisées…) se dit avec ses bornes ; tout le
			// reste — refus indistinct compris — reçoit le message générique.
			const rule = engineErrorRule(error)
			toast.error(rule ? t(`rules:${rule.rule}`, rule.params) : t("addToCallPanel.failed"))
		} finally {
			setPendingId(null)
		}
	}

	const renderRow: RowRenderer = (person) => {
		const server = byUser.get(person.userId)
		const reserved = seats.reservedIds.has(person.userId)
		const localReason = unavailable.get(person.userId)
		const state: CallParticipantState | null =
			server?.state ??
			(reserved ? "ringing" : localReason !== undefined ? "unavailable" : null)
		const reason = server?.reason ?? localReason ?? null
		// Un état terminal (refus, manqué, indisponible, parti) ne réserve pas
		// et reste RÉINVITABLE — la même mutation, un ticket neuf (IC-04).
		const terminal = state !== null && !reserved
		const isPending = pendingId === person.userId
		const label = state !== null ? participantStatusLabel({ state, reason }, t) : null
		const secondary =
			label !== null
				? terminal
					? t("addToCallPanel.reinviteSuffix", { label })
					: label
				: candidateSubtitle(person)
		const accessibleName = reserved
			? t("addToCallPanel.alreadyInName", { name: person.name })
			: terminal
				? t("addToCallPanel.reinvite", { name: person.name })
				: t("addToCallPanel.add", { name: person.name })
		return (
			<button
				key={person.userId}
				type="button"
				className="iappel-launcher-row"
				data-selected={reserved ? "true" : "false"}
				data-state={state ?? undefined}
				aria-label={accessibleName}
				// Déjà dans l'appel, plafond atteint, ou un ajout en vol : la
				// ligne se désactive — un clic sans effet se lit comme une panne.
				disabled={reserved || complet || pendingId !== null}
				onClick={() => void handleAdd(person.userId)}
			>
				<span className="iappel-launcher-check" aria-hidden="true">
					{isPending ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : reserved ? (
						<UserPlus className="h-3 w-3" />
					) : terminal ? (
						<RotateCcw className="h-3 w-3" />
					) : null}
				</span>
				<span className="iappel-launcher-person">
					<span className="iappel-launcher-name">{person.name}</span>
					{secondary && <span className="iappel-launcher-role">{secondary}</span>}
				</span>
			</button>
		)
	}

	return (
		<div
			ref={rootRef}
			className="iappel-launcher-panel"
			// La POSE décide de la position, dans la feuille de style. Le `style`
			// en ligne d'avant (`fixed`, 4.5rem/1rem) ignorait le clavier logiciel
			// et sortait la feuille de l'écran sur un téléphone.
			data-pose={pose}
			role="dialog"
			aria-labelledby="iappel-add-title"
		>
			<div className="iappel-launcher-head">
				<span className="iappel-launcher-title" id="iappel-add-title">
					<UserPlus aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
					{t("addToCallPanel.title")}
				</span>
				<button
					type="button"
					onClick={onClose}
					aria-label={t("addToCallPanel.close")}
					className="iappel-launcher-close"
				>
					<X aria-hidden="true" className="h-4 w-4" />
				</button>
			</div>

			<AddToCallPersonalList renderRow={renderRow} searchRef={searchRef} />

			<div className="iappel-launcher-foot">
				<span className="iappel-launcher-hint" role="status">
					{callKind === "group" && !seats.hasProjection
						? t("addToCallPanel.seatsUpdating", { seats: describeCallSeats(seats, t) })
						: describeCallSeats(seats, t)}
				</span>
			</div>
		</div>
	)
}

/**
 * Appel PERSONNEL — mes connexions acceptées, filtrées localement par nom ou
 * @identifiant, avec la page suivante chargée d'office tant qu'un terme
 * saisi ne trouve rien (le défaut IC-05 cachait « Voir plus » à qui
 * cherchait). Quatre états DISTINCTS : attente, panne (avec « Réessayer »),
 * aucune relation, aucune correspondance.
 */
function AddToCallPersonalList({
	renderRow,
	searchRef,
}: {
	renderRow: RowRenderer
	searchRef: RefObject<HTMLInputElement | null>
}) {
	const { t } = useTranslation("iappel")
	const relations = usePersonalConnections({ pageSize: 50 })
	const [term, setTerm] = useState("")

	const matches = useMemo(
		() => toCallCandidates(filterRelationRecipients(relations.items, term)),
		[relations.items, term],
	)
	const { hasMore, isLoadingMore, loadMore } = relations
	useEffect(() => {
		if (shouldAutoLoadMore({ term, matchCount: matches.length, hasMore, isLoadingMore })) {
			loadMore()
		}
	}, [term, matches.length, hasMore, isLoadingMore, loadMore])

	const cleanTerm = term.trim()
	return (
		<>
			<input
				ref={searchRef}
				type="search"
				className="iappel-launcher-search"
				placeholder={t("addToCallPanel.searchPlaceholder")}
				value={term}
				onChange={(event) => setTerm(event.target.value)}
				aria-label={t("addToCallPanel.searchLabel")}
			/>
			<div className="iappel-launcher-list">
				{relations.isLoading ? (
					<p className="iappel-launcher-empty" role="status">
						{t("addToCallPanel.loading")}
					</p>
				) : relations.isError ? (
					<ReseauQueryError
						title={t("addToCallPanel.errorTitle")}
						message={t("addToCallPanel.errorMessage")}
						onRetry={relations.retry}
					/>
				) : relations.items.length === 0 ? (
					<p className="iappel-launcher-empty">{t("addToCallPanel.empty")}</p>
				) : matches.length === 0 ? (
					<p className="iappel-launcher-empty" role="status">
						{isLoadingMore
							? t("addToCallPanel.searching")
							: t("addToCallPanel.noMatch", { term: cleanTerm })}
					</p>
				) : (
					<>
						{matches.map(renderRow)}
						{hasMore && cleanTerm.length === 0 ? (
							<button
								type="button"
								className="iappel-launcher-row"
								style={{ justifyContent: "center" }}
								disabled={isLoadingMore}
								onClick={loadMore}
							>
								{isLoadingMore ? t("addToCallPanel.loadingMore") : t("addToCallPanel.more")}
							</button>
						) : null}
					</>
				)}
			</div>
		</>
	)
}
