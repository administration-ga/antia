// Réécrit d'après socle/packages/agent-features/src/features/reseau-personnel/PageFollowButton.tsx @ ad2e7fdc2 — ce qui change : mutations `pages.pages.follow` (par l'adresse) et `pages.pages.unfollow` (par l'identifiant) du moteur, dans le réseau courant (`useNetwork`) ; identifiant `Id<"pages">` ; libellé et refus traduits (`followLabel(following, t)`, refus lu dans le CODE du moteur par `followActionErrorMessage(err, t)`) ; styles de surface lus dans la coque (`shell/design-styles`) ; props inchangés.
"use client"

/**
 * Le bouton de suivi d'une page — « Suivre » ou « Suivi ».
 *
 * Aucun état optimiste : `following` est un prop CONTRÔLÉ par l'appelant (la
 * requête qui l'a chargé), jamais recopié en état local avancé par
 * anticipation — seul `disabled` bouge pendant l'appel. Le libellé et
 * `aria-pressed` ne changent qu'une fois la réponse du serveur reçue, ET la
 * requête réactive rafraîchie.
 *
 * Le message d'échec est celui que le CODE du serveur désigne
 * (`followActionErrorMessage`), jamais une phrase générique qui masquerait la
 * vraie raison d'un refus (débit, adhésion, page devenue illisible).
 */

import { api, type Id } from "@antia/api/engine"
import { useNetwork } from "@antia/api/network"
import { Button } from "@antia/ui"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { RESEAU_PILL_ACTION_STYLE } from "../../shell/design-styles"
import { followActionErrorMessage, followLabel } from "./pages-panel"

const FOLLOW_BUTTON_STYLE = {
  ...RESEAU_PILL_ACTION_STYLE,
  padding: "6px 10px",
  minHeight: 44,
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--primary-600)",
} as const

export interface PageFollowButtonProps {
  pageId: Id<"pages">
  /** Requis par `pages.follow`, qui n'admet que l'adresse publique. */
  handle: string
  following: boolean
  /** Notifié APRÈS la réponse du serveur, jamais avant : le parent peut s'en
   *  servir pour retirer une page d'un rail de suggestions, par exemple. */
  onFollowChange?: (following: boolean) => void
}

export function PageFollowButton({ pageId, handle, following, onFollowChange }: PageFollowButtonProps) {
  const { t } = useTranslation("reseau")
  const { networkId } = useNetwork()
  const follow = useMutation(api.modules.pages.pages.follow)
  const unfollow = useMutation(api.modules.pages.pages.unfollow)
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      if (following) {
        await unfollow({ networkId, pageId })
        onFollowChange?.(false)
      } else {
        await follow({ networkId, handle })
        onFollowChange?.(true)
      }
    } catch (err) {
      toast.error(followActionErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-pressed={following}
      disabled={busy}
      onClick={() => void handleClick()}
      style={FOLLOW_BUTTON_STYLE}
    >
      {followLabel(following, t)}
    </Button>
  )
}
