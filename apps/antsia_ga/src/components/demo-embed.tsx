"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { DEMO_READY_MESSAGE_TYPE, demoEmbedOrigin, demoParentOrigin } from "@/lib/demo-embed"
import { routes } from "@/lib/routes"

const READY_TIMEOUT_MS = 15_000
const actionClassName = "inline-flex min-h-11 items-center justify-center rounded-[var(--ui2-button-radius)] border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Le cadre peut naviguer dans sa propre application ; il n'accède pas à la session du parent. */
function EmbeddedDemo({ origin }: { origin: string }) {
  const { t } = useTranslation("antsia")
  const frame = useRef<HTMLIFrameElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "delayed">("loading")

  useEffect(() => {
    const timeout = window.setTimeout(() => setStatus("delayed"), READY_TIMEOUT_MS)
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== origin || !frame.current?.contentWindow || event.source !== frame.current.contentWindow) return
      const payload = event.data
      if (typeof payload !== "object" || payload === null || Array.isArray(payload) || Object.keys(payload).length !== 1 || !("type" in payload) || payload.type !== DEMO_READY_MESSAGE_TYPE) return
      window.clearTimeout(timeout)
      setStatus("ready")
    }
    window.addEventListener("message", onMessage)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("message", onMessage)
    }
  }, [origin, attempt])

  return (
    <>
      {status !== "ready" ? (
        <div role="status" aria-live="polite" className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          <p>{t(status === "loading" ? "demoIntegration.loading" : "demoIntegration.delayed")}</p>
          {status === "delayed" ? <button type="button" className={actionClassName} onClick={() => { setStatus("loading"); setAttempt((value) => value + 1) }}>{t("demoIntegration.retry")}</button> : null}
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1">
        <iframe
          key={attempt}
          ref={frame}
          src={new URL(routes.signIn(), origin).href}
          title={t("demoIntegration.frameTitle")}
          sandbox="allow-same-origin allow-scripts allow-forms"
          referrerPolicy="no-referrer"
          className="block size-full border-0 bg-background"
        />
      </div>
    </>
  )
}

/** Coque publique hors SessionProviders : son retour conserve le compte ANTSIA réel. */
export function DemoEmbedScreen({ origin }: { origin: string | null }) {
  const { t } = useTranslation("antsia")
  return (
    <main id="contenu" tabIndex={-1} className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background text-foreground focus-visible:outline-none">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h1 className="text-base font-bold">{t("demoIntegration.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("demoIntegration.lead")}</p>
        </div>
        <Link href={routes.home()} prefetch={false} className={`${actionClassName} shrink-0 self-start sm:self-auto`}>{t("demoIntegration.back")}</Link>
      </header>
      {origin ? <EmbeddedDemo key={origin} origin={origin} /> : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8">
          <p role="status" className="max-w-lg text-center text-sm text-muted-foreground">{t("demoIntegration.unavailable")}</p>
        </div>
      )}
    </main>
  )
}

/** Seul le signal de disponibilité sort de la démo, vers l'origine explicitement approuvée. */
export function DemoEmbedBridge() {
  useEffect(() => {
    const parentOrigin = demoParentOrigin()
    if (!parentOrigin || window.parent === window) return
    window.parent.postMessage({ type: DEMO_READY_MESSAGE_TYPE }, parentOrigin)
  }, [])
  return null
}

/** Lien facultatif de l'entrée publique ; il ne démarre aucun client de session. */
export function DemoEntryLink() {
  const { t } = useTranslation("antsia")
  if (!demoEmbedOrigin()) return null
  return <Link href={routes.demo()} prefetch={false} className={actionClassName}>{t("demoIntegration.entry")}</Link>
}
