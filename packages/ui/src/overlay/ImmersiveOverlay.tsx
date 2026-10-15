// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ImmersiveOverlay.tsx @ ad2e7fdc2 — adaptations : charte par défaut lue sur `<html data-charte>` (la charte de l'application du réseau) au lieu de la constante « espace-personnel » ; `useModalA11y` importé du module voisin du paquet ; commentaires iAsted et sélecteur de développement conservés comme repères de pile.
"use client"

/**
 * ImmersiveOverlay — une surface qui prend l'écran ENTIER, au-dessus de tout.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE PORTAIL EST UN PRÉREQUIS, PAS UNE PRÉCAUTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `.rp-scope` déclare `container-type: inline-size` pour mesurer sa largeur
 * réelle, et `container-type` implique `contain: layout` : le nœud devient bloc
 * conteneur pour ses descendants en `position: fixed`. Rendu à l'intérieur, ce
 * voile ne couvrirait pas le viewport mais la grille du fil, et il DÉFILERAIT
 * avec elle. C'est exactement ce que documentent `ReseauAgentPage.tsx:53-56` et
 * l'en-tête de `SharePostDialog` — même cause, même remède.
 *
 * Le portail vers `<body>` rend aussi l'inertage de `useModalA11y` exact : le
 * hook épargne l'enfant de `<body>` qui CONTIENT le dialogue, ce qui suppose
 * précisément que le dialogue soit un enfant de `<body>`.
 *
 * ── Ce que la surface tient, et pourquoi ─────────────────────────────────
 *  · `height: var(--vv-height, 100dvh)` — la hauteur VISIBLE, clavier compris
 *    (`useVisualViewport`). `100dvh` seul placerait le composeur derrière le
 *    clavier sur iOS.
 *  · `overscroll-behavior: contain` — sans lui, arriver en bout de liste
 *    transmet le geste à la page dessous, qui défile en silence.
 *  · les deux `env(safe-area-inset-*)` — l'encoche en haut, la barre gestuelle
 *    en bas. Elles ne valent que si l'app déclare `viewportFit: "cover"`.
 *  · `useBodyScrollLock` — la page dessous ne bouge plus, et retrouve sa
 *    position exacte à la fermeture.
 *
 * ⚠️ Le contenu vit dans un composant SÉPARÉ, comme dans `SharePostDialog`, et
 * ce n'est pas de la décoration : `useModalA11y` s'exécute une seule fois au
 * montage (deps `[]`). Appelé dans l'enveloppe, il tournerait au premier rendu,
 * alors que le portail n'existe pas encore — sa ref serait nulle, il sortirait
 * sans rien faire, et ne se rejouerait jamais.
 */

import { useModalA11y } from "../hooks/use-modal-a11y"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useBodyScrollLock } from "./useBodyScrollLock"
import { useVisualViewport } from "./useVisualViewport"

export interface ImmersiveOverlayProps {
	open: boolean
	onClose: () => void
	/** Nom accessible de la surface — un `dialog` sans nom ne s'annonce pas. */
	label: string
	children: ReactNode
	/**
	 * Voile sombre derrière la surface. `false` (défaut) quand la surface est
	 * elle-même opaque et pleine page : un voile invisible ne serait qu'un
	 * nœud de plus.
	 */
	scrim?: boolean
	/**
	 * La charte posée sur le conteneur portalé (voir le commentaire du
	 * `data-charte` ci-dessous). Par défaut, celle de l'APPLICATION — lue sur
	 * `<html data-charte>` au montage : une surface flottante porte la charte
	 * du réseau où elle s'ouvre, jamais une charte écrite ici.
	 */
	charte?: string
	/**
	 * La COUCHE d'empilement, quand `z-60` ne suffit pas.
	 *
	 * Défaut `z-[60]` : au-dessus des barres mobiles (30/40) et de la sphère
	 * iAsted intégrée (50) — le bon niveau pour une story ou une feuille.
	 *
	 * L'APPEL, lui, doit passer au-dessus de TOUT, y compris de la sphère
	 * iAsted flottante (9999) et du sélecteur de comptes de développement
	 * (10000) : sans cela, l'un ou l'autre vole le clic sur « Décrocher », et
	 * le geste le plus urgent de la plateforme est le seul à ne pas répondre.
	 * La couche d'appel passe donc `iappel-layer` (10010, déclarée dans
	 * `globals.css` à côté des autres surfaces d'appel).
	 */
	layerClassName?: string
}

export function ImmersiveOverlay({
	open,
	onClose,
	label,
	children,
	scrim = false,
	charte,
	layerClassName = "z-[60]",
}: ImmersiveOverlayProps) {
	/**
	 * `createPortal` a besoin du DOM. Le rendu serveur n'en a pas, et rendre
	 * autre chose au premier passage client provoquerait un désaccord
	 * d'hydratation : on ne rend donc RIEN tant qu'on n'est pas monté.
	 */
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	if (!open || !mounted) return null
	return createPortal(
		<ImmersiveOverlayContent
			onClose={onClose}
			label={label}
			scrim={scrim}
			charte={charte}
			layerClassName={layerClassName}
		>
			{children}
		</ImmersiveOverlayContent>,
		document.body,
	)
}

function ImmersiveOverlayContent({
	onClose,
	label,
	children,
	scrim,
	charte,
	layerClassName,
}: Omit<ImmersiveOverlayProps, "open"> & {
	scrim: boolean
	layerClassName: string
}) {
	const container = useRef<HTMLDivElement>(null)
	// Le contenu n'est rendu qu'après le montage (portail) : le DOM existe.
	const resolvedCharte = charte ?? document.documentElement.getAttribute("data-charte") ?? undefined

	useVisualViewport()
	useBodyScrollLock(true)
	/**
	 * Échap, focus initial, PIÈGE de focus, inertage du reste de la page et
	 * restitution du focus au déclencheur — le tout par le hook partagé
	 * d'ui-v2. Sa signature convient telle quelle : `containerRef` + `onClose`.
	 *
	 * ⚠️ Le conteneur porte `tabIndex={-1}` : sans lui, une surface dont le
	 * premier focusable est loin (ou absente de focusable, le temps d'un
	 * chargement) laisserait le focus sur le bouton déclencheur, DERRIÈRE
	 * l'inertage — plus rien ne répondrait au clavier.
	 */
	useModalA11y({ containerRef: container, onClose })

	return (
		<div
			ref={container}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			// La charte de l'espace est SCOPÉE à un nœud (`data-charte`) : portalé
			// vers `body`, ce conteneur en sort, et `var(--background)` y résoudrait
			// les jetons institutionnels — surface bleu nuit au milieu d'un espace
			// parchemin. On re-déclare donc ICI la charte de l'application
			// appelante (celle de `<html>`, sauf charte passée explicitement).
			data-charte={resolvedCharte}
			tabIndex={-1}
			className={
				scrim
					? `esp-immersive-scrim fixed inset-0 ${layerClassName} flex flex-col`
					: `fixed inset-0 ${layerClassName} flex flex-col`
			}
			style={{
				// La hauteur VISIBLE, clavier compris. Repli `100dvh` quand
				// `visualViewport` manque — cf. `useVisualViewport`.
				height: "var(--vv-height, 100dvh)",
				background: scrim ? undefined : "var(--background)",
				color: "var(--foreground)",
				paddingTop: "env(safe-area-inset-top, 0px)",
				paddingBottom: "env(safe-area-inset-bottom, 0px)",
				overscrollBehavior: "contain",
				outline: "none",
			}}
		>
			{children}
		</div>
	)
}
