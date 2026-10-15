// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReseauQueryError.tsx @ ad2e7fdc2 — adaptations : primitives de `@antia/ui` ; libellé « Réessayer » par l'i18n (`reseau:reseauQueryError.retry`) ; déplacé dans la coque (`shell/`) ; contrat des props inchangé (titre et message déjà traduits par l'appelant).
"use client"

import { Alert, Button } from "@antia/ui"
import { useTranslation } from "react-i18next"

/** État d'échec partagé : une panne ne se présente jamais comme une liste vide. */
export function ReseauQueryError({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation("reseau")
  return (
    <Alert tone="danger" title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0 }}>{message}</p>
        <div>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("reseauQueryError.retry")}
          </Button>
        </div>
      </div>
    </Alert>
  )
}
