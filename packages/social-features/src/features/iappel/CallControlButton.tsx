// Dupliqué de socle/packages/agent-features/src/features/iappel/CallControlButton.tsx @ ad2e7fdc2 — adaptations : aucune hors provenance (libellés et raisons fournis traduits par l'appelant ; classes `.iappel-ctl` et jeton de scène fournis par la feuille d'appel de @antia/ui).
"use client"

/**
 * CallControlButton — le rond de commande de l'écran d'appel (micro, caméra,
 * haut-parleur, répondre, raccrocher…).
 *
 * Toute la couleur vient de la classe `.iappel-ctl` (feuille d'appel de
 * @antia/ui) pilotée par `data-tone` / `data-active` : ce composant ne
 * connaît AUCUNE couleur, il ne fait que poser les data-attributes qui la
 * déclenchent en CSS. C'est ce qui le distingue de son ancêtre
 * `DirectCallControl` (components/meetings/DirectCallView.tsx), qui portait
 * ses classes de couleur Tailwind au cas par cas selon l'état du bouton —
 * exactement ce que le cliquet de charte interdit désormais.
 */

import type { ComponentType } from "react"
import { toast } from "sonner"

export interface CallControlButtonProps {
	icon: ComponentType<{ className?: string }>
	/** Libellé VISIBLE sous l'icône, et nom accessible. */
	label: string
	/** Optionnel : une commande INDISPONIBLE n'a pas de geste à exécuter. */
	onClick?: () => void
	/** Bascule enfoncée (micro coupé, caméra allumée) → `aria-pressed`. */
	active?: boolean
	/** Rôle de la commande : décide de la couleur via `data-tone`. */
	tone?: "neutral" | "answer" | "hangup"
	disabled?: boolean
	/** Rend le bouton plus grand (répondre / raccrocher : 64 px). */
	size?: "md" | "lg"
	/**
	 * LA COMMANDE EXISTE, ELLE NE PEUT PAS AGIR — et elle dit pourquoi.
	 *
	 * ⚠️ À distinguer de `disabled` : ici le bouton reste FOCUSABLE et
	 * CLIQUABLE, et le tap énonce la raison (`toast.info`). C'est le seul
	 * régime honnête pour une commande que tout le monde cherche et que la
	 * plateforme ne sait pas honorer — « Haut-parleur » sur un iPhone, où la
	 * sortie se choisit dans le Centre de contrôle. La masquer envoie chercher
	 * une panne ; la désactiver sans un mot la fait passer pour une panne.
	 *
	 * La doctrine générale ne change pas pour autant : une commande SANS OBJET
	 * (une seule caméra, une seule sortie) se masque toujours — cf.
	 * `call-controls.ts`.
	 */
	unavailableReason?: string
	/**
	 * LA COMMANDE AGIT, MAIS SON PÉRIPHÉRIQUE EST BLOQUÉ — le micro refusé par
	 * le navigateur (recette du 22/09).
	 *
	 * À distinguer de `unavailableReason` : ici le tap GARDE son geste (il
	 * réessaie), parce qu'une permission rouverte dans la barre d'adresse se
	 * reprend sans recharger la page, donc sans perdre l'appel. La commande
	 * s'atténue comme une indisponible et porte sa raison au survol ; l'échec
	 * d'un nouvel essai se dit en toast.
	 */
	blockedReason?: string
}

export function CallControlButton({
	icon: Icon,
	label,
	onClick,
	active,
	tone = "neutral",
	disabled = false,
	size = "md",
	unavailableReason,
	blockedReason,
}: CallControlButtonProps) {
	const unavailable =
		typeof unavailableReason === "string" && unavailableReason.length > 0
	const blocked =
		!unavailable && typeof blockedReason === "string" && blockedReason.length > 0
	return (
		<button
			type="button"
			onClick={
				unavailable ? () => toast.info(unavailableReason) : onClick
			}
			disabled={disabled}
			aria-label={label}
			// `aria-disabled` SANS `disabled` : le bouton reste atteignable au
			// clavier et au doigt — c'est ce qui permet d'en obtenir la raison.
			aria-disabled={unavailable ? true : undefined}
			title={unavailable ? unavailableReason : blocked ? blockedReason : undefined}
			// `aria-pressed` ne se pose que sur une VRAIE bascule. Le laisser
			// `undefined` quand `active` n'est pas fourni évite de transformer un
			// bouton simple (« Raccrocher ») en toggle qu'il n'est pas.
			aria-pressed={typeof active === "boolean" ? active : undefined}
			// La dimension ≥44px est déjà garantie par `.iappel-ctl` (56/64px) ;
			// `disabled:opacity-60` compense ici le fait que la pseudo-classe CSS
			// `.iappel-ctl:disabled` ne peut viser qu'un VRAI élément désactivable
			// (bouton, input…) — jamais le `<span>` qui porte cette classe.
			className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
		>
			<span
				className="iappel-ctl"
				data-tone={tone}
				data-active={active}
				// L'atténuation vit en CSS (`[data-unavailable="true"]`) : ce
				// composant ne connaît aucune couleur, pas même une opacité d'état.
				data-unavailable={unavailable ? "true" : undefined}
				// Bloqué : même atténuation, mais le tap réessaie (`blockedReason`).
				data-blocked={blocked ? "true" : undefined}
				// `.iappel-ctl` fixe 56 px par défaut ; seule la TAILLE change ici,
				// jamais la couleur — elle reste entièrement pilotée par le CSS.
				style={size === "lg" ? { width: 64, height: 64 } : undefined}
			>
				<Icon className={size === "lg" ? "h-7 w-7" : "h-6 w-6"} />
			</span>
			{/* `max-w` : la colonne d'une commande, c'est son rond (56/64 px) plus
			    quelques lettres. Un libellé long se replie sur deux lignes au lieu
			    d'élargir la colonne et de décaler toute la rangée. */}
			<span
				className="max-w-[4.75rem] text-center text-[11px] leading-tight font-medium break-words"
				style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.72 }}
			>
				{label}
			</span>
		</button>
	)
}
