// Dupliqué de socle/packages/agent-features/src/features/iappel/CallSurface.tsx @ ad2e7fdc2 — adaptations : appel `Id<"calls">` (table `meetings` → `calls`) ; noms accessibles et aide de déplacement traduits (i18n `iappel`) ; clé de placement préfixée par le réseau (`storagePrefix`) ; `ImmersiveOverlay` de @antsia/ui (charte de l'application).
"use client"

/**
 * CallSurface — LA surface d'appel, et ses trois poses.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE SEULE SURFACE, TROIS POSES, ET AUCUNE SALLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce composant ne monte AUCUN `<LiveKitRoom>`. Les salles vivent dans le pool
 * global (`CallRoomPool`, monté par l'hôte) et sont publiées dans
 * `callRoomRegistry` ; la surface les consomme par `RoomContext`.
 *
 * C'est ce qui permet de réduire l'appel, de changer de page, d'ouvrir une
 * conversation et de revenir — sans qu'un seul mot ne soit coupé. L'écran
 * précédent montait la salle DANS sa fenêtre : la fermer raccrochait.
 *
 * ── Pourquoi pas une `Sheet` ni un `Dialog` ───────────────────────────────
 * `SheetContent` porte `data-[side=bottom]:h-auto`, dont la spécificité BAT
 * le `h-dvh` qu'on lui passe en `className`. La feuille prenait donc la
 * hauteur de son contenu — un tiers d'écran sur les captures — et la scène
 * vidéo, en `flex-1 min-h-0`, tombait à zéro pixel de haut. La vidéo distante
 * était invisible ALORS MÊME que la piste arrivait. C'est le premier des
 * défauts corrigés, et il interdit ces deux primitives ici.
 *
 * Le plein écran passe donc par `ImmersiveOverlay` (portail vers `<body>`,
 * hauteur du viewport VISIBLE clavier compris, zones sûres, verrou de
 * défilement, accessibilité modale), et le bureau par une fenêtre flottante
 * NON modale : la page reste utilisable pendant l'appel, ce qui est tout
 * l'intérêt d'un téléphone posé sur un bureau.
 *
 * ── Et quand un téléphone iCom est à l'écran : DANS le téléphone ──────────
 * Depuis le 2026-09-13 (IC-01/IC-02/IC-06), la fenêtre de bureau n'est plus
 * que le REPLI. Quand une carte iCom se déclare comme hôte pour le scope de
 * l'appel (`call-host-store.ts`), les deux poses de bureau se portaillent
 * dans le CORPS de la carte : l'appel affiché le couvre (`cover`), l'appel
 * réduit devient une bande en tête (`strip`). Même surface, même salle, même
 * `children` — seule la DESTINATION change. C'est l'hôte global qui décide
 * (`host` en prop, comme `plan`) : cette surface ne choisit toujours rien.
 */

import { useNetwork } from "@antsia/api/network"
import { ImmersiveOverlay } from "@antsia/ui/overlay"
import { RoomContext } from "@livekit/components-react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import { useCallRoom } from "../../stores/call-room-registry"
import { useCallStore } from "../../stores/call-store"
import { hostModeFor } from "./call-host"
import type { CallHost } from "./call-host-store"
import type { CallPresentation, CallSurfacePlan } from "./call-surface-plan"
import { CallMinimizedPill } from "./CallMinimizedPill"
import { useSurfaceDrag } from "./use-surface-drag"
import type { Id } from "@antsia/api/engine"

export interface CallSurfaceProps {
	/** `null` au rendu serveur : on n'affiche rien plutôt que de deviner. */
	isMobile: boolean | null
	/**
	 * La pose, décidée AILLEURS.
	 *
	 * ⚠️ Cette surface ne calcule plus son plan, et c'est délibéré. L'hôte
	 * répondait à « quel est l'appel de tête ? » par `activeSlotId` brut,
	 * pendant qu'ici `planCallSurface` répondait autrement : deux réponses
	 * possibles à la même question, d'où des états où l'hôte composait un
	 * écran que la surface n'affichait pas. Un seul site d'appel rend la
	 * divergence structurellement impossible.
	 */
	plan: CallSurfacePlan
	/** L'appel de tête, tel que le plan l'a désigné. */
	frontId: Id<"calls"> | null
	/** Comment nommer le correspondant de tête. */
	peerName: string
	/** Le contenu de la surface, rendu DANS le contexte de la salle. */
	children: React.ReactNode
	/** État de l'appel de tête, pour la pilule réduite. */
	pillState: { timerStart: number | null; label: string }
	/**
	 * Le genre de l'appel de tête. Un appel de GROUPE reçoit une fenêtre plus
	 * large (IC-10) : à 400 px, une grille de cinq vignettes ne montre plus
	 * personne. Le genre ne change RIEN d'autre — même surface, même salle.
	 */
	callKind?: "direct" | "group"
	/**
	 * La carte iCom qui HÉBERGE l'appel, décidée par l'hôte pour le scope de
	 * l'appel (`useCallHostFor`). `null` ou absente : surface libre — fenêtre
	 * de bureau ou pilule, comme avant. Ne vaut que pour les poses de bureau ;
	 * au téléphone réel, l'écran entier reste la réponse.
	 */
	host?: CallHost | null
	onToggleMic: () => void
	onRestore: () => void
	onHangUp: (meetingId: Id<"calls">) => void
}

