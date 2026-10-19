"use client"

import { useTranslation } from "react-i18next"
import type { OutboxEntry } from "./messagerie-outbox"

/** Un envoi local n'a ni lecture prouvée, ni action sur un message inexistant. */
export function OutboxMessages({ entries }: { entries: readonly OutboxEntry[] }) {
	const { t } = useTranslation("messagerie")
	if (entries.length === 0) return null
	return (
		<div className="msg-thread" aria-live="polite" aria-relevant="additions text">
			{entries.map((entry) => (
				<div key={entry.key} className="msg-line" data-mine="true" data-first="true" data-send-state={entry.messageId === null ? "pending" : "admitted"}>
					<div className="msg-bubble" data-mine="true" data-first="true" data-last="true" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
						{entry.text.length > 0 ? <span>{entry.text}</span> : null}
						{entry.attachmentCount > 0 ? <span style={{ display: "block" }}>{t("outboxMessages.attachments", { count: entry.attachmentCount })}</span> : null}
					</div>
					<span className="msg-time" role="status">{t(entry.messageId === null ? "outboxMessages.sending" : "messageBubble.sent")}</span>
				</div>
			))}
		</div>
	)
}
