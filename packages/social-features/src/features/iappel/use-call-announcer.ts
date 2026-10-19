"use client"

/**
 * La région vivante PERSISTANTE des appels entrants (P18b, A05).
 *
 * La bannière du bureau ne vole pas le focus — à raison — et promettait une
 * annonce par région vivante qui n'existait pas : elle n'était qu'un
 * `role="group"`. L'annonce passe désormais par UNE région polie, créée une
 * fois au montage de l'hôte d'appel (enfant direct de `<body>`) : une région
 * qui naît avec son texte n'est pas toujours lue, une région qui existe déjà
 * l'est.
 *
 * ⚠️ La région est EXEMPTÉE de l'inertage des modales : un appel entrant est
 * la couche la plus haute (03 §6) et doit s'entendre même quand un dialogue
 * est ouvert. Un `inert` posé sur elle par `useModalA11y` est aussitôt levé.
 *
 * Elle ne dit que ce que l'écran montre : qui appelle (et le groupe, pour un
 * appel de groupe). Le texte est vidé quand plus rien ne sonne, de sorte que
 * le même appelant, rappelant plus tard, soit annoncé de nouveau.
 */
import { useEffect, useRef } from "react"

/** Attribut de la région d'annonce des appels (lu par les tests et la recette). */
export const CALL_ANNOUNCER_ATTRIBUTE = "data-call-announcer"

export function useCallAnnouncer(message: string | null): void {
	const regionRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		const region = document.createElement("div")
		region.setAttribute(CALL_ANNOUNCER_ATTRIBUTE, "")
		region.setAttribute("role", "status")
		region.setAttribute("aria-live", "polite")
		region.setAttribute("aria-atomic", "true")
		region.className = "sr-only"
		document.body.appendChild(region)
		const observer = new MutationObserver(() => {
			if (region.hasAttribute("inert")) region.removeAttribute("inert")
		})
		observer.observe(region, { attributes: true, attributeFilter: ["inert"] })
		regionRef.current = region
		return () => {
			observer.disconnect()
			region.remove()
			regionRef.current = null
		}
	}, [])

	useEffect(() => {
		const region = regionRef.current
		if (region === null) return
		region.textContent = message ?? ""
	}, [message])
}
