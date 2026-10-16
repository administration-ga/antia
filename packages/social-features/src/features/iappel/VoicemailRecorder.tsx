// Dupliqué de socle/packages/agent-features/src/features/iappel/VoicemailRecorder.tsx @ ad2e7fdc2 — adaptations : dépôt par la messagerie vocale du moteur (`calls.voicemail.generateUploadUrl` puis `calls.voicemail.leave`, réseau courant, type du fichier transmis) ; appel `Id<"calls">` ; libellés, nom accessible et toasts traduits (i18n `iappel`) ; un refus du moteur se dit par sa règle (`rules:*`), sinon le message générique.
"use client"

/**
 * VoicemailRecorder — laisser un mot à quelqu'un qu'on n'a pas pu joindre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI L'APPELANT S'ENREGISTRE LUI-MÊME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'appel n'a pas abouti — écarté avant de sonner (silence, réunion), ou
 * jamais décroché : il n'y a pas eu de conversation, donc rien à enregistrer
 * côté serveur. C'est l'appelant qui s'enregistre depuis son navigateur, comme
 * il enregistrerait une note vocale dans une conversation, et le moteur
 * dépose la prise (`calls.voicemail`).
 *
 * D'où la réutilisation directe de `VoiceRecorderButton` et de ses règles
 * (durée maximale, choix du format selon le navigateur, rejet d'une prise trop
 * courte) : deux enregistreurs différents dans la même application finiraient
 * par diverger sur la durée acceptée ou le format produit.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useConvexMutationQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { engineErrorRule } from "@antsia/social-contracts/errors"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
	VoiceRecorderButton,
	type VoiceNoteResult,
} from "../messagerie/VoiceRecorderButton"

export interface VoicemailRecorderProps {
	/** L'appel qui n'a pas abouti (`Id<"calls">`) — le nom du champ est celui du socle. */
	meetingId: Id<"calls">
	/** Nom du destinataire — l'écran doit dire À QUI l'on parle. */
	peerName: string
	/** Message déposé : l'écran de fin peut se refermer. */
	onSent: () => void
	onCancel: () => void
}

export function VoicemailRecorder({
	meetingId,
	peerName,
	onSent,
	onCancel,
}: VoicemailRecorderProps) {
	const { t } = useTranslation("iappel")
	const { networkId } = useNetwork()
	const [sending, setSending] = useState(false)
	const { mutateAsync: uploadUrl } = useConvexMutationQuery(
		api.modules.calls.voicemail.generateUploadUrl,
	)
	const { mutateAsync: leaveVoicemail } = useConvexMutationQuery(
		api.modules.calls.voicemail.leave,
	)

	const depose = useCallback(
		async (note: VoiceNoteResult) => {
			setSending(true)
			try {
				const url = await uploadUrl({ networkId })
				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": note.mimeType },
					body: note.file,
				})
				if (!response.ok) throw new Error("upload")
				const { storageId } = (await response.json()) as {
					storageId: Id<"_storage">
				}
				await leaveVoicemail({
					networkId,
					callId: meetingId,
					storageId,
					durationMs: Math.round(note.durationMs),
					mimeType: note.mimeType,
				})
				toast.success(t("voicemailRecorder.sent", { name: peerName }))
				onSent()
			} catch (error) {
				// L'échec est DIT : sans message, l'appelant croit avoir laissé un
				// mot que personne ne recevra jamais. Un refus du moteur (messagerie
				// fermée, durée) dit sa règle ; tout le reste, le message générique.
				const rule = engineErrorRule(error)
				toast.error(rule ? t(`rules:${rule.rule}`, rule.params) : t("voicemailRecorder.failed"))
			} finally {
				setSending(false)
			}
		},
		[uploadUrl, leaveVoicemail, networkId, meetingId, peerName, onSent, t],
	)

	return (
		<div
			className="flex flex-col items-center gap-4"
			role="group"
			aria-label={t("voicemailRecorder.label", { name: peerName })}
		>
			<p
				className="max-w-xs text-center text-[14px]"
				style={{ color: "var(--esp-immersive-on-ink)", opacity: 0.75 }}
			>
				{sending ? t("voicemailRecorder.sending") : t("voicemailRecorder.prompt", { name: peerName })}
			</p>

			<VoiceRecorderButton
				onRecorded={(note) => void depose(note)}
				onError={(message) => toast.error(message)}
				disabled={sending}
			/>

			<button
				type="button"
				onClick={onCancel}
				className="iappel-soft-action"
				disabled={sending}
			>
				{t("voicemailRecorder.cancel")}
			</button>
		</div>
	)
}
