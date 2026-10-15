// Dupliqué de socle/packages/agent-features/src/features/messagerie/IcomAppelJournal.tsx @ ad2e7fdc2 — adaptations : rappel par `calls.direct.callMember({ networkId, target: { personId } })` au lieu de `functions.meetings.callCitizenById` (une seule porte d'appel dans le moteur) ; l'appel est `callId` (`Id<"calls">`), l'appelé une PERSONNE (`Id<"persons">`) ; aucune phrase du serveur sur un refus (le moteur rend une raison à code, l'écran de fin la traduit) ; erreur traduite (`callErrorMessage(err, t)`) ; journal sans portée (`scope` retiré : le moteur ne connaît que des appels de personne à personne) ; réseau courant par `useNetwork()`.
"use client"

/**
 * IcomAppelJournal — le JOURNAL des appels, câblé pour rappeler.
 *
 * `IappelJournal` (tranche `iappel`) ne sait que METTRE EN FORME l'historique :
 * il ne passe aucun appel lui-même et reçoit le geste « rappeler » en prop.
 * Ce wrapper est ce geste, et il vit dans `messagerie` parce que c'est la
 * brique iAppel qui monte le journal — la tranche `iappel` n'a pas à connaître
 * la messagerie.
 *
 * ⚠️ Rappeler vise la PERSONNE (`target: { personId }`) et non un identifiant
 * public : une entrée de journal porte la personne en face, jamais un handle.
 * Le refus suit le même contrat que partout ailleurs — une VALEUR de retour
 * (`admitted: false`), pas une exception : une exception annulerait la
 * transaction qui vient d'inscrire l'appel refusé au journal.
 */

import { api } from "@antia/api/engine"
import type { Id } from "@antia/api/engine"
import { useNetwork } from "@antia/api/network"
import { useMutation } from "convex/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { callErrorMessage } from "../iappel/call-errors"
import { useCallStore } from "../../stores/call-store"
import { IappelJournal } from "../iappel/IappelJournal"
import { refusalEndKind } from "../iappel/call-phase"

export function IcomAppelJournal({
  leadingControls,
}: {
  /** Contrôles de niveau iAppel, rendus sur la même ligne que ses filtres. */
  leadingControls?: ReactNode
} = {}) {
  const { t } = useTranslation("messagerie")
  const { networkId } = useNetwork()
  const call = useMutation(api.modules.calls.direct.callMember)
  const { openOutgoingCall, openRefusedCall } = useCallStore()

  const callBack = async (input: {
    userId: string
    name: string
    mediaType: "audio" | "video"
  }) => {
    // L'entrée de journal porte la PERSONNE en face (nom de champ historique).
    const personId = input.userId as Id<"persons">
    const callee = { userId: personId, name: input.name, avatarUrl: null }
    try {
      const appel = await call({
        networkId,
        target: { personId },
        mediaType: input.mediaType,
      })

      // Le correspondant peut avoir écarté l'appel (ne pas déranger, ligne
      // occupée, hors de ses relations). L'écran de FIN plutôt qu'un toast :
      // il dit la raison, et il laisse déposer un message vocal quand la
      // raison le permet.
      if (appel.admitted === false) {
        openRefusedCall({
          meetingId: appel.callId,
          mediaType: input.mediaType,
          endKind: refusalEndKind(appel.reason),
          voicemailOffered: appel.voicemailOffered,
          scope: "personnel",
          callee,
        })
        return
      }

      // La fenêtre d'appel est montée par la coque dès que le store porte
      // l'appel : ce composant ne rend aucune salle.
      openOutgoingCall({
        meetingId: appel.callId,
        participantUserId: personId,
        mediaType: appel.mediaType,
        startedAt: Date.now(),
        scope: "personnel",
        callee,
      })
    } catch (err) {
      toast.error(callErrorMessage(err, t), { duration: 8000 })
    }
  }

  return (
    <IappelJournal
      leadingControls={leadingControls}
      onCallBack={(input) => {
        void callBack(input)
      }}
    />
  )
}
