// Dupliqué de socle/packages/chat/src/use-chat-attachments.ts @ ad2e7fdc2 — adaptations : plafond et liste blanche LUS dans le contrat du moteur (`ATTACHMENT_MAX_BYTES`, `CHAT_ATTACHMENT_MIME_TYPES`, `isChatMimeAllowed` de `@antia/social-contracts/attachments`) au lieu d'être recopiés ; messages de refus traduits (clés `iappel:useChatAttachments.*`, lues par `useTranslation` dans le hook, signature du hook inchangée) ; `formatFileSize` met en forme par `Intl.NumberFormat` dans la langue reçue (paramètre `locale` ajouté en dernier) au lieu d'unités françaises en dur ; le paquet `chat` du socle devient le dossier `lib/chat` du paquet des surfaces.
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
	ATTACHMENT_MAX_BYTES,
	CHAT_ATTACHMENT_MIME_TYPES,
	isChatMimeAllowed,
} from "@antia/social-contracts/attachments";

/**
 * Taille max par fichier côté client — celle du serveur (ADR-0160), LUE dans
 * le contrat du moteur (`ATTACHMENT_MAX_BYTES`, 25 Mo) : aucune valeur
 * recopiée, la parité est structurelle.
 */
export const MAX_ATTACHMENT_SIZE_BYTES: number = ATTACHMENT_MAX_BYTES;

/** Les tailles se comptent en base 1024, comme les écrans et le serveur. */
const KIBI = 1024;

/**
 * Formate une taille en bytes en string lisible, dans la langue reçue
 * (`3,2 Mo`, `12 ko`, `789 o` en français ; `3.2 MB`, `12 kB` en anglais).
 */
export function formatFileSize(bytes: number, locale: string): string {
	const format = (value: number, unit: string, fraction: { min: number; max: number }) =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit,
			unitDisplay: "short",
			minimumFractionDigits: fraction.min,
			maximumFractionDigits: fraction.max,
		}).format(value);
	if (bytes < KIBI) return format(bytes, "byte", { min: 0, max: 0 });
	if (bytes < KIBI * KIBI) return format(bytes / KIBI, "kilobyte", { min: 0, max: 0 });
	if (bytes < KIBI * KIBI * KIBI)
		return format(bytes / (KIBI * KIBI), "megabyte", { min: 0, max: 1 });
	return format(bytes / (KIBI * KIBI * KIBI), "gigabyte", { min: 1, max: 1 });
}

/**
 * MIME types autorisés — la liste blanche `chat_attachment` du serveur, LUE
 * dans le contrat du moteur (`CHAT_ATTACHMENT_MIME_TYPES`). Le hook juge un
 * fichier comme le serveur (`isChatMimeAllowed` : type sans paramètres, en
 * minuscules) ; le serveur reste le filet, il relit à l'admission le type
 * RÉEL du fichier stocké.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES: ReadonlyArray<string> = CHAT_ATTACHMENT_MIME_TYPES;

export interface PendingAttachment {
	/** Fichier en attente d'upload (pas encore envoyé au backend). */
	file: File;
	/** ID local uniquement — pour supprimer avant envoi. */
	localId: string;
}

/**
 * useChatAttachments — gère une liste locale de fichiers joints en attente
 * dans un composer, avec validation client (taille + MIME) et messages
 * utilisateur (traduits dans la langue courante). L'upload vers le backend
 * est délégué à l'appelant via `consumeForUpload()` qui retourne les fichiers
 * prêts et vide la liste.
 *
 * Usage type dans un ChatComposer :
 * ```tsx
 * const {
 *   attachments, addFiles, remove, clear, consumeForUpload,
 * } = useChatAttachments({
 *   onValidationError: (msg) => toast.error(msg),
 * });
 *
 * const handleSend = async () => {
 *   const pendingFiles = consumeForUpload();
 *   const storageIds = await Promise.all(
 *     pendingFiles.map(async (f) => {
 *       const url = await generateUploadUrl();
 *       const res = await fetch(url, { method: "POST", body: f, headers: { "Content-Type": f.type } });
 *       return (await res.json()).storageId;
 *     }),
 *   );
 *   await sendChatMessage({ chatId, content, attachments: storageIds });
 * };
 * ```
 */
export function useChatAttachments(options?: {
	onValidationError?: (message: string) => void;
}) {
	const { t, i18n } = useTranslation("iappel");
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
	const counterRef = useRef(0);
	const locale = i18n.language;

	const addFiles = useCallback(
		(files: FileList | File[]) => {
			const fileArray = Array.from(files);
			const accepted: PendingAttachment[] = [];
			for (const file of fileArray) {
				if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
					options?.onValidationError?.(
						t("useChatAttachments.tooLarge", {
							name: file.name,
							max: formatFileSize(MAX_ATTACHMENT_SIZE_BYTES, locale),
						}),
					);
					continue;
				}
				if (file.type && !isChatMimeAllowed(file.type)) {
					options?.onValidationError?.(
						t("useChatAttachments.typeNotAllowed", {
							name: file.name,
							type: file.type,
						}),
					);
					continue;
				}
				counterRef.current += 1;
				accepted.push({
					file,
					localId: `pending-${Date.now()}-${counterRef.current}`,
				});
			}
			if (accepted.length > 0) {
				setAttachments((prev) => [...prev, ...accepted]);
			}
		},
		[options, t, locale],
	);

	const remove = useCallback((localId: string) => {
		setAttachments((prev) => prev.filter((a) => a.localId !== localId));
	}, []);

	const clear = useCallback(() => {
		setAttachments([]);
	}, []);

	/**
	 * Retourne les File objects prêts à être uploadés et vide la liste locale.
	 * À appeler juste avant l'envoi du message.
	 */
	const consumeForUpload = useCallback((): File[] => {
		const files = attachments.map((a) => a.file);
		setAttachments([]);
		return files;
	}, [attachments]);

	return {
		attachments,
		addFiles,
		remove,
		clear,
		consumeForUpload,
	};
}
