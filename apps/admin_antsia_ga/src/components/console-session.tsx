"use client"

import { api } from "@antsia/api/engine"
import { Button } from "@antsia/ui"
import { useConvexAuth, useQuery } from "convex/react"
import Link from "next/link"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { CONVEX_URL } from "@/components/providers"
import { routes } from "@/lib/routes"
import { signOutAndRedirect } from "@/lib/sign-out"

function ConnectedSession() {
  const { t } = useTranslation("admin")
  const { isAuthenticated, isLoading } = useConvexAuth()
  const person = useQuery(api.modules.people.persons.getMyPerson, isAuthenticated ? {} : "skip")
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const connected = isAuthenticated && person != null
  if (isLoading || (isAuthenticated && person === undefined)) return <p role="status">{t("session.loading")}</p>
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p role="status">{connected ? t("session.connected") : t("session.signedOut")}</p>
      <p className="text-sm text-muted-foreground">{t("session.noAuthority")}</p>
      {connected ? (
        <Button disabled={pending} aria-busy={pending || undefined} style={{ alignSelf: "flex-start", minHeight: 44 }} onClick={async () => {
          if (pendingRef.current) return
          pendingRef.current = true
          setPending(true)
          await signOutAndRedirect()
        }}>{pending ? t("session.signingOut") : t("session.signOut")}</Button>
      ) : <Link className="self-start underline" href={routes.signIn()}>{t("session.signIn")}</Link>}
    </section>
  )
}

export function ConsoleSession() {
  const { t } = useTranslation("admin")
  return CONVEX_URL ? <ConnectedSession /> : <p role="alert" className="rounded-xl bg-card p-4">{t("session.backendMissing")}</p>
}
