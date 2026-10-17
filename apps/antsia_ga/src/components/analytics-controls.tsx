"use client"

import { api } from "@convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { usageConfiguration, useUsagePermission } from "./analytics-permission"
import { Button, Card } from "./shared/controls"

/** Facultatif, global, jamais précoché ni déduit de l'adhésion à un réseau. */
export function AnalyticsControls() {
  const { t } = useTranslation("antsia")
  const person = useQuery(api.modules.people.persons.getMyPerson, {})
  const grant = useMutation(api.modules.people.consents.recordConsent)
  const revoke = useMutation(api.modules.people.consents.revokeConsent)
  const permission = useUsagePermission()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<"grant" | "revoke" | null>(null)
  const consented = person?.consentsInForce.includes("usage_analytics") === true
  const enabled = consented && !permission.paused && usageConfiguration !== null

  async function changeConsent(allow: boolean) {
    if (pending) return
    if (!allow) permission.pause()
    setPending(true)
    setFailed(null)
    try {
      if (allow) {
        await grant({ purpose: "usage_analytics", origin: "settings" })
        permission.resume()
      } else await revoke({ purpose: "usage_analytics" })
      toast.success(t(allow ? "analytics.granted" : "analytics.revoked"))
    } catch {
      setFailed(allow ? "grant" : "revoke")
      toast.error(t(allow ? "analytics.grantFailed" : "analytics.revokeFailed"))
    } finally { setPending(false) }
  }

  return <Card>
    <h2 className="text-xl font-semibold">{t("analytics.title")}</h2>
    <p className="my-3 text-sm text-muted-foreground">{t("analytics.lead")}</p>
    <p role="status" className="mb-3 text-sm">{t(enabled ? "analytics.active" : "analytics.inactive")}</p>
    {!usageConfiguration ? <p className="mb-3 text-sm text-muted-foreground">{t("analytics.unconfigured")}</p> : null}
    {failed ? <p role="alert" className="mb-3 text-sm text-destructive">{t(failed === "revoke" ? "analytics.revokeFailed" : "analytics.grantFailed")}</p> : null}
    <Button variant="outline" pending={pending} disabled={!person || (!consented && !usageConfiguration)} onClick={() => void changeConsent(!consented)}>
      {t(consented ? "analytics.revoke" : "analytics.grant")}
    </Button>
  </Card>
}
