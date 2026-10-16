"use client"

import { IdentityEntry } from "@antsia/social-features/identity"
import { api } from "@convex/_generated/api"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CenteredStatus } from "@/components/shared/controls"
import { useSessionState } from "@/components/use-session-state"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

/** Indice de développement local seulement ; le serveur décide s'il peut le rendre. */
function DevCodeHint({ identifier }: { identifier: string }) {
  const { t } = useTranslation("identity")
  const latest = useQuery(api.modules.platform.devTools.latestOtp, { email: identifier })
  if (!latest) return null
  return <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3 text-sm"><p className="font-mono text-base">{t("localCode", { code: latest.code })}</p><p className="text-xs text-muted-foreground">{t("localCodeHint")}</p></div>
}

export function SignInScreen() {
  const { t } = useTranslation("antsia")
  const { t: tIdentity } = useTranslation("identity")
  const router = useRouter()
  const session = useSessionState()
  const configuration = useQuery(api.modules.platform.authentication.configuration, {})
  const [signOutIncomplete, setSignOutIncomplete] = useState(false)

  useEffect(() => { setSignOutIncomplete(new URLSearchParams(window.location.search).get("deconnexion") === "incomplete") }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("deconnexion") === "incomplete") return
    if (session.status === "restricted") router.replace(routes.personalControls())
    else if (session.status === "member") router.replace(routes.feed())
    else if (session.status === "welcome") router.replace(routes.welcome())
  }, [session.status, router])

  if (session.status === "loading" || (!signOutIncomplete && (session.status === "restricted" || session.status === "member" || session.status === "welcome"))) return <CenteredStatus label={t("session.checking")} />

  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      {signOutIncomplete ? <p role="alert" className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm">{tIdentity("signOutIncomplete")}</p> : null}
      <IdentityEntry authClient={authClient} configuration={configuration} callbackURL={routes.welcome()} onAuthenticated={() => window.location.assign(routes.welcome())} renderLocalCode={(identifier) => <DevCodeHint identifier={identifier} />} />
    </main>
  )
}