export function CallSurface({
	isMobile,
	plan,
	frontId,
	peerName,
	children,
	pillState,
	callKind,
	host = null,
	onToggleMic,
	onRestore,
	onHangUp,
}: CallSurfaceProps) {
	const { t } = useTranslation("iappel")
	const { micMuted } = useCallStore()
	const room = useCallRoom(frontId)
	// Même décision que l'hôte (`hostModeFor`, module pur) : ce que l'appel
	// occupe dans la carte. `none` = surface libre.
	const hostMode = hostModeFor(plan.presentation, host)

	if (plan.presentation === "hidden") return null

	if (plan.presentation === "minimized") {
		const pill = (
			<CallMinimizedPill
				name={peerName}
				timerStart={pillState.timerStart}
				stateLabel={pillState.label}
				micMuted={micMuted}
				heldCount={plan.held.length}
				onToggleMic={onToggleMic}
				onRestore={onRestore}
				onHangUp={() => frontId && onHangUp(frontId)}
				pose={
					hostMode === "strip" ? "hosted" : isMobile === true ? "mobile" : "desktop"
				}
			/>
		)
		// Réduit DANS la carte : une bande en tête de son corps, les
		// conversations redeviennent accessibles dessous — comme un téléphone.
		return hostMode === "strip" && host !== null
			? createPortal(pill, host.element)
			: pill
	}

	// La salle peut ne pas être encore publiée (le jeton arrive) : on rend
	// quand même la surface, avec son écran « Connexion… ». Attendre la salle
	// pour afficher quoi que ce soit laisserait un écran noir de deux secondes
	// après un décrochage.
	const inRoom =
		room === null ? (
			children
		) : (
			<RoomContext.Provider value={room}>{children}</RoomContext.Provider>
		)

	if (plan.presentation === "fullscreen") {
		return (
			<ImmersiveOverlay
				open
				onClose={onRestore}
				label={t("callSurface.label", { name: peerName })}
				// ⚠️ La couche d'appel passe AU-DESSUS de tout, éléments
				// flottants compris : sinon l'un d'eux vole le clic sur
				// « Décrocher », et le geste le plus urgent de la plateforme est
				// le seul à ne pas répondre.
				layerClassName="iappel-layer"
			>
				{inRoom}
			</ImmersiveOverlay>
		)
	}

	// Affiché DANS la carte : l'appel couvre le corps du téléphone iCom. Le
	// genre voyage en attribut pour la feuille de style, mais le cadre ne
	// change pas avec lui (IC-03) — un groupe reste un appel dans le même
	// téléphone, sa grille se mesure sur la place disponible.
	if (hostMode === "cover" && host !== null) {
		return createPortal(
			<section
				className="iappel-hosted"
				data-call-kind={callKind}
				role="region"
				aria-label={t("callSurface.label", { name: peerName })}
			>
				{inRoom}
			</section>,
			host.element,
		)
	}

	return (
		<FloatingSurface peerName={peerName} callKind={callKind}>
			{inRoom}
		</FloatingSurface>
	)
}

/**
 * La fenêtre de bureau — portaillée vers `<body>`, NON modale.
 *
 * Pas de `role="dialog" aria-modal`, pas de piège de focus, pas de voile : on
 * doit pouvoir prendre des notes en parlant. Échap ne raccroche PAS (ce serait
 * irrattrapable) : il réduit, et c'est l'hôte qui l'écoute.
 */
function FloatingSurface({
	peerName,
	callKind,
	children,
}: {
	peerName: string
	callKind?: "direct" | "group"
	children: React.ReactNode
}) {
	const { t } = useTranslation("iappel")
	const { storagePrefix } = useNetwork()
	const drag = useSurfaceDrag({
		storageKey: `${storagePrefix}iappel:float`,
		enabled: true,
		label: t("callSurface.move"),
	})
	if (typeof document === "undefined") return null
	return createPortal(
		<section
			ref={drag.ref as React.RefObject<HTMLElement>}
			className="iappel-float iappel-layer iappel-enter"
			// La largeur suit le GENRE, dans la feuille de style : un bloc à
			// part, pour ne pas toucher `.iappel-float` (cliquet d'ancrage).
			data-call-kind={callKind}
			data-dragging={drag.dragging ? "true" : undefined}
			role="region"
			aria-label={t("callSurface.label", { name: peerName })}
		>
			{/* La POIGNÉE est une bande posée au-dessus de l'en-tête, et non
			    l'en-tête lui-même : celui-ci porte le bouton « Réduire », et
			    une poignée qui l'englobe finirait par lui voler son clic.
			    Elle est fine, et c'est assumé — la surface entière reste
			    cliquable pour ce qu'elle offre. */}
			<div className="iappel-float-handle" {...drag.handleProps}>
				<span aria-hidden="true" className="iappel-float-grip" />
				<span className="sr-only">{t("callSurface.moveHelp")}</span>
			</div>
			{children}
		</section>,
		document.body,
	)
}

export type { CallPresentation }
