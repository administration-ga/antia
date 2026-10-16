// Dupliqué de socle/packages/agent-features/src/components/direct/DirectRoomMount.tsx @ ad2e7fdc2 — adaptations : références du moteur, réseau courant, dépendances LiveKit locales et libellés traduits ; structure de salle persistante conservée.
"use client"

/**
 * DirectRoomMount — le PROPRIÉTAIRE de la salle LiveKit d'un direct.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INVISIBLE, ET C'EST LE POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'au 2026-09-06, la salle était montée par `DirectStage`, c'est-à-dire
 * par une PRÉSENTATION — rendue à deux endroits de l'arbre selon le palier
 * (page ≥ 960 px, plein écran portalisé en dessous). Franchir 959 px démontait
 * l'une pour monter l'autre : la salle se fermait, les pistes publiées
 * s'arrêtaient, et l'hôte re-demandait aussitôt un jeton — avec un NOUVEAU
 * nonce d'identité, donc un second participant SFU pour le même sujet le temps
 * que l'ancien expire (constat D-08 de l'audit).
 *
 * Ici la salle n'a plus de présentation : elle est `sr-only`, montée UNE fois
 * par `DirectSessionHost` (shell, 2026-09-14 — elle l'était par la page, en
 * frère stable de la branche de palier), et publiée dans
 * `directRoomRegistry`. `DirectStage` et la carte flottante la consomment par
 * `useDirectRoom` + `<RoomContext.Provider>` dans leur propre sous-arbre —
 * changer de palier, de page ou d'espace change la présentation, jamais la
 * connexion.
 *
 * C'est exactement le patron déjà en service côté appels
 * (`components/call-center/CallRoomMount.tsx`), et il vit délibérément sous
 * `components/direct/` : le cliquet `iappel-surface.ratchet.test.ts` interdit
 * tout `<LiveKitRoom>` sous `features/iappel/` et `shell/`, et ce mount n'est
 * ni l'un ni l'autre.
 */

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { LIVEKIT_CALL_ROOM_OPTIONS } from "../../lib/livekit/room-options"
import { useLiveKitDisconnectGuard } from "../../lib/livekit/use-livekit-disconnect-guard"
import { ConnectionState } from "livekit-client"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
  describeCallMediaError,
  describeCameraError,
  isPermissionDenied,
} from "../../features/iappel/media-errors"
import { livekitRoomErrorMessage } from "../../features/iappel/call-errors"
import {
  directAudioVolume,
  isCallBusy,
} from "../../features/direct/direct-call-coexistence"
import { useCallStore } from "../../stores/call-store"
import { directRoomRegistry } from "../../stores/direct-room-registry"
import {
  directSessionStore,
  directWantsAudio,
  directWantsVideo,
  useDirectSessionStore,
  type DirectSessionId,
} from "../../stores/direct-session-store"

/**
 * Publie la `Room` créée par `<LiveKitRoom>` dans le registre, pour que les
 * présentations montées ailleurs dans l'arbre la retrouvent.
 */
function DirectRoomRegistrar({ sessionId }: { sessionId: DirectSessionId }) {
  const room = useRoomContext()
  useEffect(() => {
    if (!room) return
    directRoomRegistry.register(sessionId, room)
    return () => {
      directRoomRegistry.unregister(sessionId, room)
    }
  }, [sessionId, room])
  return null
}

/**
 * Reporte l'état de connexion RÉEL dans le magasin.
 *
 * `onConnected`/`onDisconnected` ne disent pas la reconnexion : entre les
 * deux, LiveKit passe par `Reconnecting` (bascule 4G/Wi-Fi, mise en
 * arrière-plan) sans jamais prévenir la page. Sans cette mesure, l'écran
 * affirmait « en direct » pendant qu'aucune piste ne partait.
 */
function DirectConnectionPhase() {
  const connectionState = useConnectionState()
  useEffect(() => {
    switch (connectionState) {
      case ConnectionState.Connected:
        directSessionStore.setPhase("connected")
        return
      case ConnectionState.Connecting:
        directSessionStore.setPhase("connecting")
        return
      case ConnectionState.Reconnecting:
      case ConnectionState.SignalReconnecting:
        directSessionStore.setPhase("reconnecting")
        return
      default:
        // `Disconnected` est traité par `onDisconnected`, qui sait distinguer
        // un artefact de handshake d'une vraie coupure.
        return
    }
  }, [connectionState])
  return null
}

/**
 * Applique l'intention média du magasin à la salle, À CHAUD.
 *
 * Complémentaire des props `audio`/`video` : celles-ci couvrent la connexion
 * et les reconnexions, celui-ci couvre les changements en cours de direct
 * (l'intervenant appuie sur « Caméra »).
 *
 * ⚠️ Un refus de permission REVIENT sur l'intention. Sans ce retour en
 * arrière, le bouton resterait allumé alors que rien n'est publié : on se
 * croirait vu.
 */
