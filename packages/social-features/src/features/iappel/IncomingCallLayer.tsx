"use client"

/**
 * IncomingCallLayer — la couche plein écran de l'appel entrant AU TÉLÉPHONE,
 * devenue modale (P18b, A05).
 *
 * L'écran d'appel entrant couvre tout le téléphone : c'était pourtant un simple
 * `<div className="iappel-layer fixed inset-0">`, sans dialogue ni focus ni
 * inertage. Le focus clavier pouvait rester DESSOUS, et une modale déjà
 * ouverte (commentaires, partage…) rendait la carte inerte — impossible à
 * décrocher.
 *
 * La couche garde sa construction visuelle (mêmes classes, même plein écran)
 * et devient :
 *  · un portail vers `<body>` — enfant monté APRÈS une éventuelle modale, il
 *    n'est pas inerte, et c'est lui qui rend le reste inerte ;
 *  · un `role="dialog" aria-modal="true"` nommé « Appel entrant de X » ;
 *  · le focus sur « Répondre » à l'apparition (la décision principale), le
 *    piège de Tab, et le focus rendu à son origine à la fin de la sonnerie ;
 *  · Échap SANS effet : Échap ne refuse jamais un appel (une frappe
 *    malheureuse ne doit pas raccrocher au nez de quelqu'un), et il n'y a rien
 *    d'autre à fermer.
 *
 * Le bureau n'est pas concerné : sa bannière ne vole pas le focus, l'annonce y
 * passe par la région persistante de l'hôte (`useCallAnnouncer`).
 */
import { useModalA11y } from "@antsia/ui"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Le bouton « Répondre » de la carte : la commande d'appel de ton `answer`. */
const ANSWER_CONTROL = ".iappel-ctl[data-tone='answer']"

export function IncomingCallLayer({ label, children }: { label: string; children: ReactNode }) {
	// Le portail a besoin du DOM : rien au rendu serveur ni au premier passage.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	if (!mounted) return null
	return createPortal(<IncomingCallLayerContent label={label}>{children}</IncomingCallLayerContent>, document.body)
}

/**
 * Le contenu vit dans un composant SÉPARÉ : `useModalA11y` ne s'installe
 * qu'une fois, au montage — il doit trouver le portail déjà rendu.
 */
function IncomingCallLayerContent({ label, children }: { label: string; children: ReactNode }) {
	const layerRef = useRef<HTMLDivElement>(null)
	const answerRef = useRef<HTMLElement | null>(null)
	// Effet de MISE EN PAGE : il court avant l'effet du hook, qui lit alors
	// « Répondre » comme cible du focus initial.
	useLayoutEffect(() => {
		answerRef.current = layerRef.current?.querySelector<HTMLElement>(ANSWER_CONTROL)?.closest("button") ?? null
	}, [])
	useModalA11y({
		containerRef: layerRef,
		initialFocusRef: answerRef,
		// Échap ne refuse pas l'appel, et ne ferme rien.
		onClose: () => undefined,
	})
	return (
		<div
			ref={layerRef}
			className="iappel-layer fixed inset-0 outline-none"
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabIndex={-1}
		>
			{children}
		</div>
	)
}
