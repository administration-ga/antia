"use client"

/**
 * La région des toasts, EXEMPTÉE de l'inertage des modales (P18b, A07).
 *
 * `useModalA11y` (`@antsia/ui`) rend inertes tous les enfants de `<body>` qui
 * ne contiennent pas le dialogue ouvert — dont, sans précaution, la région
 * polie de sonner, rendue sur place : les erreurs et confirmations émises
 * PENDANT une modale (commentaires, partage, composeur, actu, signalement)
 * n'étaient alors ni annoncées ni atteignables.
 *
 * La région vit donc dans SON hôte, enfant direct de `<body>`, que
 * l'application exempte explicitement : un `inert` posé sur cet hôte par une
 * modale est aussitôt levé. Rien d'autre n'est exempté — le contenu de la page
 * reste inerte derrière le dialogue, et la modale garde son piège de Tab.
 *
 * Rendu au client seulement (hôte créé au montage) : aucun désaccord
 * d'hydratation, la région n'ayant rien à rendre au serveur. Les toasts
 * gardent leur position fixe : l'hôte n'a aucune boîte visible.
 */
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Toaster, type ToasterProps } from "sonner"

/** Attribut de l'hôte de la région des toasts (lu par les tests et la recette). */
export const TOAST_REGION_ATTRIBUTE = "data-toast-region"

export function ToastRegion(props: ToasterProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const element = document.createElement("div")
    element.setAttribute(TOAST_REGION_ATTRIBUTE, "")
    document.body.appendChild(element)
    // L'exemption : une modale qui pose `inert` sur l'hôte le voit levé. Le
    // hook lève lui-même ce qu'il a posé à sa fermeture — retirer plus tôt ne
    // gêne pas ce retrait.
    const observer = new MutationObserver(() => {
      if (element.hasAttribute("inert")) element.removeAttribute("inert")
    })
    observer.observe(element, { attributes: true, attributeFilter: ["inert"] })
    setHost(element)
    return () => {
      observer.disconnect()
      element.remove()
    }
  }, [])

  return host === null ? null : createPortal(<Toaster {...props} />, host)
}
