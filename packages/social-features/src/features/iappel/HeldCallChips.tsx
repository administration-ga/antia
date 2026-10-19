// Dupliqué de socle/packages/agent-features/src/features/iappel/HeldCallChips.tsx @ ad2e7fdc2 — adaptations : libellés et noms accessibles traduits (i18n `iappel`, nom interpolé) ; ronds Reprendre et Raccrocher à l'aplat et au texte de Valider et de Supprimer (`--role-success-*`, `--role-danger-*`, ADR-0027), facture d'origine en repli.
"use client"

/**
 * HeldCallChips — les appels EN ATTENTE, et de quoi y revenir.
 *
 * Sans ces puces, un appel mis en attente disparaît de l'écran : on ne sait
 * plus qu'il existe, et on raccroche le mauvais. Chacune porte le nom, le
 * temps d'attente (en monospace, c'est un compte), et deux gestes.
 *
 * Le temps d'attente n'est pas décoratif : laisser quelqu'un en attente est
 * une chose qu'on fait volontiers pendant vingt secondes, et beaucoup moins
 * pendant trois minutes. L'afficher, c'est le rappeler.
 */

import { PhoneOff, Play } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { elapsedSince, formatElapsed } from "./call-timer"

export interface HeldCallView {
	meetingId: string
	name: string
	heldSince: number | null
}

export interface HeldCallChipsProps {
	calls: readonly HeldCallView[]
	onResume: (meetingId: string) => void
	onHangUp: (meetingId: string) => void
}

export function HeldCallChips({ calls, onResume, onHangUp }: HeldCallChipsProps) {
	const { t } = useTranslation("iappel")
	const [, tick] = useState(0)
	useEffect(() => {
		if (calls.length === 0) return
		const id = setInterval(() => tick((n) => n + 1), 1000)
		return () => clearInterval(id)
	}, [calls.length])

	if (calls.length === 0) return null

	return (
		<div
			className="flex flex-wrap items-center justify-center gap-2 px-4"
			role="group"
			aria-label={t("heldCallChips.label")}
		>
			{calls.map((call) => (
				<span key={call.meetingId} className="iappel-chip gap-2">
					<span className="iappel-eyebrow" style={{ opacity: 0.7 }}>
						{t("heldCallChips.held")}
					</span>
					<span className="max-w-[120px] truncate font-medium">{call.name}</span>
					{call.heldSince !== null && (
						<span className="iappel-count" style={{ opacity: 0.8 }}>
							{formatElapsed(elapsedSince(call.heldSince, Date.now()))}
						</span>
					)}
					<button
						type="button"
						onClick={() => onResume(call.meetingId)}
						aria-label={t("heldCallChips.resume", { name: call.name })}
						className="inline-flex h-7 w-7 items-center justify-center rounded-full"
						style={{ background: "var(--role-success-fill, var(--success))", color: "var(--role-success-on, var(--on-fill, var(--esp-immersive-on-ink)))" }}
					>
						<Play aria-hidden="true" className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={() => onHangUp(call.meetingId)}
						aria-label={t("heldCallChips.hangUp", { name: call.name })}
						className="inline-flex h-7 w-7 items-center justify-center rounded-full"
						style={{
							background: "var(--role-danger-fill, var(--destructive))",
							color: "var(--role-danger-on, var(--destructive-foreground))",
						}}
					>
						<PhoneOff aria-hidden="true" className="h-3.5 w-3.5" />
					</button>
				</span>
			))}
		</div>
	)
}
