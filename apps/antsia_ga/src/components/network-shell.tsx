"use client"

import { NetworkProvider } from "@antsia/api/network"
import { NextRouterAdapter } from "@antsia/api/routing/next"
import { CommunicationShell } from "@antsia/social-features/shell"
import { useRouter } from "next/navigation"
import { createContext, type ReactNode, useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { CenteredStatus } from "@/components/shared/controls"
import { type SessionState, useSessionState } from "@/components/use-session-state"
import { engineRoutes, routes } from "@/lib/routes"

/** La charte d'antsia.ga, redéclarée par les surfaces portalisées (dock, appel, stories). */
const CHARTE = "antsia"

export type MemberSession = Extract<SessionState, { status: "member" }>

const MemberSessionContext = createContext<MemberSession | null>(null)

/** La session de MEMBRE de la page (sous le gabarit des membres) : personne et réseau racine. */
export function useMemberSession(): MemberSession {
  const session = useContext(MemberSessionContext)
  if (!session) throw new Error("useMemberSession : page de membre hors du gabarit `(membre)`.")
  return session
}

/**
 * La COQUE du réseau d'antsia.ga, autour de toute page réservée aux membres :
 * porte d'adhésion (connexion, profil publié, racine rejointe), adaptateur de
 * routage, réseau courant et adresses injectées (`NetworkProvider`), puis la
 * couche de communication montée UNE fois (iCom, appels, présence).
 */
export function NetworkShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("antsia")
  const router = useRouter()
  const session = useSessionState()

  useEffect(() => {
    if (session.status === "signedOut") router.replace(routes.signIn())
    else if (session.status === "welcome") router.replace(routes.welcome())
  }, [session.status, router])

  if (session.status !== "member") return <CenteredStatus label={t("session.checking")} />

  return (
    <NextRouterAdapter>
      <NetworkProvider networkId={session.root._id} slug={session.root.slug} personId={session.person._id} charte={CHARTE} routes={engineRoutes} liveAvailable>
        <MemberSessionContext.Provider value={session}>
          <CommunicationShell />
          {children}
        </MemberSessionContext.Provider>
      </NetworkProvider>
    </NextRouterAdapter>
  )
}
