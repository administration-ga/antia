// Dupliqué de socle/packages/agent-features/src/features/iappel/useRingRelation.ts @ ad2e7fdc2 — adaptations : appel par `calls.direct.callMember({ networkId, target: { personId } })` du moteur (réseau courant de `useNetwork()`) au lieu de `reseauPersonnel.messagerie.callByHandle` — la cible porte sa personne (`personId`) ; fenêtre ouverte sur l'appel et l'appelé que rend le moteur (`callId`, `calleePersonId`) ; refus sans phrase du serveur (la raison à code est traduite par l'écran de fin) ; panne traduite par son code ou sa règle (`callErrorMessage(err, t)`), jamais le texte brut ; nom et photo de l'appelé nullables (DTO du moteur) ; plus de canal des réunions à écarter dans la doc (le moteur n'en a qu'un) ; le volet Relations et la fiche profil convergent sur ce crochet (lot F2).
"use client"

/**
 * useRingRelation — appeler une RELATION du réseau, depuis n'importe quel
 * écran (volet Relations, fiche profil).
 *
 * ⚠️ Le canal est celui des APPELS, et lui seul : `calls.direct.callMember`
 * puis le MAGASIN d'appel, qui monte la fenêtre sortante — l'appelé ne sonne
 * jamais pendant que l'appelant regarde un toast.
 *
 * ⚠️ Un refus n'est pas une panne. Le serveur rend `admitted: false` avec sa
 * raison : on ouvre l'écran de FIN — il dit pourquoi, quand rappeler, et
 * laisse déposer un message vocal — au lieu d'un toast qui disparaît sans
 * rien offrir.
 *
 * `IcomRelationsPanel` garde sa propre fonction `ring` : son cliquet de canal
 * relit le CORPS de cette fonction dans ce fichier-là. L'y remplacer par un
 * appel de crochet rendrait le cliquet aveugle.
 */

import { api, type Id } from "@antia/api/engine"
import { useNetwork } from "@antia/api/network"
import { useMutation } from "convex/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useCallStore } from "../../stores/call-store"
import { callErrorMessage } from "./call-errors"
import { refusalEndKind } from "./call-phase"

/**
 * L'identité de l'appelé voyage avec l'appel : sans elle, la fenêtre s'intitule
 * « Appeler » avec une initiale muette, alors que l'utilisateur vient de
 * choisir la personne dans une liste.
 */
export interface RingRelationTarget {
  personId: Id<"persons">
  handle: string
  displayName?: string | null
  avatarUrl?: string | null
}

export interface RingRelation {
  /** Le handle dont l'appel est EN COURS de lancement — pour désarmer sa carte. */
  busyHandle: string | null
  ring: (target: RingRelationTarget, mediaType?: "audio" | "video") => Promise<void>
}

export function useRingRelation(): RingRelation {
  const { t } = useTranslation("iappel")
  const { networkId } = useNetwork()
  const call = useMutation(api.modules.calls.direct.callMember)
  const { openOutgoingCall, openRefusedCall } = useCallStore()
  const [busyHandle, setBusyHandle] = useState<string | null>(null)

  const ring = useCallback(
    async (target: RingRelationTarget, mediaType: "audio" | "video" = "audio"): Promise<void> => {
      setBusyHandle(target.handle)
      const callee = {
        userId: target.personId,
        name: target.displayName ?? null,
        avatarUrl: target.avatarUrl ?? null,
        handle: target.handle,
      }
      try {
        const appel = await call({ networkId, target: { personId: target.personId }, mediaType })
        if (appel.admitted === false) {
          openRefusedCall({
            meetingId: appel.callId,
            mediaType,
            endKind: refusalEndKind(appel.reason),
            voicemailOffered: appel.voicemailOffered,
            scope: "personnel",
            callee,
          })
          return
        }
        openOutgoingCall({
          meetingId: appel.callId,
          participantUserId: appel.calleePersonId,
          // Le média GRAVÉ par le serveur, jamais celui demandé : c'est lui que
          // la salle montera, et un écart rendrait un « appel vidéo » muet.
          mediaType: appel.mediaType,
          startedAt: Date.now(),
          scope: "personnel",
          callee,
        })
      } catch (err) {
        toast.error(callErrorMessage(err, t), { duration: 8000 })
      } finally {
        setBusyHandle(null)
      }
    },
    [call, networkId, openOutgoingCall, openRefusedCall, t],
  )

  return { busyHandle, ring }
}
