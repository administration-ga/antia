// Dupliqué de socle/packages/agent-features/src/shell/direct-session-host.tsx @ ad2e7fdc2 — adaptations : première tranche réécrite sur le moteur, baux et rôle dans la coque persistante, réseau courant ; retour compact hors de la route injectée au lieu du studio flottant complet.
"use client"

import { api, type Id } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useNetwork, useRoutes } from "@antia/api/network"
import { Link, usePathname } from "@antia/api/routing"
import { Button } from "@antia/ui"
import { useMutation } from "convex/react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { DIRECT_HOST_HEARTBEAT_MS, DIRECT_PRESENCE_HEARTBEAT_MS } from "@antia/social-domain/live/domain"

import { DirectCallCoexistence } from "../../components/direct/DirectCallCoexistence"
import { DirectRoomMount } from "../../components/direct/DirectRoomMount"
import { CreateDirectDialog } from "../../features/direct/CreateDirectDialog"
import { shouldBeatViewerPresence } from "../../features/direct/direct-presence"
import { consumeConferenceLaunch, useConferenceLaunchRequest } from "../../features/iappel/conference-launch-store"
import { directSessionStore, useDirectSessionStore } from "../../stores/direct-session-store"

export function DirectSessionHost() {
  const { networkId } = useNetwork()
  const { sessionId } = useDirectSessionStore()
  const request = useConferenceLaunchRequest()
  // Aucun jeton d'un réseau précédent ne survit à un changement de contexte
  // ou à une déconnexion. Navigation et bascule mobile gardent ce montage.
  useEffect(() => () => { directSessionStore.leave(); consumeConferenceLaunch() }, [networkId])
  return <>
    {sessionId ? <ActiveDirect key={`${networkId}:${sessionId}`} sessionId={sessionId} /> : null}
    <DirectCallCoexistence />
    {request ? <CreateDirectDialog key={request.seq} prefill={request} onClose={consumeConferenceLaunch} /> : null}
  </>
}

function ActiveDirect({ sessionId }: { sessionId: Id<"liveSessions"> }) {
  const { t } = useTranslation("direct")
  const { networkId, charte } = useNetwork()
  const routes = useRoutes()
  const pathname = usePathname()
  const state = useDirectSessionStore()
  const session = useAuthenticatedConvexQuery(api.modules.live.sessions.get, { networkId, sessionId })
  const hostHeartbeat = useMutation(api.modules.live.hostPresence.heartbeat)
  const viewerHeartbeat = useMutation(api.modules.live.presence.heartbeat)
  const leaveViewer = useMutation(api.modules.live.presence.leave)
  const leaveStage = useMutation(api.modules.live.antenna.leaveAntenna)
  const role = session.data?.viewerRole ?? null
  const hostState = state.phase === "connected" ? "connected" : state.phase === "reconnecting" ? "reconnecting" : null
  const beatsViewer = shouldBeatViewerPresence(state.credentials?.role ?? null, state.phase)

  useEffect(() => {
    if (session.isError || session.data?.status === "ended") directSessionStore.leave()
    else if (role) directSessionStore.syncSessionRole(sessionId, role)
  }, [session.isError, session.data?.status, sessionId, role])
  useEffect(() => {
    if (role !== "host" || hostState === null || session.data?.status !== "live") return
    const beat = () => { void hostHeartbeat({ networkId, sessionId, state: hostState }).catch(() => undefined) }
    beat()
    const timer = setInterval(beat, DIRECT_HOST_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [role, hostState, session.data?.status, networkId, sessionId, hostHeartbeat])
  useEffect(() => {
    if (!beatsViewer) return
    const beat = () => { void viewerHeartbeat({ networkId, sessionId }).catch(() => undefined) }
    const release = () => { void leaveViewer({ networkId, sessionId }).catch(() => undefined) }
    beat()
    const timer = setInterval(beat, DIRECT_PRESENCE_HEARTBEAT_MS)
    window.addEventListener("pagehide", release)
    return () => {
      clearInterval(timer)
      window.removeEventListener("pagehide", release)
      release()
    }
  }, [beatsViewer, networkId, sessionId, viewerHeartbeat, leaveViewer])
  return <>
    <DirectRoomMount sessionId={sessionId} />
    {pathname !== routes.conference(sessionId) && (state.credentials || state.phase === "connecting" || state.phase === "error") ? <aside data-charte={charte} aria-label={t("ongoing")} className="fixed bottom-20 left-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg sm:bottom-5">
      <Link href={routes.conference(sessionId)} className="max-w-64 truncate text-sm font-semibold">{session.data?.title ?? t("ongoing")}</Link>
      <Button variant="ghost" onClick={() => { directSessionStore.leave(); void leaveViewer({ networkId, sessionId }).catch(() => undefined); if (role === "speaker") void leaveStage({ networkId, sessionId }).catch(() => undefined) }}>{t("leave")}</Button>
    </aside> : null}
  </>
}
