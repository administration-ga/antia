// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReportContentDialog.tsx @ ad2e7fdc2 — adaptations : motifs et borne de la précision lus dans le domaine du moteur (`CONTENT_REPORT_REASONS`, `CONTENT_REPORT_NOTE_MAX` de `@antia/social-domain/moderation`, type `ReportReason` = `ContentReportReason`) ; libellés par l'i18n (clés `reseau:reportContentDialog.*`, le motif par sa clé) ; voile et ombre par les jetons (`--ui2-scrim`, `--shadow-xl`) au lieu de couleurs littérales ; titre accordé (« Signaler cette publication » — le socle écrivait « ce publication ») ; un échec de transmission ne laisse plus de promesse rejetée sans lecteur (l’appelant le dit, la boîte reste ouverte).
"use client"

import { Button, TextArea } from "@antia/ui"
import { CONTENT_REPORT_NOTE_MAX, CONTENT_REPORT_REASONS, type ContentReportReason } from "@antia/social-domain/moderation"
import { useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

export type ReportReason = ContentReportReason

/** Les motifs, dans l'ordre du domaine — chacun avec la clé de son libellé. */
const REASONS: readonly { value: ReportReason; labelKey: string }[] = CONTENT_REPORT_REASONS.map((value) => ({
  value,
  labelKey: `reportContentDialog.reasons.${value}`,
}))

/** Dialogue unique pour publication et commentaire : le déclarant sait ce qui
 * sera transmis et le texte complémentaire reste strictement borné. */
export function ReportContentDialog({ kind, onClose, onSubmit }: {
  kind: "publication" | "commentaire"
  onClose: () => void
  onSubmit: (reason: ReportReason, note: string) => Promise<void>
}) {
  const { t } = useTranslation("reseau")
  const [reason, setReason] = useState<ReportReason>("harassment")
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const title = kind === "publication" ? t("reportContentDialog.title.publication") : t("reportContentDialog.title.commentaire")
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "var(--ui2-scrim)",
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setPending(true)
          // L'échec est DIT par l'appelant (toast) ; la boîte reste ouverte
          // pour un nouvel essai — la promesse rejetée est donc lue ici.
          void onSubmit(reason, note)
            .then(onClose, () => undefined)
            .finally(() => setPending(false))
        }}
        style={{
          width: "min(520px, 100%)",
          padding: 24,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
          color: "var(--foreground)",
          boxShadow: "var(--shadow-xl)",
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <p
            style={{
              margin: "6px 0 0",
              color: "var(--muted-foreground)",
              fontSize: 14,
            }}
          >
            {t("reportContentDialog.description")}
          </p>
        </div>
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          {t("reportContentDialog.reasonLabel")}
          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as ReportReason)
            }
            style={{
              minHeight: 40,
              border: "1px solid var(--input)",
              borderRadius: 8,
              background: "var(--card)",
              color: "var(--foreground)",
              padding: "0 10px",
            }}
          >
            {REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          {t("reportContentDialog.noteLabel")}
          <TextArea
            value={note}
            maxLength={CONTENT_REPORT_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            aria-label={t("reportContentDialog.noteAriaLabel")}
          />
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          >
            {t("reportContentDialog.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("reportContentDialog.submitting") : t("reportContentDialog.submit")}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
