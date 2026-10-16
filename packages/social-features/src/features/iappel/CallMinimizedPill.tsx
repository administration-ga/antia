// Dupliqué de socle/packages/agent-features/src/features/iappel/CallMinimizedPill.tsx @ ad2e7fdc2 — adaptations : libellés et noms accessibles traduits (i18n `iappel`) ; clé de placement préfixée par le réseau (`storagePrefix`, un état par réseau).
"use client"

/**
 * CallMinimizedPill — l'appel continue, la surface se retire.
 *
 * C'est la pièce qui rend l'appel COMPATIBLE avec le travail : consulter un
 * dossier, relire un courrier, chercher un numéro — sans raccrocher, et sans
 * que la conversation ne soit coupée une seule fois (la salle vit dans le pool
 * global, la pilule n'est qu'une vue).
 *
 * ⚠️ Au téléphone, elle se pose AU-DESSUS de la barre de navigation. Cette
 * hauteur dépend de l'écran affiché (barre de l'espace, barre d'iRéseau, ou
 * aucune) : on la mesure et on l'écrit dans `--iappel-bottom-inset`, plutôt
 * que de recopier une constante qui se démentirait au premier changement de
 * gabarit — et qui ferait flotter la pilule au milieu de rien, ou la
 * masquerait derrière la barre.
 */

import { GripVertical, Mic, MicOff, PhoneOff, Play } from "lucide-react"
import { useNetwork } from "@antsia/api/network"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useSurfaceDrag } from "./use-surface-drag"
import { elapsedSince, formatElapsed } from "./call-timer"

export interface CallMinimizedPillProps {
	name: string
	/** Départ du chrono, ou `null` tant que l'appel n'est pas décroché. */
	timerStart: number | null
	/** État à annoncer quand il n'y a pas encore de durée (« Sonnerie… »). */
	stateLabel: string
	micMuted: boolean
	/** Appels tenus EN PLUS de celui-ci. */
	heldCount: number
	onToggleMic: () => void
	onRestore: () => void
	onHangUp: () => void
	/**
	 * `hosted` : la pilule est une BANDE en tête du corps d'une carte iCom
	 * (cf. `call-host.ts`) — en flux, pleine largeur, ni déplaçable ni calée
	 * au viewport. Les deux autres poses sont les surfaces libres.
	 */
	pose: "mobile" | "desktop" | "hosted"
}

/** Hauteur de la barre de navigation basse, mesurée sur le document. */
function useBottomBarInset(active: boolean): void {
	useEffect(() => {
		if (!active) return
		if (typeof document === "undefined") return
		const root = document.documentElement
		const measure = () => {
			const bar = document.querySelector<HTMLElement>(
				"[data-mobile-nav], .esp-mobile-bar, .rm-tabbar",
			)
			const height = bar?.getBoundingClientRect().height ?? 0
			root.style.setProperty("--iappel-bottom-inset", `${Math.round(height)}px`)
		}
		measure()
		window.addEventListener("resize", measure)
		return () => {
			window.removeEventListener("resize", measure)
			// La réserve n'a de sens que tant que la pilule existe : la laisser
			// posée décalerait d'autres surfaces qui la liraient plus tard.
			root.style.removeProperty("--iappel-bottom-inset")
		}
	}, [active])
}

export function CallMinimizedPill({
	name,
	timerStart,
	stateLabel,
	micMuted,
	heldCount,
	onToggleMic,
	onRestore,
	onHangUp,
	pose,
}: CallMinimizedPillProps) {
	const { t } = useTranslation("iappel")
	const { storagePrefix } = useNetwork()
	const [, tick] = useState(0)
	useBottomBarInset(pose === "mobile")
	// Au téléphone la pilule est déjà pleine largeur, calée au-dessus de la
	// barre basse : la déplacer ne pourrait que la cacher derrière celle-ci.
	const drag = useSurfaceDrag({
		storageKey: `${storagePrefix}iappel:pill`,
		enabled: pose === "desktop",
		label: t("callMinimizedPill.move"),
	})

	useEffect(() => {
		if (timerStart === null) return
		const id = setInterval(() => tick((n) => n + 1), 1000)
		return () => clearInterval(id)
	}, [timerStart])

	const timer =
		timerStart === null ? null : formatElapsed(elapsedSince(timerStart, Date.now()))

	return (
		<div
			ref={drag.ref as React.RefObject<HTMLDivElement>}
			className="iappel-pill iappel-layer iappel-enter"
			data-pose={pose}
			data-dragging={drag.dragging ? "true" : undefined}
			role="group"
			aria-label={t("callMinimizedPill.label", { name })}
		>
			{/* Poignée dédiée, au lieu de rendre tout le corps déplaçable : le
			    corps EST le bouton qui ramène à l'appel, et un déplacement qui
			    lui volerait son clic coûterait le geste le plus attendu. */}
			{pose === "desktop" && (
				<span className="iappel-pill-grip" {...drag.handleProps}>
					<GripVertical aria-hidden="true" className="h-3.5 w-3.5" />
				</span>
			)}
			{/* Tout le corps ramène à l'appel : la cible la plus large est celle
			    qu'on vise le plus souvent. */}
			<button
				type="button"
				onClick={onRestore}
				className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
				aria-label={t("callMinimizedPill.restore", { name })}
			>
				<span
					aria-hidden="true"
					className="call-pulse-ping relative h-2 w-2 shrink-0 rounded-full"
					style={{ background: "var(--success)", color: "var(--success)" }}
				/>
				<span className="flex min-w-0 flex-col leading-tight">
					<span className="truncate text-[13px] font-semibold">{name}</span>
					<span className="text-[11px]" style={{ opacity: 0.7 }}>
						{timer !== null ? (
							<span className="iappel-count">{timer}</span>
						) : (
							stateLabel
						)}
						{heldCount > 0 && (
							<>
								{" · "}
								<span className="iappel-count">{heldCount}</span> {t("callMinimizedPill.heldSuffix")}
							</>
						)}
					</span>
				</span>
			</button>

			<button
				type="button"
				onClick={onToggleMic}
				aria-label={micMuted ? t("callMinimizedPill.unmute") : t("callMinimizedPill.mute")}
				aria-pressed={micMuted}
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
				style={{
					background: micMuted
						? "var(--esp-immersive-on-ink)"
						: "color-mix(in srgb, var(--esp-immersive-on-ink) 12%, transparent)",
					color: micMuted ? "var(--esp-immersive-ink)" : "var(--esp-immersive-on-ink)",
				}}
			>
				{micMuted ? (
					<MicOff aria-hidden="true" className="h-4 w-4" />
				) : (
					<Mic aria-hidden="true" className="h-4 w-4" />
				)}
			</button>

			<button
				type="button"
				onClick={onRestore}
				aria-label={t("callMinimizedPill.fullscreen")}
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
				style={{
					background: "color-mix(in srgb, var(--esp-immersive-on-ink) 12%, transparent)",
					color: "var(--esp-immersive-on-ink)",
				}}
			>
				<Play aria-hidden="true" className="h-4 w-4" />
			</button>

			<button
				type="button"
				onClick={onHangUp}
				aria-label={t("callMinimizedPill.hangUp")}
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
				style={{
					background: "var(--destructive)",
					color: "var(--destructive-foreground)",
				}}
			>
				<PhoneOff aria-hidden="true" className="h-4 w-4" />
			</button>
		</div>
	)
}
