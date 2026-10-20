"use client"
import { useSsoNavigate } from "@antsia/api/use-sso-navigate"
import { api } from "@convex/_generated/api"
import { useQuery } from "convex/react"
import { ShieldCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import Link from "next/link"

import { useMemberSession } from "./network-shell"
import { Button } from "./shared/controls"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"
import { resumeSessionBridge, rotateSessionBridgeFence } from "@/lib/session-bridge-client"

/** Identité et passage entre applications, ouverts par un contrôle explicite. */
export function IdentityTools() {
  const { t } = useTranslation("antsia")
  const { t: tPublic } = useTranslation("publicNetwork")
  const { person } = useMemberSession()
  const configuration = useQuery(api.modules.platform.authentication.configuration, {})
  const [open, setOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const linkRequest = useRef<AbortController | null>(null)
  const panelId = useId()

  useEffect(() => () => { linkRequest.current?.abort() }, [])
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>("button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled)")?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setOpen(false)
      container.current?.querySelector<HTMLButtonElement>("button")?.focus()
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false)
    }
    const leave = (event: FocusEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("keydown", close)
    document.addEventListener("pointerdown", outside)
    document.addEventListener("focusin", leave)
    return () => {
      document.removeEventListener("keydown", close)
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("focusin", leave)
    }
  }, [open])
  const sso = useSsoNavigate({ authClient, isAuthenticated: true, allowedOrigins: configuration?.trustedOrigins ?? [] })
  const verified = person.badges.includes("verified")

  return (
    <div ref={container} className="relative">
      {/* Une icône de l'en-tête : un rond gris dans les thèmes ANTSIA (ADR-0027), comme la
          cloche et le bouton clair/sombre ; la facture fantôme d'origine en repli. */}
      <Button variant="ghost" className="min-w-11 px-0 rounded-[var(--esp-header-icon-radius,var(--ui2-button-radius,var(--radius-lg)))] bg-[var(--esp-header-icon-bg,transparent)]" aria-label={t("identity.title")} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <ShieldCheck aria-hidden="true" className="size-4" />
      </Button>
      {open ? (
        <section id={panelId} ref={panel} aria-label={t("identity.title")} className="absolute right-0 top-full z-40 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
          {!verified ? <>
            <p className="text-sm">{t("identity.lead")}</p>
            <Button pending={linking} disabled={!configuration?.idn || linking} onClick={async () => {
              if (linkRequest.current) return
              const controller = new AbortController()
              linkRequest.current = controller
              setLinking(true)
              let timer: ReturnType<typeof setTimeout> | undefined
              try {
                rotateSessionBridgeFence()
                const result = await Promise.race([
                  authClient.oauth2.link({ providerId: "idn", callbackURL: routes.feed(), fetchOptions: { signal: controller.signal } }),
                  new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")) }, 10_000)
                  }),
                ])
                if (result.error) toast.error(t("identity.handoffFailed"))
              } catch { toast.error(t("identity.handoffFailed")) }
              finally {
                if (timer) clearTimeout(timer)
                linkRequest.current = null
                setLinking(false)
              }
            }}>{linking ? t("identity.pending") : t("identity.verify")}</Button>
            {!configuration?.idn ? <p className="text-xs text-muted-foreground">{t("identity.unavailable")}</p> : null}
          </> : null}
          <Link href={routes.personalControls()} className="rounded-lg p-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{t("personal.title")}</Link>
          <p className="text-sm font-medium">{t("identity.applications")}</p>
          {configuration?.applications.filter((app) => app.key !== "antsia_ga").map((app) => (
            <Button key={app.key} variant="ghost" disabled={sso.pending} onClick={async () => {
              try {
              rotateSessionBridgeFence()
              const result = await sso.navigateExternal(routes.application(app.origin))
              if (result.kind === "refused") toast.error(t("identity.handoffFailed"))
              } catch { toast.error(t("identity.handoffFailed")) }
            }}>{t(`identity.${app.key}`)}</Button>
          ))}
          <Button variant="outline" onClick={() => { try { resumeSessionBridge() } catch { toast.error(t("identity.handoffFailed")) } }}>{tPublic("session.resume")}</Button>
        </section>
      ) : null}
    </div>
  )
}
