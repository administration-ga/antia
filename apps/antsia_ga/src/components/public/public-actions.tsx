"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { signOutAndRedirect } from "@/lib/sign-out"

export function PublicRetryButton() {
  const { t } = useTranslation("publicNetwork")
  return <button className="min-h-11 rounded-lg border border-border bg-card px-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => window.location.reload()}>{t("states.retry")}</button>
}

export function PublicSignOutButton() {
  const { t } = useTranslation("publicNetwork")
  const [pending, setPending] = useState(false)
  return <button disabled={pending} aria-busy={pending || undefined} className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60" onClick={() => { setPending(true); void signOutAndRedirect() }}>{t(pending ? "nav.signingOut" : "nav.signOut")}</button>
}
