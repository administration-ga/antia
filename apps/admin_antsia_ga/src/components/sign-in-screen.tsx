"use client"

import { api } from "@antsia/api/engine"
import { IdentityEntry } from "@antsia/social-features/identity"
import { useConvexAuth, useQuery } from "convex/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CONVEX_URL } from "@/components/providers"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

function DevCodeHint({ identifier }: { identifier: string }) {
  const { t } = useTranslation("identity")
  const code = useQuery(api.modules.platform.devTools.latestOtp, { email: identifier })
  return code ? <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-mono">{t("localCode", { code: code.code })}</p><p className="text-muted-foreground">{t("localCodeHint")}</p></div> : null
}

function ConnectedEntry({ signOutIncomplete }: { signOutIncomplete: boolean }) {
  const { t } = useTranslation("admin")
  const { isAuthenticated, isLoading } = useConvexAuth()
  const configuration = useQuery(api.modules.platform.authentication.configuration, {})
  useEffect(() => { if (isAuthenticated && new URLSearchParams(window.location.search).get("deconnexion") !== "incomplete") window.location.assign(routes.home()) }, [isAuthenticated])
  if (isLoading || (isAuthenticated && !signOutIncomplete)) return <p role="status">{t("session.loading")}</p>
  return <IdentityEntry authClient={authClient} configuration={configuration} callbackURL={routes.home()} onAuthenticated={() => window.location.assign(routes.home())} renderLocalCode={(identifier) => <DevCodeHint identifier={identifier} />} />
}

export function ConsoleSignInScreen() {
  const { t } = useTranslation("admin")
  const { t: tIdentity } = useTranslation("identity")
  const [signOutIncomplete, setSignOutIncomplete] = useState(false)
  useEffect(() => { setSignOutIncomplete(new URLSearchParams(window.location.search).get("deconnexion") === "incomplete") }, [])
  return <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12"><p className="text-sm text-muted-foreground">{t("session.noAuthority")}</p>{signOutIncomplete ? <p role="alert" className="rounded-lg border border-border bg-muted p-4 text-sm">{tIdentity("signOutIncomplete")}</p> : null}{CONVEX_URL ? <ConnectedEntry signOutIncomplete={signOutIncomplete} /> : <p role="alert">{t("session.backendMissing")}</p>}<Link className="text-sm underline" href={routes.home()}>{t("health.backHome")}</Link></main>
}