function DirectMediaIntentController({
  wantsAudio,
  wantsVideo,
}: {
  wantsAudio: boolean
  wantsVideo: boolean
}) {
  const { t } = useTranslation("direct")
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const connectionState = useConnectionState()
  const isConnected = connectionState === ConnectionState.Connected

  useEffect(() => {
    if (!room || !localParticipant || !isConnected) return
    let cancelled = false
    localParticipant.setMicrophoneEnabled(wantsAudio).catch((err) => {
      if (cancelled) return
      console.warn("[direct] setMicrophoneEnabled a échoué :", err)
      if (!wantsAudio) return
      toast.error(describeCallMediaError(err, {}, t) ?? t("media.microphoneFailed"))
      if (isPermissionDenied(err)) directSessionStore.setIntent({ micEnabled: false })
    })
    return () => {
      cancelled = true
    }
  }, [wantsAudio, room, localParticipant, isConnected, t])

  useEffect(() => {
    if (!room || !localParticipant || !isConnected) return
    let cancelled = false
    localParticipant.setCameraEnabled(wantsVideo).catch((err) => {
      if (cancelled) return
      console.warn("[direct] setCameraEnabled a échoué :", err)
      if (!wantsVideo) return
      toast.error(describeCameraError(err, t))
      if (isPermissionDenied(err)) directSessionStore.setIntent({ cameraEnabled: false })
    })
    return () => {
      cancelled = true
    }
  }, [wantsVideo, room, localParticipant, isConnected, t])

  return null
}

export function DirectRoomMount({ sessionId }: { sessionId: DirectSessionId }) {
  const { t } = useTranslation("direct")
  const { sessionId: heldSessionId, credentials, intent } = useDirectSessionStore()
  // Un APPEL prend la ligne : le son du direct se BAISSE (jamais coupé — on
  // garde une oreille sur la conférence), cf. `direct-call-coexistence.ts`.
  // Le micro, lui, est réglé par `DirectCallCoexistence` via l'intention.
  const { slots: callSlots } = useCallStore()
  const audioVolume = directAudioVolume(isCallBusy(callSlots))

  // Sortie VOLONTAIRE : `leave()` vide déjà les credentials, ce qui démonte la
  // salle. Le rappel du garde n'est là que pour le cas où LiveKit émet la
  // déconnexion avant que le magasin ne soit revenu à l'état d'entrée.
  const leaveOnUserHangUp = useCallback(() => {
    directSessionStore.leave()
  }, [])
  const {
    onConnected: guardConnected,
    onDisconnected: guardDisconnected,
    markUserHangUp,
  } = useLiveKitDisconnectGuard(leaveOnUserHangUp)

  // ⚠️ Tous les hooks AVANT ce retour — la salle n'existe qu'avec un jeton, et
  // la page monte ce composant dès qu'elle connaît la session.
  if (heldSessionId !== sessionId || credentials === null) return null

  /**
   * ⚠️ `audio` et `video` sont VIVANTES. `useLiveKitRoom` ré-applique
   * `setMicrophoneEnabled(!!audio)` / `setCameraEnabled(!!video)` à CHAQUE
   * `RoomEvent.SignalConnected` : avec les anciennes valeurs figées
   * (`audio={isPublisher}`), un micro coupé à la main était rallumé à la
   * première reconnexion, sans un mot.
   */
  const wantsAudio = directWantsAudio(credentials.role, intent)
  const wantsVideo = directWantsVideo(credentials.role, intent)

  return (
    <LiveKitRoom
      token={credentials.token}
      serverUrl={credentials.wsUrl}
      connect
      audio={wantsAudio}
      video={wantsVideo}
      options={LIVEKIT_CALL_ROOM_OPTIONS}
      onConnected={() => {
        guardConnected()
        directSessionStore.setPhase("connected")
      }}
      onError={(err) => {
        // Deux pannes sans rapport arrivent par ce même canal : un refus de
        // périphérique, et un échec de connexion. Les confondre envoyait la
        // personne chercher la panne là où elle n'est pas — « vérifiez votre
        // réseau » sur une caméra qu'ELLE venait de bloquer.
        const media = describeCallMediaError(err, { video: wantsVideo }, t)
        if (media !== null) {
          toast.error(media)
          if (isPermissionDenied(err)) {
            directSessionStore.setIntent(
              wantsVideo ? { cameraEnabled: false } : { micEnabled: false },
            )
          }
          return
        }
        directSessionStore.setPhase("error", livekitRoomErrorMessage(err, t))
      }}
      onDisconnected={() => {
        // La sortie volontaire passe TOUJOURS par `leave()`, qui vide les
        // credentials avant que la salle ne se ferme : c'est à cela qu'on la
        // reconnaît, et c'est ce que le garde attend pour ne pas traiter un
        // artefact de handshake comme une coupure.
        const voluntary = directSessionStore.getState().credentials === null
        if (voluntary) markUserHangUp()
        guardDisconnected()
        if (!voluntary) directSessionStore.setPhase("disconnected")
      }}
      // Toujours invisible : la salle est exposée par `directRoomRegistry`,
      // les présentations la rendent dans leur propre sous-arbre.
      className="sr-only"
    >
      <DirectRoomRegistrar sessionId={sessionId} />
      <DirectConnectionPhase />
      <DirectMediaIntentController wantsAudio={wantsAudio} wantsVideo={wantsVideo} />
      {/* UNIQUE dans toute la page : deux `RoomAudioRenderer` sur la même
          salle, c'est deux `<audio>` sur les mêmes pistes. Son volume suit
          la ligne d'appel : baissé pendant un appel, plein sinon. */}
      <RoomAudioRenderer volume={audioVolume} />
    </LiveKitRoom>
  )
}
