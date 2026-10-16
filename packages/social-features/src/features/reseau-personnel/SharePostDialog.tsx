// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/SharePostDialog.tsx @ ad2e7fdc2 — adaptations : partage par `posts.posts.publish` du moteur, avec le réseau courant (`useNetwork().networkId`) ; identifiant `Id<"posts">` ; audiences par leurs clés (`shared.ts`) ; libellés et toasts par l'i18n (clés `reseau:sharePostDialog.*`) ; refus du moteur dit par son code (`postEngineErrorText`) ; voile par le jeton `--ui2-scrim` au lieu d'une couleur littérale.
"use client"

/**
 * Partager une publication — avec un mot, ou sans.
 *
 * ⚠️ Un partage RÉEXPOSE. La boîte le DIT plutôt que de le laisser découvrir :
 * le choix d'audience du partage est le sien, et il ne peut pas être plus
 * fermé que ce qui est déjà ouvert à tout le réseau (seul le `public` se
 * partage — le serveur refuse le reste, et le bouton n'apparaît pas ailleurs).
 *
 * Un partage n'embarque JAMAIS ses propres médias : il montre ceux de
 * l'original. Il n'y a donc pas de sélecteur de fichiers ici, et c'est une
 * règle du domaine, pas un oubli.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN PORTAIL (2026-08-05)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cette boîte est montée depuis `PostCard`, donc DANS la grille du fil. Or le
 * fil déclare `container-type: inline-size` pour mesurer sa largeur réelle, et
 * `container-type` implique `contain: layout` : l'élément devient alors bloc
 * conteneur pour ses descendants en `position: fixed`. Sans portail, ce voile
 * ne couvrirait plus le viewport mais la grille, et il DÉFILERAIT avec la page.
 *
 * Le portail vers `document.body` sort la boîte de ce confinement. Il rend
 * aussi l'inertage de `useModalA11y` exact : le hook épargne l'enfant de
 * `<body>` qui contient le dialogue, ce qui suppose précisément que le
 * dialogue soit un enfant de `<body>`.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import { Button, Card, Field, Select, TextArea, useModalA11y } from "@antsia/ui"
import { useMutation } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { postEngineErrorText } from "./post-overflow"
import {
  AUDIENCE_OPTIONS,
  DEFAULT_AUDIENCE,
  POST_MAX_LENGTH,
  shareExcerpt,
  type ReachAudience,
} from "./shared"

interface SharePostDialogProps {
  postId: Id<"posts">
  authorName: string
  excerpt: string
  onClose: () => void
}

/**
 * Enveloppe : décide OÙ le dialogue est rendu, et rien d'autre.
 *
 * ⚠️ Le contenu vit dans un composant SÉPARÉ, et ce n'est pas de la
 * décoration. `useModalA11y` s'exécute une seule fois au montage (deps `[]`) :
 * appelé ici, il tournerait au premier rendu, alors que `mounted` est encore
 * faux et que le portail n'existe pas — sa ref serait nulle, il sortirait sans
 * rien faire, et ne se rejouerait jamais. En montant le contenu APRÈS le
 * portail, son montage à lui coïncide avec l'existence du nœud.
 */
export function SharePostDialog(props: SharePostDialogProps) {
  /**
   * `createPortal` a besoin du DOM. Le rendu serveur n'en a pas, et rendre
   * autre chose au premier passage client provoquerait un désaccord
   * d'hydratation : on ne rend donc RIEN tant qu'on n'est pas monté.
   */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(<SharePostDialogContent {...props} />, document.body)
}

function SharePostDialogContent({
  postId,
  authorName,
  excerpt,
  onClose,
}: SharePostDialogProps) {
  const { t } = useTranslation("reseau")
  const { networkId } = useNetwork()
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<ReachAudience>(DEFAULT_AUDIENCE)
  const [sending, setSending] = useState(false)
  const overlay = useRef<HTMLDivElement>(null)

  const publish = useMutation(api.modules.posts.posts.publish)

  /**
   * Échap, focus initial, PIÈGE de focus, inertage du reste de la page et
   * restitution du focus au bouton déclencheur — le tout par le hook partagé.
   *
   * Écrit à la main jusqu'au 2026-08-05, il ne faisait que les deux premiers :
   * la tabulation s'échappait derrière le voile, où rien n'était atteignable à
   * la souris. Une boîte modale qu'on peut quitter au clavier sans la fermer
   * n'est pas modale.
   */
  useModalA11y({ containerRef: overlay, onClose })

  const handleShare = async () => {
    setSending(true)
    try {
      await publish({ networkId, body: body.trim(), audience, sharedPostId: postId })
      toast.success(t("sharePostDialog.toast.shared"))
      onClose()
    } catch (error) {
      toast.error(postEngineErrorText(error, "reseau:sharePostDialog.toast.failed", t))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      ref={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t("sharePostDialog.title", { name: authorName })}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "var(--ui2-scrim)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div style={{ width: "min(560px, 100%)", outline: "none" }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "var(--ink-900)" }}>
              {t("sharePostDialog.title", { name: authorName })}
            </h2>

            <p
              style={{
                margin: 0,
                padding: 12,
                borderLeft: "3px solid var(--ink-200)",
                fontSize: 13,
                color: "var(--ink-700)",
                overflowWrap: "anywhere",
              }}
            >
              {shareExcerpt(excerpt, t)}
            </p>

            <Field label={t("sharePostDialog.wordLabel")} htmlFor="partage-mot">
              <TextArea
                id="partage-mot"
                rows={3}
                value={body}
                maxLength={POST_MAX_LENGTH}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t("sharePostDialog.wordPlaceholder")}
              />
            </Field>

            <Field
              label={t("sharePostDialog.audienceLabel")}
              hint={t("sharePostDialog.audienceHint")}
              htmlFor="partage-audience"
            >
              <Select
                id="partage-audience"
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as ReachAudience)
                }
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </Select>
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={onClose}>
                {t("sharePostDialog.cancel")}
              </Button>
              <Button
                icon="share"
                disabled={sending}
                onClick={() => void handleShare()}
              >
                {sending ? t("sharePostDialog.sending") : t("sharePostDialog.share")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
