"use client"

import { IdentityEntry } from "@antsia/social-features/identity"
import { api } from "@convex/_generated/api"
import { useQuery } from "convex/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { DemoAccountsPanel } from "@/components/demo-accounts-panel"
import { buttonClassName, CenteredStatus } from "@/components/shared/controls"
import { useSessionState } from "@/components/use-session-state"
import { authClient } from "@/lib/auth-client"
import { browserAppPath } from "@/lib/app-path"
import { parsePublicPostContinuation } from "@/lib/public-post-continuation"
import { parseNotificationReference } from "@/lib/notification-open"
import { parseShopContactContinuation, type ShopContactContinuation } from "@/lib/shop-contact-continuation"
import { routes } from "@/lib/routes"
import { fencedIdentityEntryClient } from "@/lib/session-bridge-client"

const entryClient = fencedIdentityEntryClient(authClient)

/** Indice de développement local seulement ; le serveur décide s'il peut le rendre. */
function DevCodeHint({ identifier }: { identifier: string }) {
  const { t } = useTranslation("identity")
  const latest = useQuery(api.modules.platform.devTools.latestOtp, { email: identifier })
  if (!latest) return null
  return <div className="rounded-[var(--ui2-card-radius)] border border-dashed border-transparent bg-muted px-4 py-3 text-sm"><p className="font-mono text-base">{t("localCode", { code: latest.code })}</p><p className="text-xs text-muted-foreground">{t("localCodeHint")}</p></div>
}

/** Même porte sur l'accueil et /entrer ; le fournisseur garde toute l'autorité. */
export function SignInCard({ compact = false, intent = "sign-in", signOutIncomplete = false, publicPostId, notificationReference, shopContact }: {
  compact?: boolean
  intent?: "sign-in" | "sign-up"
  signOutIncomplete?: boolean
  publicPostId?: string
  notificationReference?: string
  shopContact?: ShopContactContinuation
}) {
  const { t } = useTranslation("antsia")
  const { t: tIdentity } = useTranslation("identity")
  const router = useRouter()
  const session = useSessionState()
  const configuration = useQuery(api.modules.platform.authentication.configuration, {})
  const signUp = intent === "sign-up"
  const continuationPostId = parsePublicPostContinuation(publicPostId)
  const notification = continuationPostId ? undefined : parseNotificationReference(notificationReference)
  const contact = continuationPostId || notification ? undefined : parseShopContactContinuation(shopContact)
  const destination = continuationPostId ? routes.memberPost(continuationPostId) : notification ? routes.openNotification(notification) : contact ? routes.shopContact(contact.handle, contact.offerRef) : routes.feed()

  useEffect(() => {
    if (signOutIncomplete) return
    if (session.status === "restricted") router.replace(routes.personalControls())
    else if (session.status === "member") router.replace(destination)
    else if (session.status === "welcome") router.replace(routes.welcome(continuationPostId, notification, contact))
  }, [session.status, signOutIncomplete, continuationPostId, notification, contact?.handle, contact?.offerRef, destination, router])

  if (session.status === "loading" || (!signOutIncomplete && (session.status === "restricted" || session.status === "member" || session.status === "welcome"))) return <CenteredStatus label={t("session.checking")} />

  return (
    <div className={compact ? "antsia-panel antsia-copy [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-[1.2]" : "antsia-copy"}>
      {signOutIncomplete ? <p role="alert" className="mb-6 rounded-[var(--ui2-card-radius)] border border-transparent bg-muted p-4 text-sm">{tIdentity("signOutIncomplete")}</p> : null}
      <IdentityEntry
        key={intent}
        authClient={entryClient}
        configuration={configuration}
        callbackURL={browserAppPath(routes.welcome(continuationPostId, notification, contact))}
        onAuthenticated={() => window.location.assign(browserAppPath(routes.welcome(continuationPostId, notification, contact)))}
        renderLocalCode={(identifier) => <DevCodeHint identifier={identifier} />}
        presentation={compact ? "compact" : "default"}
        headingLevel={compact ? 2 : 1}
        title={signUp ? t("access.signUpTitle") : compact ? t("access.signInTitle") : undefined}
        lead={signUp ? t("access.signUpLead") : compact ? "" : undefined}
      />
      <div className="mt-4 border-t border-border pt-4 text-center">
        {!signUp ? <p className="mb-3 text-sm text-muted-foreground">{t("access.newHere")}</p> : null}
        <Link href={routes.signIn(signUp ? undefined : "sign-up", continuationPostId, notification, contact)} prefetch={false} className={buttonClassName(signUp ? "outline" : "primary", compact ? "min-h-12 w-full px-5 py-3 text-base font-semibold sm:w-auto" : "px-4")}>
          {t(signUp ? "access.existingAccount" : "access.createAccount")}
        </Link>
        {!signUp ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("access.accountPromise")}</p> : null}
      </div>
      {/* Le serveur décide : comptes fictifs partagés uniquement dans le déploiement démo. */}
      {configuration && (configuration.localCodes || "demoAccounts" in configuration && configuration.demoAccounts === true) ? <DemoAccountsPanel authClient={entryClient} shared={!configuration.localCodes} /> : null}
    </div>
  )
}
