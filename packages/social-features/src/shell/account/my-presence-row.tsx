// Dupliqué de socle/packages/agent-features/src/features/iappel/my-presence-row.tsx @ ad2e7fdc2 — adaptations : réglages d'appel de la PERSONNE (`calls.preferences.getMine` avec un instant arrondi à la minute fourni par l'écran, `calls.preferences.setDnd` sans portée — fonctions sur soi, sans réseau) ; portée du silence retirée (`scope: "all"` : le moteur n'en a pas) ; libellés, pastilles et toast traduits (i18n `iappel`, pastilles par leur `labelKey`), heure d'échéance dans la langue courante ; identifiant du titre sans le préfixe de l'espace agent ; déplacé dans la coque (`shell/account`). ; PA6 : dates et jours civils dans le fuseau personnel du lecteur (repli appareil).
"use client"

/**
 * « Mon statut » — la rangée du MENU AVATAR (feuille de compte).
 *
 * Le geste rapide arbitré le 2026-09-01 : voir son propre état (En ligne /
 * Occupé / Ne pas déranger) et poser un « Ne pas déranger » sans traverser
 * les réglages. Le silence du moteur n'a pas de portée : c'est le geste de la
 * PERSONNE, valable dans tous ses réseaux.
 *
 * L'état affiché se DÉRIVE, il ne se déclare pas :
 *  · un appel tenu (store local) → « Occupé » ;
 *  · un `dnd.until` à venir (préférences serveur) → « Ne pas déranger » ;
 *  · sinon → « En ligne » (je suis là, puisque ce menu est ouvert).
 */

import { formatViewerDate } from "@antsia/api/civil-date"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DND_DURATION_PILLS } from "../../features/iappel/dnd-presets"
import { PresenceDot, presenceLabel, type PresenceState } from "../../features/iappel/presence-dot"
import { useCallStore } from "../../stores/call-store"

/** L'heure d'échéance, dans la langue de l'écran et le fuseau de l'appareil. */
function formatLocalTime(ms: number, locale: string, timeZone: string): string {
	return formatViewerDate(ms, locale, {
		hour: "2-digit",
		minute: "2-digit",
	}, timeZone)
}

/**
 * Le pas de l'instant passé à la lecture des réglages : une minute. Le moteur
 * ne lit pas l'horloge dans une requête ; un instant arrondi reste le même
 * d'un rendu à l'autre, et la souscription ne se refait qu'à la minute.
 */
const PREFS_NOW_STEP_MS = 60_000

export function MyPresenceRow() {
	const { t, i18n } = useTranslation("iappel")
	const timeZone = useViewerTimeZone()
	const [now] = useState(() => Date.now())
	const prefs = useAuthenticatedConvexQuery(api.modules.calls.preferences.getMine, {
		now: Math.floor(now / PREFS_NOW_STEP_MS) * PREFS_NOW_STEP_MS,
	})
	const setDnd = useMutation(api.modules.calls.preferences.setDnd)
	const { slots } = useCallStore()
	const [pillsOpen, setPillsOpen] = useState(false)
	const [busy, setBusy] = useState(false)

	const dnd = prefs.data?.dnd ?? null
	const dndActive = dnd !== null && dnd.until > now
	const inCall = [...slots.values()].some(
		(slot) => slot.status === "active" || slot.status === "held",
	)

	const state: Exclude<PresenceState, null> = inCall
		? "in_call"
		: dndActive
			? "dnd"
			: "available"

	const apply = async (until: number | null) => {
		setBusy(true)
		try {
			await setDnd({ until })
			setPillsOpen(false)
		} catch {
			toast.error(t("myPresenceRow.failed"))
		} finally {
			setBusy(false)
		}
	}

	return (
		<section aria-labelledby="account-presence-label">
			<p
				id="account-presence-label"
				className="mb-1 px-2 text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase"
			>
				{t("myPresenceRow.title")}
			</p>
			<div className="rounded-xl bg-secondary px-3 py-2.5">
				<div className="flex items-center justify-between gap-3">
					<span className="flex min-w-0 items-center text-sm font-medium">
						{presenceLabel(state, t)}
						<PresenceDot state={state} />
						{dndActive && (
							<span className="ml-2 truncate text-xs text-muted-foreground">
								{t("myPresenceRow.until", { time: formatLocalTime(dnd.until, i18n.language, timeZone) })}
							</span>
						)}
					</span>
					{dndActive ? (
						<button
							type="button"
							className="min-h-11 min-w-11 shrink-0 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
							disabled={busy}
							onClick={() => void apply(null)}
						>
							{t("myPresenceRow.disable")}
						</button>
					) : (
						<button
							type="button"
							className="min-h-11 min-w-11 shrink-0 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-semibold underline underline-offset-2"
							aria-expanded={pillsOpen}
							onClick={() => setPillsOpen((open) => !open)}
						>
							{t("myPresenceRow.dnd")}
						</button>
					)}
				</div>
				{pillsOpen && !dndActive && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						{DND_DURATION_PILLS.map((pill) => (
							<button
								key={pill.labelKey}
								type="button"
								className="min-h-11 min-w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border/60 px-2.5 py-1 text-xs disabled:opacity-50"
								disabled={busy}
								onClick={() => void apply(pill.computeUntil(timeZone))}
							>
								{t(pill.labelKey)}
							</button>
						))}
					</div>
				)}
			</div>
		</section>
	)
}
